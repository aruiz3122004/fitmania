import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { listAllAuthUsers } from '@/lib/admin-users';

export async function GET(request: Request) {
  try {
    const decodedToken = await verifyAdminRequest(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const db = getAdminFirestore();

    // F2-20: totales sin transferir listas completas. `count()` cuesta 1 lectura
    // por cada 1000 documentos (antes se leía toda la colección `pqrs`), y la
    // lista de usuarios ya la entrega /api/admin/users.
    const [authUsers, pqrsCount] = await Promise.all([
      listAllAuthUsers(),
      db.collection('pqrs').count().get(),
    ]);

    return NextResponse.json({
      totalUsers: authUsers.length,
      admins: authUsers.filter((u) => u.customClaims?.admin).length,
      totalPqrs: pqrsCount.data().count,
    }, { status: 200 });

  } catch (error: any) {
    // F1-03: el detalle queda en logs; el cliente recibe un mensaje genérico.
    console.error('[/api/admin/stats]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
