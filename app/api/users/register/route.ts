import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { avatarOptions, getAvatarUrlById } from '@/lib/avatar-utils';

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
    const peso = optionalNumber(body?.peso, 20, 400);
    const altura = optionalNumber(body?.altura, 50, 260);

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
    // TODO(F3-10): guardar peso/altura solo con consentimiento explícito de datos sensibles.
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

    const { createdAt: _createdAt, ...publicProfile } = profile;
    return NextResponse.json({ success: true, profile: publicProfile });
  } catch (error) {
    console.error('[/api/users/register]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
