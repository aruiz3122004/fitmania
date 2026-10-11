import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const db = getAdminFirestore();

    // T-18: este GET es SOLO LECTURA. La generación de avisos de "plan por vencer"
    // la ejecuta el job programado (`/api/cron/notifications`), no una carga del panel.
    const snapshot = await db.collection('notifications').orderBy('fecha', 'desc').limit(50).get();
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json(notifications);
  } catch (error: any) {
    console.error('Error in notifications GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Marcar como leída
export async function PATCH(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const db = getAdminFirestore();
    await db.collection('notifications').doc(id).update({ leido: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Limpiar leídas
export async function DELETE(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection('notifications').where('leido', '==', true).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
