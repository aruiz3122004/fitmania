import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { recordAuditLog } from '@/lib/audit-logger';

export async function GET() {
  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection('planes').orderBy('price', 'asc').get();
    const planes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(planes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...data } = await request.json();
    const db = getAdminFirestore();
    
    // Obtener datos actuales para el log
    const docRef = db.collection('planes').doc(id);
    const docSnap = await docRef.get();
    const oldData = docSnap.data();

    // Actualizar
    await docRef.update({
      ...data,
      updatedAt: new Date()
    });

    // Registrar en auditoría
    await recordAuditLog({
      action: 'UPDATE_PLAN',
      category: 'PLAN_MANAGEMENT',
      details: `Plan ${id} actualizado. Precio anterior: ${oldData?.price}, Nuevo: ${data.price}`,
      targetId: id,
      request: request,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const db = getAdminFirestore();
    
    const docRef = await db.collection('planes').add({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await recordAuditLog({
      action: 'CREATE_PLAN',
      category: 'PLAN_MANAGEMENT',
      details: `Nuevo plan creado: ${data.name} con precio ${data.price}`,
      targetId: docRef.id,
      request: request,
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const db = getAdminFirestore();
    await db.collection('planes').doc(id).delete();

    await recordAuditLog({
      action: 'DELETE_PLAN',
      category: 'PLAN_MANAGEMENT',
      details: `Plan ${id} eliminado.`,
      targetId: id,
      request: request,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
