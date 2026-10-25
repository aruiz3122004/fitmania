import { NextResponse } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';
import { recordAuditLog } from '@/lib/audit-logger';
import { maskEmail } from '@/lib/reception-members';
import { sendMfaCodeEmail } from '@/services/mail';
import { MFA_CHALLENGES, MFA_STATE, getMfaStatus, readMfaState } from '@/lib/mfa-server';
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  addSession,
  codeMatches,
  generateCode,
  generateRecoveryCodes,
  hashCode,
  hashRecoveryCode,
  isMfaPurpose,
  newSalt,
} from '@/lib/mfa';

/**
 * Verificación en dos pasos por correo (opcional para cualquier cuenta).
 *
 * GET  → { enabled, verified, email (enmascarado), recoveryRemaining }
 * POST { action: 'send',    purpose }        → envía un código de 6 dígitos al correo de la cuenta
 * POST { action: 'verify',  purpose, code }  → valida el código:
 *        login   → marca como verificada la sesión actual
 *        enable  → activa la verificación y devuelve los códigos de recuperación (una sola vez)
 *        disable → la desactiva
 * POST { action: 'recover', code }           → usa un código de recuperación para la sesión actual
 *
 * Usa el ID token sin exigir la verificación (es justo el paso que la completa).
 */

async function decode(request: Request): Promise<DecodedIdToken | null> {
  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return null;
  try {
    return await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(request: Request) {
  const decoded = await decode(request);
  if (!decoded) return bad('No autorizado.', 401);
  try {
    const status = await getMfaStatus(decoded);
    return NextResponse.json({ ...status, email: maskEmail(decoded.email) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[/api/auth/mfa GET]', error);
    return bad('No se pudo consultar la verificación en dos pasos.', 500);
  }
}

export async function POST(request: Request) {
  const decoded = await decode(request);
  if (!decoded) return bad('No autorizado.', 401);
  const body = await request.json().catch(() => null);
  const action = body?.action;

  try {
    if (action === 'send') return await sendCode(decoded, body?.purpose);
    if (action === 'verify') return await verifyCode(request, decoded, body?.purpose, body?.code);
    if (action === 'recover') return await redeemRecoveryCode(request, decoded, body?.code);
    return bad('Acción no válida.');
  } catch (error) {
    console.error('[/api/auth/mfa POST]', action, error);
    return bad('Error interno del servidor.', 500);
  }
}

async function sendCode(decoded: DecodedIdToken, purpose: unknown) {
  if (!isMfaPurpose(purpose)) return bad('Propósito no válido.');
  if (!decoded.email) return bad('Tu cuenta no tiene un correo asociado.');

  const status = await getMfaStatus(decoded);
  if (purpose === 'login' && (!status.enabled || status.verified)) return bad('Esta sesión no necesita verificación.');
  if (purpose === 'enable') {
    if (status.enabled) return bad('La verificación en dos pasos ya está activa.');
    // El código llega a ese correo: debe ser de la persona.
    const verifiedEmail = decoded.email_verified || (await getAdminAuth().getUser(decoded.uid)).emailVerified;
    if (!verifiedEmail) return bad('Verifica tu correo antes de activar la verificación en dos pasos.', 403);
  }
  if (purpose === 'disable' && (!status.enabled || !status.verified)) return bad('La verificación en dos pasos no está activa en esta sesión.');

  const rl = await limitAction(`mfa-send:${decoded.uid}`, 5, 900);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Pediste demasiados códigos. Espera unos minutos.');

  const db = getAdminFirestore();
  const challengeRef = db.collection(MFA_CHALLENGES).doc(decoded.uid);
  const previous = (await challengeRef.get()).data();
  const sentAt = previous?.sentAt?.toMillis?.() as number | undefined;
  if (sentAt && previous?.authTime === decoded.auth_time && previous?.purpose === purpose && Date.now() - sentAt < RESEND_COOLDOWN_MS) {
    const secondsLeft = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - sentAt)) / 1000);
    return NextResponse.json({ error: `Espera ${secondsLeft} s para pedir otro código.`, secondsLeft }, { status: 429 });
  }

  const code = generateCode();
  const salt = newSalt();
  await challengeRef.set({
    purpose,
    authTime: decoded.auth_time,
    salt,
    codeHash: hashCode(code, salt),
    attempts: 0,
    sentAt: new Date(),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  const profile = await db.collection('users').doc(decoded.uid).get();
  const customerName = String(profile.data()?.username || decoded.name || decoded.email.split('@')[0]).slice(0, 100);
  try {
    await sendMfaCodeEmail({ to: decoded.email, customerName, code, purpose });
  } catch (err: any) {
    console.error('[mfa] No se pudo enviar el código:', err?.message || err);
    await challengeRef.delete().catch(() => {});
    return bad('No se pudo enviar el código. Intenta de nuevo o usa un código de recuperación.', 502);
  }
  return NextResponse.json({ sent: true, email: maskEmail(decoded.email), expiresInSeconds: CODE_TTL_MS / 1000 });
}

type VerifyOutcome =
  | { ok: true; recoveryCodes?: string[] }
  | { ok: false; error: string; status: number };

async function verifyCode(request: Request, decoded: DecodedIdToken, purpose: unknown, code: unknown) {
  if (!isMfaPurpose(purpose)) return bad('Propósito no válido.');
  if (typeof code !== 'string' || !code.trim()) return bad('Ingresa el código de 6 dígitos.');
  const rl = await limitAction(`mfa-verify:${decoded.uid}`, 20, 900);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Demasiados intentos. Espera unos minutos.');

  const db = getAdminFirestore();
  const challengeRef = db.collection(MFA_CHALLENGES).doc(decoded.uid);
  const stateRef = db.collection(MFA_STATE).doc(decoded.uid);
  // Los códigos de recuperación se generan fuera de la transacción (puede reintentarse).
  const recoveryCodes = purpose === 'enable' ? generateRecoveryCodes() : undefined;

  const outcome = await db.runTransaction<VerifyOutcome>(async (tx) => {
    const [challengeSnap, stateSnap] = await Promise.all([tx.get(challengeRef), tx.get(stateRef)]);
    const challenge = challengeSnap.data();
    if (!challenge || challenge.purpose !== purpose || challenge.authTime !== decoded.auth_time) {
      return { ok: false, error: 'No hay un código pendiente. Pide uno nuevo.', status: 400 };
    }
    if ((challenge.expiresAt?.toMillis?.() ?? 0) < Date.now()) {
      tx.delete(challengeRef);
      return { ok: false, error: 'El código venció. Pide uno nuevo.', status: 400 };
    }
    if (!codeMatches(code, challenge.salt, challenge.codeHash)) {
      const attempts = (Number(challenge.attempts) || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) tx.delete(challengeRef);
      else tx.update(challengeRef, { attempts });
      return {
        ok: false,
        error: attempts >= MAX_ATTEMPTS ? 'Demasiados intentos con este código. Pide uno nuevo.' : 'El código no es correcto.',
        status: 400,
      };
    }

    tx.delete(challengeRef);
    const state = stateSnap.data() || {};
    const now = new Date();
    if (purpose === 'login') {
      if (state.enabled !== true) return { ok: false, error: 'La verificación en dos pasos no está activa.', status: 400 };
      tx.update(stateRef, { sessions: addSession(state.sessions, decoded.auth_time), updatedAt: now });
      return { ok: true };
    }
    if (purpose === 'enable') {
      tx.set(stateRef, {
        enabled: true,
        sessions: addSession([], decoded.auth_time),
        recoveryHashes: recoveryCodes!.map((c) => hashRecoveryCode(decoded.uid, c)),
        enabledAt: now,
        updatedAt: now,
      });
      return { ok: true, recoveryCodes };
    }
    tx.delete(stateRef);
    return { ok: true };
  });

  if (!outcome.ok) return bad(outcome.error, outcome.status);
  if (purpose !== 'login') {
    await recordAuditLog({
      action: purpose === 'enable' ? 'MFA_ENABLED' : 'MFA_DISABLED',
      category: 'AUTH_SUCCESS',
      details: `Verificación en dos pasos por correo ${purpose === 'enable' ? 'activada' : 'desactivada'}.`,
      adminEmail: decoded.email,
      actorUid: decoded.uid,
      targetId: decoded.uid,
      request,
    });
  }
  return NextResponse.json({ verified: true, ...(outcome.recoveryCodes ? { recoveryCodes: outcome.recoveryCodes } : {}) });
}

async function redeemRecoveryCode(request: Request, decoded: DecodedIdToken, code: unknown) {
  if (typeof code !== 'string' || !code.trim()) return bad('Ingresa un código de recuperación.');
  const rl = await limitAction(`mfa-recover:${decoded.uid}`, 10, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Demasiados intentos. Espera unos minutos.');

  const state = await readMfaState(decoded.uid);
  if (!state?.enabled) return bad('La verificación en dos pasos no está activa.');

  const db = getAdminFirestore();
  const stateRef = db.collection(MFA_STATE).doc(decoded.uid);
  const hash = hashRecoveryCode(decoded.uid, code);
  const remaining = await db.runTransaction(async (tx) => {
    const data = (await tx.get(stateRef)).data();
    const hashes: string[] = Array.isArray(data?.recoveryHashes) ? data!.recoveryHashes : [];
    if (!hashes.includes(hash)) return null;
    const left = hashes.filter((h) => h !== hash);
    // Código de un solo uso: se elimina al usarlo.
    tx.update(stateRef, { recoveryHashes: left, sessions: addSession(data?.sessions, decoded.auth_time!), updatedAt: new Date() });
    return left.length;
  });
  if (remaining === null) return bad('El código de recuperación no es válido o ya se usó.');

  await recordAuditLog({
    action: 'MFA_RECOVERY_CODE_USED',
    category: 'AUTH_SUCCESS',
    details: `Inicio de sesión con código de recuperación. Quedan ${remaining}.`,
    adminEmail: decoded.email,
    actorUid: decoded.uid,
    targetId: decoded.uid,
    request,
  });
  return NextResponse.json({ verified: true, recoveryRemaining: remaining });
}
