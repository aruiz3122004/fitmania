import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { deletePostCompletely } from '@/lib/forum-server';

/**
 * Supresión de la cuenta de un socio (F3-11 derecho de supresión, F2-26 retención).
 *
 * - Se BORRA: perfil, cuenta de Auth, publicaciones del foro (con sus comentarios y
 *   archivos), comentarios propios en posts ajenos y sus likes.
 * - Se ANONIMIZA: ingresos (entry_logs, checkIns), PQRS y reportes: se conservan
 *   para estadísticas y obligaciones de atención al consumidor, sin nombre ni correo.
 * - Se CONSERVA: órdenes de compra (obligación contable, Código de Comercio art. 60)
 *   y la prueba de los consentimientos.
 */
const ANON_NAME = 'Socio eliminado';

export interface DeletionSummary {
  posts: number;
  comments: number;
  likes: number;
  entries: number;
  pqrs: number;
  reports: number;
}

export async function deleteMemberAccount(db: Firestore, auth: Auth, uid: string): Promise<DeletionSummary> {
  const summary: DeletionSummary = { posts: 0, comments: 0, likes: 0, entries: 0, pqrs: 0, reports: 0 };

  // 1. Publicaciones propias (con comentarios y archivos).
  const posts = await db.collection('posts').where('autor_id', '==', uid).get();
  for (const post of posts.docs) {
    await deletePostCompletely(db, post.id);
    summary.posts++;
  }

  const writer = db.bulkWriter();

  // 2. Comentarios propios en publicaciones ajenas.
  const comments = await db.collectionGroup('comments').where('autor_id', '==', uid).get();
  comments.docs.forEach((doc) => { writer.delete(doc.ref); summary.comments++; });

  // 3. Likes.
  const liked = await db.collection('posts').where('likes', 'array-contains', uid).get();
  liked.docs.forEach((doc) => { writer.update(doc.ref, { likes: FieldValue.arrayRemove(uid) }); summary.likes++; });

  // 4. Ingresos: se conservan para las estadísticas, sin datos identificables.
  const [entries, checkIns] = await Promise.all([
    db.collection('entry_logs').where('userId', '==', uid).get(),
    db.collection('checkIns').where('userId', '==', uid).get(),
  ]);
  entries.docs.forEach((doc) => { writer.update(doc.ref, { userName: ANON_NAME, userEmail: '', anonymizedAt: new Date() }); summary.entries++; });
  checkIns.docs.forEach((doc) => writer.update(doc.ref, { userName: ANON_NAME }));

  // 5. PQRS y reportes.
  const [pqrs, reports] = await Promise.all([
    db.collection('pqrs').where('userId', '==', uid).get(),
    db.collection('reportes').where('reportante_id', '==', uid).get(),
  ]);
  pqrs.docs.forEach((doc) => { writer.update(doc.ref, { userName: ANON_NAME, userEmail: '', anonymizedAt: new Date() }); summary.pqrs++; });
  reports.docs.forEach((doc) => { writer.update(doc.ref, { reportante: ANON_NAME }); summary.reports++; });

  // 6. Perfil.
  writer.delete(db.collection('users').doc(uid));
  await writer.close();

  // 7. Cuenta de autenticación (al final: si algo falla antes, el usuario puede reintentar).
  try {
    await auth.deleteUser(uid);
  } catch (err: any) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }

  return summary;
}
