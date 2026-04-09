import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

async function validateAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const idToken = authHeader.split('Bearer ')[1];
  const auth = getAdminAuth();
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken.admin ? decodedToken : null;
  } catch (err) {
    return null;
  }
}

export async function GET(request: Request) {
  const isAdmin = await validateAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const auth = getAdminAuth();
    const db = getAdminFirestore();

    // Obtener usuarios de Auth
    const listUsersResult = await auth.listUsers(1000);
    
    // Obtener todos los documentos de la colección users en Firestore
    const snapshot = await db.collection('users').get();
    const firestoreUsers: Record<string, any> = {};
    snapshot.forEach(doc => {
      firestoreUsers[doc.id] = doc.data();
    });

    const users = listUsersResult.users.map(user => {
      const fsData = firestoreUsers[user.uid] || {};
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || fsData.username || 'Usuario sin nombre',
        photoURL: user.photoURL || fsData.photoURL || null,
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime,
        admin: user.customClaims?.admin || false,
        plan: fsData.plan || null,
        // Incluir otros datos relevantes de firestore si existen
        ...fsData
      };
    });

    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const isAdmin = await validateAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { uid, plan, admin: setAdmin } = await request.json();
    if (!uid) return NextResponse.json({ error: 'UID requerido' }, { status: 400 });

    const auth = getAdminAuth();
    const db = getAdminFirestore();

    // Actualizar claims de administrador si se solicita
    if (setAdmin !== undefined) {
      await auth.setCustomUserClaims(uid, { admin: !!setAdmin });
    }

    // Actualizar campos en Firestore (especialmente el plan)
    const updates: any = {};
    if (plan !== undefined) updates.plan = plan; // Si viene null, se remueve el plan

    if (Object.keys(updates).length > 0) {
      await db.collection('users').doc(uid).update(updates);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const isAdmin = await validateAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    if (!uid) return NextResponse.json({ error: 'UID requerido' }, { status: 400 });

    const auth = getAdminAuth();
    const db = getAdminFirestore();

    // 1. Eliminar de Auth
    await auth.deleteUser(uid);
    // 2. Eliminar de Firestore
    await db.collection('users').doc(uid).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
