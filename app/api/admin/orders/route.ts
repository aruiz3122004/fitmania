import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection('orders').orderBy('fecha', 'desc').limit(500).get();
    const orders = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((doc: any) => doc.archived !== true);

    return NextResponse.json(orders);
  } catch (error: any) {
    // F1-03: el detalle queda en logs; el cliente recibe un mensaje genérico.
    console.error('[/api/admin/orders]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
