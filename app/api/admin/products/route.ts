import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';

export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
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
  const isAdmin = await verifyAdminRequest(request);
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

    await recordAuditLog({
      action: 'CREATE_PRODUCT',
      category: 'ADMIN_ACTION',
      details: `Producto creado: ${data.nombre} | ID Asignado: ${id}`,
      adminEmail: isAdmin.email,
      targetId: id,
      request,
    });
    
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const db = getAdminFirestore();
    await db.collection('products').doc(id).update(updates);

    await recordAuditLog({
      action: 'UPDATE_PRODUCT',
      category: 'ADMIN_ACTION',
      details: `Producto actualizado. ID: ${id} | Campos: ${Object.keys(updates).join(', ')}`,
      adminEmail: isAdmin.email,
      targetId: id,
      request,
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const db = getAdminFirestore();
    await db.collection('products').doc(id).delete();

    await recordAuditLog({
      action: 'DELETE_PRODUCT',
      category: 'ADMIN_ACTION',
      details: `Producto eliminado permanentemente. ID de stock borrado: ${id}`,
      adminEmail: isAdmin.email,
      targetId: id,
      request,
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
