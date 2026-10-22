import type { Firestore } from 'firebase-admin/firestore';
import { getPayment, searchPaymentsByReference, isMercadoPagoConfigured } from '@/lib/payments/mercadopago';
import { syncMercadoPagoPayment, type SyncResult } from '@/lib/payments/fulfillment';

/**
 * Conciliación de pagos con Mercado Pago (F1-22): si un webhook se pierde, el pago
 * se confirma igual al volver a /pago/resultado o en el cron diario.
 */

/** Consulta a Mercado Pago los pagos de una referencia y aplica su estado. */
export async function reconcileReference(db: Firestore, ref: string, paymentId?: string): Promise<SyncResult[]> {
  if (paymentId && /^\d+$/.test(paymentId)) {
    const payment = await getPayment(paymentId);
    // El id llega en la URL de retorno: solo cuenta si es de esta referencia.
    if (payment.external_reference !== ref) return [];
    return [await syncMercadoPagoPayment(db, payment)];
  }
  const payments = await searchPaymentsByReference(ref);
  // En orden cronológico: un reembolso se aplica después de su aprobación.
  payments.sort((a, b) => String(a.date_created).localeCompare(String(b.date_created)));
  const results: SyncResult[] = [];
  for (const p of payments) results.push(await syncMercadoPagoPayment(db, p));
  return results;
}

const HOUR = 3_600_000;
// Efecty da hasta ~3 días para pagar en efectivo; después el checkout se da por vencido.
const EXPIRE_AFTER_MS = 4 * 24 * HOUR;

/** Cron: pagos `pending` con más de 1 h. Devuelve un resumen para `system/cron`. */
export async function reconcilePendingPayments(db: Firestore, limit = 50) {
  const summary = { checked: 0, approved: 0, rejected: 0, expired: 0, errors: 0 };
  if (!isMercadoPagoConfigured()) return summary;

  const now = Date.now();
  const snap = await db
    .collection('payments')
    .where('status', '==', 'pending')
    .where('createdAt', '<=', new Date(now - HOUR))
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get();

  for (const doc of snap.docs) {
    summary.checked++;
    try {
      const results = await reconcileReference(db, doc.id);
      if (results.includes('approved')) summary.approved++;
      else if (results.includes('rejected')) summary.rejected++;
      else if (results.length === 0 || results.every((r) => r === 'pending')) {
        const createdAt = doc.data().createdAt?.toDate?.() as Date | undefined;
        if (createdAt && now - createdAt.getTime() > EXPIRE_AFTER_MS && results.length === 0) {
          await doc.ref.update({ status: 'expired', updatedAt: new Date() });
          summary.expired++;
        }
      }
    } catch (err: any) {
      summary.errors++;
      console.error(`[conciliación] ${doc.id}:`, err?.message || err);
    }
  }
  return summary;
}
