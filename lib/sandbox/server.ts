import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { FieldPath, FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { deletePostCompletely } from '@/lib/forum-server';
import { deleteCloudinaryPrefix } from '@/lib/cloudinary-server';
import { closeDailyStats } from '@/lib/attendance';
import { getDateKeyInAppTz } from '@/lib/datetime';
import {
  IS_SANDBOX,
  SANDBOX_EMAIL_DOMAIN,
  SANDBOX_MAX_ACTIVE,
  SANDBOX_SESSION_MS,
  SANDBOX_UPLOAD_ROOT,
  explorerName,
} from '@/lib/sandbox';
import { buildSandboxSeed, SANDBOX_COLLECTIONS, SEED_VERSION } from '@/lib/sandbox/seed';

/**
 * Servidor del modo sandbox: cuentas temporales, limpieza y reinicio de datos.
 *
 * Doble seguro antes de borrar nada: además de NEXT_PUBLIC_SANDBOX_MODE, el despliegue
 * debe declarar SANDBOX_FIREBASE_PROJECT_ID igual a su FIREBASE_PROJECT_ID. Si alguien
 * activa el modo por error en el sitio real (con sus credenciales), el reinicio se niega.
 */
const SESSIONS = 'sandbox_sessions';
const META = 'system/sandbox';

export class SandboxError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** 404 fuera del sandbox: las rutas /api/sandbox/* no existen en el sitio real. */
export function sandboxOnly(): NextResponse | null {
  return IS_SANDBOX ? null : NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
}

export function assertSandboxProject(): void {
  const project = (process.env.FIREBASE_PROJECT_ID || '').trim();
  const confirmed = (process.env.SANDBOX_FIREBASE_PROJECT_ID || '').trim();
  const emulator = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!IS_SANDBOX || (!emulator && (!project || project !== confirmed))) {
    throw new SandboxError('El sandbox no está configurado (SANDBOX_FIREBASE_PROJECT_ID).', 503);
  }
}

// ---------------------------------------------------------------------------
// Limpieza de un visitante
// ---------------------------------------------------------------------------

/** Borra TODO lo que creó una cuenta temporal (aquí no hay obligación de conservar nada). */
export async function cleanupVisitor(db: Firestore, auth: Auth, uid: string, email?: string | null) {
  const posts = await db.collection('posts').where('autor_id', '==', uid).get();
  for (const post of posts.docs) await deletePostCompletely(db, post.id);

  const writer = db.bulkWriter();
  const [comments, liked, ...owned] = await Promise.all([
    db.collectionGroup('comments').where('autor_id', '==', uid).get(),
    db.collection('posts').where('likes', 'array-contains', uid).get(),
    db.collection('orders').where('uid', '==', uid).get(),
    db.collection('payments').where('uid', '==', uid).get(),
    db.collection('entry_logs').where('userId', '==', uid).get(),
    db.collection('checkIns').where('userId', '==', uid).get(),
    db.collection('pqrs').where('userId', '==', uid).get(),
    db.collection('reportes').where('reportante_id', '==', uid).get(),
  ]);
  comments.docs.forEach((d) => writer.delete(d.ref));
  liked.docs.forEach((d) => writer.update(d.ref, { likes: FieldValue.arrayRemove(uid) }));
  owned.forEach((snap) => snap.docs.forEach((d) => writer.delete(d.ref)));
  if (email) {
    const mail = await db.collection('sandbox_mail').where('to', '==', email.toLowerCase()).get();
    mail.docs.forEach((d) => writer.delete(d.ref));
  }
  for (const col of ['forum_rate', 'mfa_state', 'mfa_challenges', 'public_profiles', SESSIONS]) {
    writer.delete(db.collection(col).doc(uid));
  }
  await writer.close();

  // Autorizaciones: `consents/{uid}_{tipo}` con su historial.
  const consents = await db.collection('consents')
    .where(FieldPath.documentId(), '>=', uid + '_')
    // Rango por prefijo: el carácter siguiente a '_' (0x5F) es 0x60.
    .where(FieldPath.documentId(), '<', uid + String.fromCharCode(0x60))
    .get();
  for (const doc of consents.docs) await db.recursiveDelete(doc.ref);

  await db.recursiveDelete(db.collection('users').doc(uid));
  await auth.deleteUser(uid).catch(() => undefined);
}

/** Cierra las visitas vencidas (pestañas cerradas sin pulsar "Salir"). */
async function collectExpired(db: Firestore, auth: Auth, now: Date) {
  const expired = await db.collection(SESSIONS).where('expiresAt', '<=', now).limit(20).get();
  for (const doc of expired.docs) {
    await cleanupVisitor(db, auth, doc.id, doc.data().email).catch((err) =>
      console.error('[sandbox] No se pudo limpiar la visita', doc.id, err)
    );
  }
}

async function activeCount(db: Firestore, now: Date) {
  const snap = await db.collection(SESSIONS).where('expiresAt', '>', now).count().get();
  return snap.data().count;
}

// ---------------------------------------------------------------------------
// Reinicio completo
// ---------------------------------------------------------------------------

