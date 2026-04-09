import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

// Helper para validar admin
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
    const db = getAdminFirestore();
    const snapshot = await db.collection('products').orderBy('created_at', 'desc').get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const isAdmin = await validateAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const data = await request.json();
    const db = getAdminFirestore();
    
    // Si no viene ID, usamos uno autogenerado o el nombre slugificado
    const id = data.id || data.nombre.toLowerCase().replace(/\s+/g, '-');
    
    await db.collection('products').doc(id).set({
      ...data,
      created_at: new Date(),
    });
    
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const isAdmin = await validateAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const db = getAdminFirestore();
    await db.collection('products').doc(id).update(updates);
    
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
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const db = getAdminFirestore();
    await db.collection('products').doc(id).delete();
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
