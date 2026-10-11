import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    const decodedToken = await verifyAdminRequest(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const auth = getAdminAuth();
    const db = getAdminFirestore();

    // Listar todos los usuarios
    const listUsersResult = await auth.listUsers(1000);
    const users = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email,
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime,
      admin: user.customClaims?.admin || false
    }));

    // Obtener estadísticas de firestore
    const pqrsSnapshot = await db.collection('pqrs').get();
    const totalPqrs = pqrsSnapshot.size;

    return NextResponse.json({
      totalUsers: users.length,
      admins: users.filter(u => u.admin).length,
      totalPqrs,
      users 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error en API Admin Stats:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
