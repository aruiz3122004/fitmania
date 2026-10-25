import type { Firestore } from 'firebase-admin/firestore';
import { deleteCloudinaryAsset } from '@/lib/cloudinary-server';

/**
 * Elimina un post con todo lo asociado (F1-07 / F1-25): sus comentarios en la
 * subcolección y su archivo en Cloudinary. Borrar el documento desde el cliente
 * dejaba comentarios y archivos huérfanos.
 */
export async function deletePostCompletely(db: Firestore, postId: string) {
  const ref = db.collection('posts').doc(postId);
  const snap = await ref.get();
  if (!snap.exists) return { found: false as const };
  const post = snap.data() || {};

  await db.recursiveDelete(ref); // documento + subcolección `comments`
  const fileDeleted = await deleteCloudinaryAsset(post.imagen_public_id, post.tipo_recurso === 'video' ? 'video' : 'image');

  return { found: true as const, post, fileDeleted };
}
