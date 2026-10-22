import { after } from 'next/server';
import type { Firestore, DocumentSnapshot } from 'firebase-admin/firestore';
import { sendPaymentSuccessEmail, sendPaymentFailedEmail, sendOrderReceiptEmail } from '@/services/mail';
import { formatInAppTz } from '@/lib/datetime';
import { computeRenewalExpiry } from '@/lib/plan-math';
import type { CheckoutItem } from '@/lib/payments/pricing';
import { classifyPaymentStatus, refundPayment, type MpPayment } from '@/lib/payments/mercadopago';

/**
 * Aplica el resultado de un pago de Mercado Pago (F1-19, F1-20, F1-21).
 *
 * `payments/{ref}` guarda la foto del checkout (ítems, precios, días). Esta función
 * recibe el pago tal como lo devuelve la API de Mercado Pago (nunca el cuerpo del
 * webhook) y, en UNA transacción, cambia el estado y aplica el efecto:
 *   - aprobado → activa el plan o descuenta el stock y crea `orders/{ref}`
 *   - rechazado → marca el pago y avisa al cliente
 *   - reembolsado/contracargo → revierte días o stock
 * La transición de estado hace que reintentos y avisos duplicados no tengan efecto.
 * Si algo falla lanza la excepción: el webhook responde 5xx y Mercado Pago reintenta.
 */

export type SyncResult =
  | 'unknown_reference'
  | 'amount_mismatch'
  | 'approved'
  | 'already_approved'
  | 'rejected'
  | 'reversed'
  | 'pending'
  | 'ignored';

interface PaymentDoc {
  status: string;
  uid: string;
  customerEmail: string;
  customerName: string;
  type: 'plan' | 'products';
  planId: string | null;
  concept: string;
  amount: number;
  dias: number | null;
  items: CheckoutItem[];
  mpPaymentId?: number;
}

const cop = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(n);

/** Nombre legible del medio de pago para correos y órdenes. */
function paymentMethodLabel(mp: MpPayment): string {
  const id = mp.payment_method_id || '';
  if (id === 'pse') return 'PSE';
  if (id === 'efecty') return 'Efecty';
  if (id === 'account_money') return 'Saldo Mercado Pago';
  if (mp.payment_type_id === 'credit_card') return `Tarjeta de crédito (${id})`;
  if (mp.payment_type_id === 'debit_card') return `Tarjeta débito (${id})`;
  return id || 'Mercado Pago';
}

function inBackground(task: () => Promise<unknown>, context: string) {
  after(() =>
    task().catch((err: any) => console.error(`[pagos] Falló una tarea en segundo plano (${context}):`, err?.message || err))
  );
}

function toDate(v: any): Date | null {
  if (!v) return null;
  return v.toDate ? v.toDate() : new Date(v);
}

