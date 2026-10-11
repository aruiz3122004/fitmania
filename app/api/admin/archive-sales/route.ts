import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';

export async function POST(req: Request) {
  try {
    // Verificar que el solicitante es un administrador real (vía cookie HttpOnly o Bearer token)
    const decodedToken = await verifyAdminRequest(req);
    if (!decodedToken) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const adminDb = getAdminFirestore();
    const ordersRef = adminDb.collection('orders');
    const snapshot = await ordersRef.where('archived', '!=', true).get();

    if (snapshot.empty) {
      return NextResponse.json({ message: 'No hay ventas activas para archivar' }, { status: 200 });
    }

    // Usar Batch de Firebase para escrituras masivas seguras
    const batch = adminDb.batch();

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { archived: true });
    });

    await batch.commit();

    await recordAuditLog({
      action: 'ARCHIVE_SALES',
      category: 'ADMIN_ACTION',
      details: `Se realizó un archivo masivo de caja (Corte de mes). Ventas archivadas: ${snapshot.docs.length}`,
      adminEmail: decodedToken.email,
      targetId: 'ALL_SALES',
      request: req,
    });

    return NextResponse.json({ message: 'Ventas archivadas con éxito. Contador de ingresos puesto a 0.' }, { status: 200 });
  } catch (error) {
    console.error('Error archivando ventas:', error);
    return NextResponse.json({ error: 'Fallo al procesar operación' }, { status: 500 });
  }
}