/** Vacía el proyecto del sandbox y vuelve a sembrar los datos de ejemplo. */
export async function resetSandbox(db: Firestore, auth: Auth, now: Date = new Date()) {
  assertSandboxProject();
  const seed = buildSandboxSeed(now);
  const seedUids = new Set(seed.authUsers.map((u) => u.uid));

  for (const name of SANDBOX_COLLECTIONS) await db.recursiveDelete(db.collection(name));
  await db.recursiveDelete(db.collection(SESSIONS));

  // Cuentas: fuera las que no son del ejemplo; las del ejemplo, con sus roles originales.
  let pageToken: string | undefined;
  const stale: string[] = [];
  do {
    const page = await auth.listUsers(1000, pageToken);
    page.users.forEach((u) => { if (!seedUids.has(u.uid)) stale.push(u.uid); });
    pageToken = page.pageToken;
  } while (pageToken);
  for (let i = 0; i < stale.length; i += 1000) await auth.deleteUsers(stale.slice(i, i + 1000));

  for (const u of seed.authUsers) {
    await auth
      .updateUser(u.uid, { email: u.email, displayName: u.displayName, emailVerified: true })
      .catch(() => auth.createUser({ uid: u.uid, email: u.email, displayName: u.displayName, emailVerified: true }));
    await auth.setCustomUserClaims(u.uid, u.claims);
  }

  const writer = db.bulkWriter();
  seed.docs.forEach((d) => writer.set(db.doc(d.path), d.data));
  await writer.close();

  await closeDailyStats(db, getDateKeyInAppTz(now)).catch((err) => console.error('[sandbox] Resumen mensual:', err));
  await deleteCloudinaryPrefix(`${SANDBOX_UPLOAD_ROOT}/`);
  return { docs: seed.docs.length, accounts: seed.authUsers.length, removedAccounts: stale.length };
}

// ---------------------------------------------------------------------------
// Entrar y salir
// ---------------------------------------------------------------------------

export interface SandboxStart {
  token: string;
  uid: string;
  expiresAt: number;
}

export async function startSandboxSession(now: Date = new Date()): Promise<SandboxStart> {
  assertSandboxProject();
  const db = getAdminFirestore();
  const auth = getAdminAuth();

  await collectExpired(db, auth, now);
  const active = await activeCount(db, now);
  if (active >= SANDBOX_MAX_ACTIVE) {
    throw new SandboxError('El sandbox está lleno en este momento. Intenta en unos minutos.', 503);
  }

  // Si estás solo, empiezas con los datos de ejemplo intactos.
  const meta = await db.doc(META).get();
  if (!meta.exists || meta.data()?.seedVersion !== SEED_VERSION || (active === 0 && meta.data()?.dirty)) {
    await resetSandbox(db, auth, now);
  }

  const suffix = randomBytes(4).toString('hex');
  const created = await auth.createUser({ email: `explorador-${suffix}@${SANDBOX_EMAIL_DOMAIN}`, emailVerified: true });
  const uid = created.uid;
  const username = explorerName(uid);
  const expiresAt = new Date(now.getTime() + SANDBOX_SESSION_MS);
  await auth.updateUser(uid, { displayName: username });
  // Todos los roles: socio, recepción y administración (solo existen en este proyecto).
  await auth.setCustomUserClaims(uid, { admin: true, receptionist: true, sandbox: true, sandboxExpires: expiresAt.getTime() });

  const photoURL = '/Imagenes/Avatares/FitmanNEW.png';
  const batch = db.batch();
  batch.set(db.collection('users').doc(uid), {
    uid, username, email: created.email, avatar: 'fitman', photoURL, plan: null, createdAt: now, sandbox: true,
  });
  batch.set(db.collection('public_profiles').doc(uid), { username, photoURL, updatedAt: now });
  batch.set(db.collection(SESSIONS).doc(uid), { email: created.email, createdAt: now, expiresAt });
  batch.set(db.doc(META), { dirty: true }, { merge: true });
  await batch.commit();

  return { token: await auth.createCustomToken(uid), uid, expiresAt: expiresAt.getTime() };
}

export async function endSandboxSession(uid: string, email?: string | null) {
  assertSandboxProject();
  await cleanupVisitor(getAdminFirestore(), getAdminAuth(), uid, email);
}

/** Cron diario: cierra visitas vencidas y, si no hay nadie, deja el sandbox como nuevo. */
export async function nightlySandboxMaintenance(now: Date = new Date()) {
  assertSandboxProject();
  const db = getAdminFirestore();
  const auth = getAdminAuth();
  await collectExpired(db, auth, now);
  if ((await activeCount(db, now)) > 0) return { reset: false };
  return { reset: true, ...(await resetSandbox(db, auth, now)) };
}

/**
 * En el sandbox todos son admin: que nadie borre ni cambie la cuenta de OTRO visitante
 * desde el panel de usuarios (las cuentas de ejemplo sí se pueden tocar).
 */
export async function protectOtherExplorer(targetUid: string, actorUid: string): Promise<NextResponse | null> {
  if (!IS_SANDBOX || targetUid === actorUid) return null;
  const target = await getAdminAuth().getUser(targetUid).catch(() => null);
  if (target?.customClaims?.sandbox) {
    return NextResponse.json({ error: 'Es la cuenta de otro visitante del sandbox: no se puede modificar.' }, { status: 403 });
  }
  return null;
}
