import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyUserRequest } from '@/lib/auth-helpers';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';

/**
 * POST /api/forum/reports { postId, motivo } — reporta una publicación (F3-17).
 * El servidor toma los datos del post y del reportante (no del navegador), evita
 * reportes repetidos del mismo socio sobre el mismo post y limita 20 por hora.
 * Con 3 o más reportes distintos se avisa al admin.
 */
const ALERT_THRESHOLD = 3;

export async function POST(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });

  const rl = await limitAction(`report:${decoded.uid}`, 20, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = await request.json().catch(() => null);
  const postId = typeof body?.postId === 'string' && !body.postId.includes('/') ? body.postId : '';
  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim().slice(0, 500) : '';
  if (!postId || !motivo) return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });

  try {
    const db = getAdminFirestore();
    const postSnap = await db.collection('posts').doc(postId).get();
    if (!postSnap.exists) return NextResponse.json({ error: 'La publicación no existe.' }, { status: 404 });
    const post = postSnap.data() || {};
    const profile = (await db.collection('users').doc(decoded.uid).get()).data() || {};

    // Un reporte por socio y publicación (ID determinista).
    const ref = db.collection('reportes').doc(`${postId}_${decoded.uid}`);
    try {
      await ref.create({
        reportante: String(profile.username || 'Socio'),
        reportante_id: decoded.uid,
        publicacion_id: postId,
        autor_publicacion: post.autor_username || '',
        motivo,
        fecha_publicacion: post.created_at || null,
        fecha_reporte: new Date(),
        estado: 'pendiente',
      });
    } catch (err: any) {
      if (err?.code === 6) return NextResponse.json({ success: true, duplicate: true });
      throw err;
    }

    const count = (await db.collection('reportes').where('publicacion_id', '==', postId).where('estado', '==', 'pendiente').count().get()).data().count;
    if (count === ALERT_THRESHOLD) {
      await db.collection('notifications').add({
        tipo: 'report',
        mensaje: `La publicación de ${post.autor_username || 'un socio'} acumula ${count} reportes. Revísala en Comunidad.`,
        id_post: postId,
        leido: false,
        fecha: new Date(),
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[/api/forum/reports]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
