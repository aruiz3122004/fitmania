import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    
    // BASIC SECURITY: In a production app, verify a proper custom claim or Firebase auth token.
    // Here we use the triple-layer code we injected just to prevent simple unauthorized crawling.
    if (token !== 'FitmaniaAdmin2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminDb = getAdminFirestore();
    const ordersRef = adminDb.collection('orders');
    // Solamente archiva ordenes que NO esten archivadas
    const snapshot = await ordersRef.where('archived', '!=', true).get();

    if (snapshot.empty) {
      return NextResponse.json({ message: 'No hay ventas activas para archivar' }, { status: 200 });
    }

    // Usar Batch de Firebase para escrituras masivas seguras
    const batch = adminDb.batch();
    
    snapshot.docs.forEach((doc) => {
      // Copiar la informacion pero marcándola como "archived" (Histórica)
      batch.update(doc.ref, { archived: true });
    });

    await batch.commit();

    return NextResponse.json({ message: 'Ventas archivadas con éxito. Contador de ingresos puesto a 0.' }, { status: 200 });
  } catch (error) {
    console.error('Error archivando ventas:', error);
    return NextResponse.json({ error: 'Fallo al procesar operación' }, { status: 500 });
  }
}
