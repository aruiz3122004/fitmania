import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';

/**
 * Conteos físicos reportados por recepción (F3-07).
 *
 * GET  → conteos pendientes de revisión.
 * POST { id, action: 'approve' | 'reject' } → al aprobar, el stock pasa al valor
 *      contado en una transacción y queda un `inventory_movements` (F2-25) + auditoría.
 */
export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const snap = await getAdminFirestore().collection('inventory_counts').where('status', '==', 'pending').get();
    const counts = snap.docs
      .map((doc) => {
        const d = doc.data();
        const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : null;
        return {
          id: doc.id,
          productId: d.productId,
          productName: d.productName,
          counted: d.counted,
          systemStock: d.systemStock,
          difference: d.difference,
          note: d.note || null,
          reportedBy: d.reportedBy || null,
          createdAt: createdAt ? createdAt.toISOString() : null,
        };
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return NextResponse.json(counts);
  } catch (error) {
    console.error('[/api/admin/inventory-counts GET]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const body = await request.json().catch(() => null);
    const id = typeof body?.id === 'string' ? body.id : '';
    const action = body?.action;
    if (!id || id.includes('/') || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const countRef = db.collection('inventory_counts').doc(id);

    const result = await db.runTransaction(async (tx) => {
      const countSnap = await tx.get(countRef);
      if (!countSnap.exists) return { status: 404 as const };
      const count = countSnap.data()!;
      if (count.status !== 'pending') return { status: 409 as const };

      const now = new Date();
      if (action === 'reject') {
        tx.update(countRef, { status: 'rejected', reviewedBy: isAdmin.email || null, reviewedAt: now });
        return { status: 200 as const, count, before: null };
      }

      const productRef = db.collection('products').doc(count.productId);
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists) return { status: 404 as const };
      const before = Number(productSnap.data()?.stock) || 0;

      tx.update(productRef, { stock: count.counted });
      tx.update(countRef, { status: 'approved', reviewedBy: isAdmin.email || null, reviewedAt: now, appliedFrom: before });
      tx.set(db.collection('inventory_movements').doc(), {
        productId: count.productId,
        productName: count.productName,
        type: 'count_adjustment',
        before,
        after: count.counted,
        delta: count.counted - before,
        countId: id,
        actorEmail: isAdmin.email || null,
        actorUid: isAdmin.uid,
        reportedBy: count.reportedBy || null,
        createdAt: now,
      });
      return { status: 200 as const, count, before };
    });

    if (result.status === 404) return NextResponse.json({ error: 'Conteo o producto no encontrado.' }, { status: 404 });
    if (result.status === 409) return NextResponse.json({ error: 'Este conteo ya fue revisado.' }, { status: 409 });

    await recordAuditLog({
      action: action === 'approve' ? 'APPROVE_INVENTORY_COUNT' : 'REJECT_INVENTORY_COUNT',
      category: 'ADMIN_ACTION',
      details: action === 'approve'
        ? `Conteo aprobado: ${result.count.productName} ${result.before} → ${result.count.counted} (reportado por ${result.count.reportedBy || 'recepción'}).`
        : `Conteo descartado: ${result.count.productName} (contado ${result.count.counted}, sistema ${result.count.systemStock}).`,
      adminEmail: isAdmin.email,
      actorUid: isAdmin.uid,
      targetId: result.count.productId,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[/api/admin/inventory-counts POST]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
