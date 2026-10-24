import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';
import { reconcileReference } from '@/lib/payments/reconcile';

// La conciliación puede aplicar el pago (transacción + reembolso automático).
export const maxDuration = 30;

const STATUSES = ['pending', 'rejected', 'amount_mismatch', 'expired', 'approved', 'refunded', 'charged_back'] as const;
const DEFAULT_STATUSES = ['pending', 'rejected', 'amount_mismatch'];

const toIso = (v: any) => (v?.toDate ? v.toDate().toISOString() : v ? new Date(v).toISOString() : null);

/**
 * GET /api/admin/payments?status=pending,rejected — pagos de Mercado Pago por estado.
 *
 * Las órdenes solo existen para pagos aprobados; aquí se ven los que no llegaron a
 * orden (pendientes, rechazados, monto alterado, vencidos).
 */
export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const requested = (new URL(request.url).searchParams.get('status') || DEFAULT_STATUSES.join(','))
    .split(',')
    .filter((s): s is (typeof STATUSES)[number] => (STATUSES as readonly string[]).includes(s));
  if (requested.length === 0) return NextResponse.json({ error: 'Estado no válido.' }, { status: 400 });

  try {
    // Sin orderBy: `in` sobre un solo campo no necesita índice compuesto. Se ordena aquí.
    const snap = await getAdminFirestore().collection('payments').where('status', 'in', requested).limit(300).get();
    const payments = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          status: d.status,
          type: d.type,
          concept: d.concept,
          amount: d.amount,
          customerName: d.customerName,
          customerEmail: d.customerEmail,
          method: d.method || null,
          mpPaymentId: d.mpPaymentId || null,
          mpStatus: d.mpStatus || null,
          items: d.items || [],
          createdAt: toIso(d.createdAt),
          updatedAt: toIso(d.updatedAt),
        };
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return NextResponse.json(payments);
  } catch (error) {
    console.error('[/api/admin/payments]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

/** POST { ref } — consulta el pago en Mercado Pago y aplica su estado (conciliación manual). */
export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const ref = String(body?.ref || '');
  if (!/^fm_[0-9a-f-]{36}$/.test(ref)) return NextResponse.json({ error: 'Referencia no válida.' }, { status: 400 });

  try {
    const db = getAdminFirestore();
    const results = await reconcileReference(db, ref);
    const status = (await db.collection('payments').doc(ref).get()).data()?.status ?? null;

    await recordAuditLog({
      action: 'RECONCILE_PAYMENT',
      category: 'ADMIN_ACTION',
      details: `Conciliación manual del pago ${ref}: ${results.join(', ') || 'sin pagos en Mercado Pago'} → ${status}`,
      adminEmail: isAdmin.email,
      actorUid: isAdmin.uid,
      targetId: ref,
      request,
    });
    return NextResponse.json({ results, status });
  } catch (error: any) {
    console.error('[/api/admin/payments] conciliación', ref, error?.message || error);
    return NextResponse.json({ error: 'No se pudo consultar Mercado Pago. Intenta más tarde.' }, { status: 502 });
  }
}
