import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';

/**
 * Noticias del foro administradas desde el panel (F3-16).
 * GET → todas · POST → crear · PATCH { id, ...campos } → editar/publicar · DELETE ?id=
 */
function parseNews(body: any, partial: boolean) {
  const out: Record<string, unknown> = {};
  const titulo = typeof body?.titulo === 'string' ? body.titulo.trim() : undefined;
  const descripcion = typeof body?.descripcion === 'string' ? body.descripcion.trim() : undefined;
  const imagen = typeof body?.imagen_url === 'string' ? body.imagen_url.trim() : undefined;

  if (titulo !== undefined) {
    if (!titulo || titulo.length > 100) throw new Error('El título es obligatorio (máx. 100 caracteres).');
    out.titulo = titulo;
  } else if (!partial) throw new Error('El título es obligatorio.');

  if (descripcion !== undefined) {
    if (descripcion.length > 500) throw new Error('La descripción supera 500 caracteres.');
    out.descripcion = descripcion;
  } else if (!partial) out.descripcion = '';

  if (imagen !== undefined) {
    if (imagen && !/^(https:\/\/|\/)/.test(imagen)) throw new Error('La imagen debe ser una URL https o una ruta local.');
    out.imagen_url = imagen || null;
  }
  if (body?.published !== undefined) out.published = body.published === true;
  if (body?.publishAt !== undefined) {
    const at = body.publishAt ? new Date(body.publishAt) : null;
    if (at && Number.isNaN(at.getTime())) throw new Error('Fecha de publicación inválida.');
    out.publishAt = at;
  }
  return out;
}

export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const snap = await getAdminFirestore().collection('news').get();
    const list = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          titulo: d.titulo,
          descripcion: d.descripcion,
          imagen_url: d.imagen_url || null,
          published: !!d.published,
          publishAt: d.publishAt?.toDate ? d.publishAt.toDate().toISOString() : null,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null,
        };
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return NextResponse.json(list);
  } catch (error) {
    console.error('[/api/admin/news GET]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  let data: Record<string, unknown>;
  try {
    data = parseNews(await request.json(), false);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  try {
    const ref = await getAdminFirestore().collection('news').add({
      published: false,
      publishAt: null,
      imagen_url: null,
      ...data,
      createdAt: new Date(),
      createdBy: isAdmin.email || null,
    });
    await recordAuditLog({ action: 'CREATE_NEWS', category: 'ADMIN_ACTION', details: `Noticia creada: ${data.titulo}`, adminEmail: isAdmin.email, targetId: ref.id, request });
    return NextResponse.json({ success: true, id: ref.id });
  } catch (error) {
    console.error('[/api/admin/news POST]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  let id: string;
  let data: Record<string, unknown>;
  try {
    const body = await request.json();
    id = typeof body?.id === 'string' && !body.id.includes('/') ? body.id : '';
    if (!id) throw new Error('ID requerido.');
    data = parseNews(body, true);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  try {
    await getAdminFirestore().collection('news').doc(id).update({ ...data, updatedAt: new Date() });
    await recordAuditLog({ action: 'UPDATE_NEWS', category: 'ADMIN_ACTION', details: `Noticia ${id} actualizada: ${Object.keys(data).join(', ')}`, adminEmail: isAdmin.email, targetId: id, request });
    // TODO(F3-14): al publicar, enviar push a los suscritos al tema "news".
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[/api/admin/news PATCH]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id || id.includes('/')) return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });
  try {
    await getAdminFirestore().collection('news').doc(id).delete();
    await recordAuditLog({ action: 'DELETE_NEWS', category: 'ADMIN_ACTION', details: `Noticia ${id} eliminada.`, adminEmail: isAdmin.email, targetId: id, request });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[/api/admin/news DELETE]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
