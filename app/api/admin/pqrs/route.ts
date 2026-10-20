import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const db = getAdminFirestore();
    // `fecha` es un texto formateado ("20 de octubre..."): ordenar por él no es cronológico.
    // Se ordena en memoria por `createdAt` (los documentos sin ese campo quedan al final).
    const snapshot = await db.collection('pqrs').get();
    const millis = (v: any) => (v?.toMillis ? v.toMillis() : v?._seconds ? v._seconds * 1000 : 0);
    const pqrs = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Record<string, any>))
      .sort((a, b) => millis(b.createdAt) - millis(a.createdAt));

    return NextResponse.json(pqrs);
  } catch (error: any) {
    // F1-03: el detalle queda en logs; el cliente recibe un mensaje genérico.
    console.error('[/api/admin/pqrs]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
