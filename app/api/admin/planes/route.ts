import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { recordAuditLog } from '@/lib/audit-logger';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { ValidationError, parseDocId, parsePlanCreate, parsePlanUpdate } from '@/lib/admin-validation';

/** Respuesta de error sin filtrar detalles internos (F1-03). */
function errorResponse(error: unknown, context: string) {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(`Error en ${context}:`, error);
  return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
}

export async function GET(request: Request) {
  // Verificación server-side: el middleware solo comprueba que la cookie exista (T-05, auditoría C-4)
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection('planes').orderBy('price', 'asc').get();
    const planes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(planes);
  } catch (error) {
    return errorResponse(error, 'GET /api/admin/planes');
  }
}

export async function PATCH(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const body = await request.json();
    const id = parseDocId(body?.id);
    // F1-04: solo campos conocidos y tipados (antes `...data` sin filtrar).
    const updates = parsePlanUpdate(body);
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos válidos para actualizar.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const docRef = db.collection('planes').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    const oldData = docSnap.data();

    await docRef.update({
      ...updates,
      updatedAt: new Date()
    });

    await recordAuditLog({
      action: 'UPDATE_PLAN',
      category: 'PLAN_MANAGEMENT',
      details: `Plan ${id} actualizado. Campos: ${Object.keys(updates).join(', ')}. Precio anterior: ${oldData?.price}, nuevo: ${updates.price ?? oldData?.price}. Días anterior: ${oldData?.days}, nuevo: ${updates.days ?? oldData?.days}`,
      adminEmail: isAdmin.email,
      actorUid: isAdmin.uid,
      targetId: id,
      before: oldData,
      after: updates,
      request: request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'PATCH /api/admin/planes');
  }
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    // F1-04 / B3: un plan nuevo exige nombre, precio y duración (`days`).
    const data = parsePlanCreate(await request.json());
    const db = getAdminFirestore();

    const docRef = await db.collection('planes').add({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await recordAuditLog({
      action: 'CREATE_PLAN',
      category: 'PLAN_MANAGEMENT',
      details: `Nuevo plan creado: ${data.name} con precio ${data.price} y ${data.days} días`,
      adminEmail: isAdmin.email,
      actorUid: isAdmin.uid,
      targetId: docRef.id,
      request: request,
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    return errorResponse(error, 'POST /api/admin/planes');
  }
}

export async function DELETE(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const id = parseDocId(searchParams.get('id'));

    const db = getAdminFirestore();
    const deleted = (await db.collection('planes').doc(id).get()).data() || null;
    await db.collection('planes').doc(id).delete();

    await recordAuditLog({
      action: 'DELETE_PLAN',
      category: 'PLAN_MANAGEMENT',
      details: `Plan ${id} eliminado.`,
      adminEmail: isAdmin.email,
      actorUid: isAdmin.uid,
      targetId: id,
      before: deleted,
      request: request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'DELETE /api/admin/planes');
  }
}
