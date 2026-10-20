import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';
import { ValidationError, parseDocId, parseProductCreate, parseProductUpdate } from '@/lib/admin-validation';

/** Respuesta de error sin filtrar detalles internos (F1-03). */
function errorResponse(error: unknown, context: string) {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(`Error en ${context}:`, error);
  return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
}

/** Slug estable para el ID del producto: minúsculas, sin tildes ni símbolos. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection('products').orderBy('created_at', 'desc').get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(products);
  } catch (error) {
    return errorResponse(error, 'GET /api/admin/products');
  }
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const body = await request.json();
    // F1-04: solo campos conocidos y tipados (antes `...data` sin filtrar).
    const data = parseProductCreate(body);
    const db = getAdminFirestore();

    const id = body?.id ? parseDocId(body.id) : slugify(String(data.nombre));
    if (!id) return NextResponse.json({ error: 'No se pudo generar un ID para el producto.' }, { status: 400 });

    const docRef = db.collection('products').doc(id);
    // `create` falla si ya existe: evita sobrescribir otro producto con el mismo nombre.
    try {
      await docRef.create({ ...data, created_at: new Date() });
    } catch (err: any) {
      if (err?.code === 6 /* ALREADY_EXISTS */) {
        return NextResponse.json({ error: `Ya existe un producto con el ID "${id}".` }, { status: 409 });
      }
      throw err;
    }

    await recordAuditLog({
      action: 'CREATE_PRODUCT',
      category: 'ADMIN_ACTION',
      details: `Producto creado: ${data.nombre} | ID Asignado: ${id} | Stock: ${data.stock ?? 0}`,
      adminEmail: isAdmin.email,
      targetId: id,
      request,
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return errorResponse(error, 'POST /api/admin/products');
  }
}

export async function PATCH(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const body = await request.json();
    const id = parseDocId(body?.id);
    const updates = parseProductUpdate(body);
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos válidos para actualizar.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const docRef = db.collection('products').doc(id);
    const before = await docRef.get();
    if (!before.exists) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    await docRef.update(updates);

    const stockChange = updates.stock !== undefined ? ` | Stock: ${before.data()?.stock} → ${updates.stock}` : '';
    await recordAuditLog({
      action: 'UPDATE_PRODUCT',
      category: 'ADMIN_ACTION',
      details: `Producto actualizado. ID: ${id} | Campos: ${Object.keys(updates).join(', ')}${stockChange}`,
      adminEmail: isAdmin.email,
      targetId: id,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'PATCH /api/admin/products');
  }
}

export async function DELETE(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const id = parseDocId(searchParams.get('id'));

    const db = getAdminFirestore();
    await db.collection('products').doc(id).delete();

    await recordAuditLog({
      action: 'DELETE_PRODUCT',
      category: 'ADMIN_ACTION',
      details: `Producto eliminado permanentemente. ID de stock borrado: ${id}`,
      adminEmail: isAdmin.email,
      targetId: id,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'DELETE /api/admin/products');
  }
}
