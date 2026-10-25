import type { Firestore } from 'firebase-admin/firestore';
import { getPayment, searchPaymentsByReference, isMercadoPagoConfigured } from '@/lib/payments/mercadopago';
import { syncMercadoPagoPayment, type SyncResult } from '@/lib/payments/fulfillment';
import { IS_SANDBOX } from '@/lib/sandbox';

/**
 * Conciliación de pagos con Mercado Pago (F1-22): si un webhook se pierde, el pago
 * se confirma igual al volver a /pago/resultado o en el cron diario.
 */

/** Consulta a Mercado Pago los pagos de una referencia y aplica su estado. */
export async function reconcileReference(db: Firestore, ref: string, paymentId?: string): Promise<SyncResult[]> {
  // En el sandbox no hay Mercado Pago: la pasarela simulada aplica el pago al momento.
  if (IS_SANDBOX) return [];
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
// Checkout abierto y abandonado (Mercado Pago no tiene ningún pago con esa referencia):
// se da por vencido al día siguiente. Si el cliente paga después con el mismo enlace,
// el webhook lo aprueba igual desde `expired` (ver decideTransition).
const ABANDONED_AFTER_MS = 24 * HOUR;
// Presupuesto de tiempo dentro del cron (maxDuration 60 s, con otras tareas después).
const TIME_BUDGET_MS = 25_000;

/** Cron: pagos `pending` con más de 1 h. Devuelve un resumen para `system/cron`. */
export async function reconcilePendingPayments(db: Firestore, limit = 200) {
  const summary = { checked: 0, approved: 0, rejected: 0, expired: 0, errors: 0, deferred: 0 };
  if (IS_SANDBOX || !isMercadoPagoConfigured()) return summary;

  const now = Date.now();
  // Filtro de un solo campo (sin índice compuesto): los pendientes son pocos y la
  // antigüedad se aplica aquí. Así el cron no falla si el índice no está desplegado.
  const snap = await db.collection('payments').where('status', '==', 'pending').limit(1000).get();
  const due = snap.docs
    .filter((d) => {
      const createdAt = d.data().createdAt?.toDate?.() as Date | undefined;
      return createdAt && createdAt.getTime() <= now - HOUR;
    })
    .sort((a, b) => a.data().createdAt.toMillis() - b.data().createdAt.toMillis())
    .slice(0, limit);

  for (const doc of due) {
    // Lo que no alcance a revisarse queda para la siguiente ejecución (los más antiguos van primero).
    if (Date.now() - now > TIME_BUDGET_MS) {
      summary.deferred = due.length - summary.checked;
      break;
    }
    summary.checked++;
    try {
      const results = await reconcileReference(db, doc.id);
      if (results.includes('approved')) summary.approved++;
      else if (results.includes('rejected')) summary.rejected++;
      else if (results.length === 0) {
        // Los pagos que siguen pendientes en Mercado Pago (Efecty sin pagar, PSE en
        // proceso) no se vencen aquí: Mercado Pago los cancela y llega como rechazo.
        const createdAt = doc.data().createdAt?.toDate?.() as Date | undefined;
        if (createdAt && now - createdAt.getTime() > ABANDONED_AFTER_MS) {
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
