import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { avatarOptions, getAvatarUrlById } from '@/lib/avatar-utils';
import { recordConsent } from '@/lib/consents';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';
import { getClientIp } from '@/lib/client-ip';
import { publicProfileOf } from '@/lib/public-profile';

/**
 * POST /api/users/register — crea el perfil del usuario recién registrado (F1-06).
 *
 * El documento `users/{uid}` lo crea el servidor a partir del ID token: el uid y
 * el correo salen del token (no del body) y el plan siempre nace vacío. Así las
 * reglas pueden prohibir que el cliente cree su propio documento.
 */
const GENDERS = new Set(['masculino', 'femenino', 'otro']);
const AVATAR_IDS = new Set<string>(avatarOptions.map((a) => a.id));

function optionalNumber(value: unknown, min: number, max: number): number | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return 'invalid';
  return n;
}

export async function POST(request: Request) {
  // F1-10: 10 altas por hora por IP (holgado por la IP compartida del gimnasio).
  const rl = await limitAction(`register:ip:${getClientIp(request.headers)}`, 10, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Demasiados registros desde esta red. Intenta más tarde.');

  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
    email = decoded.email;
  } catch {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const gender = typeof body?.gender === 'string' ? body.gender : '';
    const avatar = typeof body?.avatar === 'string' && AVATAR_IDS.has(body.avatar) ? body.avatar : 'fitman';
    // F3-10: aceptar términos y política es obligatorio; los datos de salud solo con
    // autorización expresa y separada (si no, se descartan aunque lleguen).
    if (body?.acceptedTerms !== true) {
      return NextResponse.json({ error: 'Debes aceptar los términos y la política de tratamiento de datos.' }, { status: 400 });
    }
    const sensitiveConsent = body?.sensitiveConsent === true;
    const peso = sensitiveConsent ? optionalNumber(body?.peso, 20, 400) : null;
    const altura = sensitiveConsent ? optionalNumber(body?.altura, 50, 260) : null;

    if (username.length < 2 || username.length > 40) {
      return NextResponse.json({ error: 'El nombre de usuario debe tener entre 2 y 40 caracteres.' }, { status: 400 });
    }
    if (gender && !GENDERS.has(gender)) {
      return NextResponse.json({ error: 'Género inválido.' }, { status: 400 });
    }
    if (peso === 'invalid' || altura === 'invalid') {
      return NextResponse.json({ error: 'Peso o altura fuera de rango.' }, { status: 400 });
    }

    const profile: Record<string, unknown> = {
      uid,
      username,
      email: email || '',
      avatar,
      photoURL: getAvatarUrlById(avatar) || null,
      plan: null,
      createdAt: new Date(),
    };
    if (gender) profile.gender = gender;
    if (peso !== null) profile.peso = peso;
    if (altura !== null) profile.altura = altura;

    try {
      // `create` falla si ya existe: nadie puede pisar un perfil (ni su plan) re-registrándose.
      await getAdminFirestore().collection('users').doc(uid).create(profile);
    } catch (err: any) {
      if (err?.code === 6 /* ALREADY_EXISTS */) {
        return NextResponse.json({ error: 'El perfil ya existe.' }, { status: 409 });
      }
      throw err;
    }

    const db = getAdminFirestore();
    await Promise.all([
      // F1-09: nombre y foto públicos para el foro.
      db.collection('public_profiles').doc(uid).set({ ...publicProfileOf(profile), updatedAt: new Date() }),
      recordConsent(db, uid, 'terms', true, request),
      recordConsent(db, uid, 'privacy', true, request),
      recordConsent(db, uid, 'sensitive_data', sensitiveConsent, request),
    ]);

    const { createdAt: _createdAt, ...publicProfile } = profile;
    return NextResponse.json({ success: true, profile: publicProfile });
  } catch (error) {
    console.error('[/api/users/register]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
