import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';
import { deletePostCompletely } from '@/lib/forum-server';

/**
 * Moderación de reportes del foro (F3-17).
 * GET → reportes pendientes agrupados por publicación (con el contenido actual).
 * POST { postId, action: 'dismiss' | 'remove_post' } → resuelve TODOS los reportes de ese post.
 */
type ReportGroup = { postId: string; autor: string; motivos: string[]; reportantes: string[]; count: number };

export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const db = getAdminFirestore();
    const snap = await db.collection('reportes').get();
    const groups = new Map<string, ReportGroup>();
    for (const doc of snap.docs) {
      const r = doc.data();
      if (r.estado && r.estado !== 'pendiente') continue;
      const postId = String(r.publicacion_id || '');
      if (!postId) continue;
      const g: ReportGroup = groups.get(postId) || { postId, autor: r.autor_publicacion || '', motivos: [], reportantes: [], count: 0 };
      g.count++;
      if (r.motivo && !g.motivos.includes(r.motivo)) g.motivos.push(r.motivo);
      if (r.reportante && g.reportantes.length < 10) g.reportantes.push(r.reportante);
      groups.set(postId, g);
    }

    const list = Array.from(groups.values()).sort((a, b) => b.count - a.count);
    const posts = list.length ? await db.getAll(...list.map((g) => db.collection('posts').doc(g.postId))) : [];
    const result = list.map((g, i) => {
      const p = posts[i]?.data();
      return {
        ...g,
        exists: !!posts[i]?.exists,
        contenido: p?.contenido ? String(p.contenido).slice(0, 500) : null,
        imagen_url: p?.imagen_url || null,
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[/api/admin/reports GET]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const body = await request.json().catch(() => null);
    const postId = typeof body?.postId === 'string' && !body.postId.includes('/') ? body.postId : '';
    const action = body?.action;
    if (!postId || (action !== 'dismiss' && action !== 'remove_post')) {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    let removedAuthor = '';
    if (action === 'remove_post') {
      const result = await deletePostCompletely(db, postId);
      removedAuthor = result.found ? String(result.post.autor_username || '') : '';
    }

    const reports = await db.collection('reportes').where('publicacion_id', '==', postId).get();
    const writer = db.bulkWriter();
    reports.docs.forEach((doc) =>
      writer.update(doc.ref, {
        estado: action === 'remove_post' ? 'post_eliminado' : 'descartado',
        resueltoPor: isAdmin.email || null,
        resueltoEn: new Date(),
      })
    );
    await writer.close();

    await recordAuditLog({
      action: action === 'remove_post' ? 'MODERATION_REMOVE_POST' : 'MODERATION_DISMISS',
      category: 'ADMIN_ACTION',
      details: action === 'remove_post'
        ? `Post ${postId} de ${removedAuthor || 'autor desconocido'} eliminado por moderación (${reports.size} reportes).`
        : `Reportes del post ${postId} descartados (${reports.size}).`,
      adminEmail: isAdmin.email,
      actorUid: isAdmin.uid,
      targetId: postId,
      request,
    });

    return NextResponse.json({ success: true, resolved: reports.size });
  } catch (error) {
    console.error('[/api/admin/reports POST]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