export async function syncMercadoPagoPayment(db: Firestore, mp: MpPayment): Promise<SyncResult> {
  const ref = mp.external_reference;
  if (!ref) return 'unknown_reference';

  const paymentRef = db.collection('payments').doc(ref);
  const orderRef = db.collection('orders').doc(ref);
  const outcome = classifyPaymentStatus(mp.status);
  const method = paymentMethodLabel(mp);
  const now = new Date();

  // Datos para los efectos posteriores a la transacción (correos, reembolso por stock).
  let snapshot: PaymentDoc | null = null;
  let oversold: { id: string; nombre: string; unidades: number; precio: number }[] = [];

  const result = await db.runTransaction<SyncResult>(async (tx) => {
    // Firestore exige TODAS las lecturas antes de TODAS las escrituras.
    const paySnap = await tx.get(paymentRef);
    if (!paySnap.exists) return 'unknown_reference';
    const pay = paySnap.data() as PaymentDoc;
    snapshot = pay;
    oversold = [];

    // Bitácora de eventos (una entrada por pago y estado).
    const logEvent = () =>
      tx.set(
        db.collection('payment_events').doc(`mp_${mp.id}_${mp.status}`),
        { gateway: 'mercadopago', reference: ref, paymentId: mp.id, status: mp.status, statusDetail: mp.status_detail || null, receivedAt: now },
        { merge: true }
      );

    // El monto cobrado debe ser exactamente el de la foto del checkout.
    if (mp.currency_id !== 'COP' || Math.round(mp.transaction_amount) !== Math.round(pay.amount)) {
      logEvent();
      if (pay.status !== 'amount_mismatch' && pay.status !== 'approved') {
        tx.update(paymentRef, { status: 'amount_mismatch', mpPaymentId: mp.id, mpStatus: mp.status, updatedAt: now });
        tx.set(db.collection('notifications').doc(), {
          tipo: 'payment_alert',
          mensaje: `¡Revisar! El pago ${mp.id} (ref ${ref}) cobró ${cop(mp.transaction_amount)} ${mp.currency_id} y se esperaba ${cop(pay.amount)}. No se activó nada.`,
          id_orden: ref,
          leido: false,
          fecha: now,
        });
      }
      return 'amount_mismatch';
    }

    if (outcome === 'approved') {
      if (pay.status === 'approved') return 'already_approved';
      // Desde `pending` o `rejected`: el cliente puede reintentar dentro del mismo checkout.

      if (pay.type === 'plan') {
        const userRef = db.collection('users').doc(pay.uid);
        const userSnap = await tx.get(userRef);
        const existingPlan = userSnap.data()?.plan;
        const dias = Number(pay.dias) || 30;
        const expira = computeRenewalExpiry({
          existingExpira: toDate(existingPlan?.expira),
          dias,
          frozenMs: Number(existingPlan?.frozen?.remainingMs) || 0,
          now,
        });
        tx.set(
          userRef,
          { plan: { nombre: pay.concept, planId: pay.planId, precio: pay.amount, dias_total: dias, inicio: now, expira, frozen: null } },
          { merge: true }
        );
      } else {
        const productRefs = pay.items.map((it) => db.collection('products').doc(it.id));
        const productSnaps: DocumentSnapshot[] = [];
        for (const r of productRefs) productSnaps.push(await tx.get(r));

        pay.items.forEach((item, i) => {
          const pSnap = productSnaps[i];
          if (!pSnap.exists) return;
          const pData = pSnap.data()!;
          const currentStock = Number(pData.stock) || 0;
          if (currentStock < item.cantidad) {
            // F1-20: las unidades sin stock se reembolsan después de la transacción.
            oversold.push({ id: item.id, nombre: item.nombre, unidades: item.cantidad - Math.max(0, currentStock), precio: item.precio });
            tx.set(db.collection('notifications').doc(), {
              tipo: 'oversell',
              mensaje: `¡Revisar! Se vendieron ${item.cantidad} de ${item.nombre} con solo ${currentStock} en stock (orden ${ref}).`,
              id_producto: item.id,
              id_orden: ref,
              leido: false,
              fecha: now,
            });
          }
          const newStock = Math.max(0, currentStock - item.cantidad);
          tx.update(productRefs[i], { stock: newStock });
          // F2-25: movimiento de inventario por la venta.
          tx.set(db.collection('inventory_movements').doc(), {
            productId: item.id, productName: item.nombre, type: 'sale',
            before: currentStock, after: newStock, delta: newStock - currentStock,
            orderId: ref, createdAt: now,
          });
          const threshold = Number.isFinite(Number(pData.lowStockThreshold)) ? Number(pData.lowStockThreshold) : 5;
          if (newStock <= threshold) {
            tx.set(db.collection('notifications').doc(), {
              tipo: 'low_stock',
              mensaje: `¡Alerta! El producto ${item.nombre} tiene stock crítico: ${newStock} unidades.`,
              id_producto: item.id,
              leido: false,
              fecha: now,
            });
          }
        });
      }

      // Orden con los precios de la foto (no los del momento del webhook).
      tx.set(orderRef, {
        uid: pay.uid,
        customerName: pay.customerName,
        customerEmail: pay.customerEmail,
        type: pay.type,
        planId: pay.planId,
        concepto: pay.concept,
        items: pay.type === 'products' ? pay.items : [],
        total: pay.amount,
        banco: method,
        gateway: 'mercadopago',
        paymentId: mp.id,
        fecha: now,
        status: 'paid',
      });
      tx.set(db.collection('notifications').doc(), {
        tipo: 'purchase',
        mensaje: `${pay.customerName} pagó ${cop(pay.amount)} (${pay.concept}) con ${method}.`,
        id_orden: ref,
        leido: false,
        fecha: now,
      });
      tx.update(paymentRef, { status: 'approved', mpPaymentId: mp.id, mpStatus: mp.status, method, approvedAt: now, updatedAt: now });
      logEvent();
      return 'approved';
    }

    if (outcome === 'rejected') {
      logEvent();
      if (pay.status !== 'pending') return 'ignored';
      tx.update(paymentRef, { status: 'rejected', mpPaymentId: mp.id, mpStatus: mp.status, updatedAt: now });
      return 'rejected';
    }

    if (outcome === 'reversed') {
      logEvent();
      // Solo se revierte el pago que produjo el efecto.
      if (pay.status !== 'approved' || pay.mpPaymentId !== mp.id) return 'ignored';

      if (pay.type === 'plan') {
        const userRef = db.collection('users').doc(pay.uid);
        const userSnap = await tx.get(userRef);
        const expira = toDate(userSnap.data()?.plan?.expira);
        if (expira) {
          const nuevaExpira = new Date(expira);
          nuevaExpira.setDate(nuevaExpira.getDate() - (Number(pay.dias) || 30));
          tx.update(userRef, { 'plan.expira': nuevaExpira });
        }
      } else {
        const refs = pay.items.map((it) => db.collection('products').doc(it.id));
        const snaps: DocumentSnapshot[] = [];
        for (const r of refs) snaps.push(await tx.get(r));
        pay.items.forEach((it, i) => {
          if (!snaps[i].exists) return;
          const before = Number(snaps[i].data()?.stock) || 0;
          tx.update(refs[i], { stock: before + it.cantidad });
          tx.set(db.collection('inventory_movements').doc(), {
            productId: it.id, productName: it.nombre, type: 'refund_restock',
            before, after: before + it.cantidad, delta: it.cantidad,
            orderId: ref, createdAt: now,
          });
        });
      }

      const newStatus = mp.status === 'charged_back' ? 'charged_back' : 'refunded';
      tx.update(paymentRef, { status: newStatus, mpStatus: mp.status, updatedAt: now });
      tx.set(orderRef, { status: newStatus, amountRefunded: mp.transaction_amount_refunded ?? pay.amount, refundedAt: now }, { merge: true });
      tx.set(db.collection('notifications').doc(), {
        tipo: 'refund',
        mensaje: `${newStatus === 'charged_back' ? 'Contracargo' : 'Reembolso total'} de la orden ${ref} (${pay.customerName}): ${pay.type === 'plan' ? 'se descontaron los días del plan' : 'se repuso el stock'}.`,
        id_orden: ref,
        leido: false,
        fecha: now,
      });
      return 'reversed';
    }

    // Pendiente (PSE en proceso, Efecty sin pagar…): solo se registra.
    logEvent();
    if (pay.status === 'pending') tx.update(paymentRef, { mpPaymentId: mp.id, mpStatus: mp.status, updatedAt: now });
    return 'pending';
  });

  const pay = snapshot as PaymentDoc | null;
  if (!pay) return result;

  if (result === 'approved') {
    const date = formatInAppTz(new Date(mp.date_approved || now), {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    if (pay.type === 'plan') {
      inBackground(
        () => sendPaymentSuccessEmail({
          to: pay.customerEmail, customerName: pay.customerName, amount: pay.amount,
          concept: pay.concept, bank: method, date, transactionId: String(mp.id),
        }),
        'correo-plan'
      );
    } else {
      inBackground(
        () => sendOrderReceiptEmail({
          to: pay.customerEmail, customerName: pay.customerName, items: pay.items,
          total: pay.amount, bank: method, date, transactionId: String(mp.id),
        }),
        'recibo-orden'
      );
    }
    if (oversold.length > 0) await refundOversold(db, ref, mp, pay, oversold);
  } else if (result === 'rejected') {
    inBackground(() => sendPaymentFailedEmail({ to: pay.customerEmail, customerName: pay.customerName }), 'correo-rechazo');
  }

  return result;
}

/** F1-20: reembolso parcial automático de las unidades vendidas sin stock. */
async function refundOversold(
  db: Firestore,
  ref: string,
  mp: MpPayment,
  pay: PaymentDoc,
  oversold: { id: string; nombre: string; unidades: number; precio: number }[]
) {
  const amount = Math.min(oversold.reduce((acc, o) => acc + o.unidades * o.precio, 0), mp.transaction_amount);
  const orderRef = db.collection('orders').doc(ref);
  try {
    const refund = await refundPayment(mp.id, amount, `oversell-${ref}`);
    await orderRef.update({
      status: 'partially_refunded',
      refund: { id: refund.id, amount, reason: 'sin_stock', items: oversold, at: new Date() },
    });
    await db.collection('notifications').add({
      tipo: 'oversell',
      mensaje: `Reembolso automático de ${cop(amount)} a ${pay.customerName} por productos sin stock (orden ${ref}).`,
      id_orden: ref,
      leido: false,
      fecha: new Date(),
    });
  } catch (err: any) {
    console.error('[pagos] Falló el reembolso automático por falta de stock:', err?.message || err);
    await db.collection('notifications').add({
      tipo: 'oversell',
      mensaje: `¡ACCIÓN REQUERIDA! No se pudo reembolsar automáticamente la orden ${ref} (productos sin stock). Reembolsa ${cop(amount)} desde Mercado Pago.`,
      id_orden: ref,
      leido: false,
      fecha: new Date(),
    });
  }
}
