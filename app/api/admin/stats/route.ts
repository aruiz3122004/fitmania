import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    // Verificar token en el header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Falta Token' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Inicializar servicios bajo demanda
    const auth = getAdminAuth();
    const db = getAdminFirestore();

    const decodedToken = await auth.verifyIdToken(idToken);

    if (!decodedToken.admin) {
      return NextResponse.json({ error: 'Sin privilegios de administrador' }, { status: 403 });
    }

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
