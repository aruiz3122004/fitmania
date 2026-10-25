import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { isMfaSatisfied, mfaRequiredResponse } from '@/lib/mfa-server';
import { deletePostCompletely } from '@/lib/forum-server';

/**
 * DELETE /api/forum/posts/:postId — el autor (o un admin) elimina su post junto con
 * sus comentarios y su archivo en Cloudinary (F1-25).
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
  }
  if (!(await isMfaSatisfied(decoded))) return mfaRequiredResponse();

  const { postId } = await params;
  if (!postId || postId.includes('/')) return NextResponse.json({ error: 'Post inválido.' }, { status: 400 });

  try {
    const db = getAdminFirestore();
    const snap = await db.collection('posts').doc(postId).get();
    if (!snap.exists) return NextResponse.json({ error: 'Post no encontrado.' }, { status: 404 });
    if (snap.data()?.autor_id !== decoded.uid && decoded.admin !== true) {
      return NextResponse.json({ error: 'Solo el autor puede eliminar este post.' }, { status: 403 });
    }

    await deletePostCompletely(db, postId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[/api/forum/posts/:postId DELETE]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
