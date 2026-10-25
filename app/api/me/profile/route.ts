import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyUserRequest } from '@/lib/auth-helpers';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';
import { getAvatarUrlById } from '@/lib/avatar-utils';
import { isSafeImageUrl, publicProfileOf } from '@/lib/public-profile';

/**
 * PATCH /api/me/profile — nombre, avatar o foto del propio usuario (F1-09).
 *
 * Body: `{ username?, avatar?, photoURL? }`. Actualiza `users/{uid}` y su perfil
 * público `public_profiles/{uid}` en un solo batch: el foro resuelve la foto por
 * autor, así que ya no se reescriben los posts ni los comentarios.
 */
export async function PATCH(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });

  const rl = await limitAction(`profile:${decoded.uid}`, 30, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, string> = {};

  if (body?.username !== undefined) {
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (username.length < 2 || username.length > 40) {
      return NextResponse.json({ error: 'El nombre debe tener entre 2 y 40 caracteres.' }, { status: 400 });
    }
    updates.username = username;
  }
  if (body?.avatar !== undefined) {
    const url = typeof body.avatar === 'string' ? getAvatarUrlById(body.avatar) : null;
    if (!url) return NextResponse.json({ error: 'Avatar no válido.' }, { status: 400 });
    updates.avatar = body.avatar;
    updates.photoURL = url;
  }
  if (body?.photoURL !== undefined) {
    if (!isSafeImageUrl(body.photoURL)) return NextResponse.json({ error: 'Imagen no permitida.' }, { status: 400 });
    updates.photoURL = body.photoURL;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No hay cambios.' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(decoded.uid);
    const current = (await userRef.get()).data();
    if (!current) return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 404 });

    const batch = db.batch();
    batch.update(userRef, updates);
    batch.set(db.collection('public_profiles').doc(decoded.uid), {
      ...publicProfileOf({ ...current, ...updates }),
      updatedAt: new Date(),
    });
    await batch.commit();

    return NextResponse.json({ success: true, photoURL: updates.photoURL ?? current.photoURL ?? null });
  } catch (error) {
    console.error('[/api/me/profile]', error);
    return NextResponse.json({ error: 'No se pudo actualizar el perfil.' }, { status: 500 });
  }
}
