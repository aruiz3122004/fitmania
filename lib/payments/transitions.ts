/**
 * Decisiones del webhook de Mercado Pago como funciones puras (F1-28).
 *
 * `fulfillment.ts` lee y escribe Firestore dentro de la transacción; aquí solo se
 * decide qué hacer, para poder probarlo sin Firestore ni Mercado Pago. Sin imports
 * del proyecto para poder probarlo con `node --test`.
 */

export type PaymentOutcome = 'approved' | 'pending' | 'rejected' | 'reversed';

/** Lo que importa del documento `payments/{ref}` para decidir. */
export interface PaymentState {
  status: string;
  amount: number;
  mpPaymentId?: number;
}

/** Lo que importa del pago devuelto por la API de Mercado Pago. */
export interface IncomingPayment {
  id: number;
  status: string;
  transaction_amount: number;
  currency_id: string;
}

export type Transition =
  /** Monto o moneda distintos a la foto del checkout. `alert`: primera vez que se detecta. */
  | { action: 'amount_mismatch'; alert: boolean }
  | { action: 'approve' }
  | { action: 'already_approved' }
  | { action: 'reject' }
  | { action: 'reverse'; finalStatus: 'refunded' | 'charged_back' }
  /** Pendiente: `touch` indica si se actualiza el registro (solo mientras siga `pending`). */
  | { action: 'pending'; touch: boolean }
  | { action: 'ignore' };

export function decideTransition(pay: PaymentState, mp: IncomingPayment, outcome: PaymentOutcome): Transition {
  // El monto cobrado debe ser exactamente el de la foto del checkout.
  if (mp.currency_id !== 'COP' || Math.round(mp.transaction_amount) !== Math.round(pay.amount)) {
    return { action: 'amount_mismatch', alert: pay.status !== 'amount_mismatch' && pay.status !== 'approved' };
  }

  switch (outcome) {
    case 'approved':
      // Desde `pending` o `rejected`: el cliente puede reintentar dentro del mismo checkout.
      // También desde `expired` (Efecty pagado tarde): el dinero ya se cobró.
      if (pay.status === 'approved') return { action: 'already_approved' };
      return { action: 'approve' };
    case 'rejected':
      // Un rechazo tardío (otro intento del mismo checkout) no deshace un aprobado.
      return pay.status === 'pending' ? { action: 'reject' } : { action: 'ignore' };
    case 'reversed':
      // Solo se revierte el pago que produjo el efecto.
      if (pay.status !== 'approved' || pay.mpPaymentId !== mp.id) return { action: 'ignore' };
      return { action: 'reverse', finalStatus: mp.status === 'charged_back' ? 'charged_back' : 'refunded' };
    default:
      return { action: 'pending', touch: pay.status === 'pending' };
  }
}

export interface SaleLine {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export interface StockChange {
  id: string;
  before: number;
  after: number;
  /** Unidades que sí salieron del inventario. */
  deducted: number;
  /** Unidades vendidas sin stock (F1-20: se reembolsan). */
  oversold: number;
}

/** Descuento de stock de una venta aprobada. `stock` es el stock actual por id. */
export function planSale(items: SaleLine[], stock: Record<string, number>): StockChange[] {
  return items.map((it) => {
    const before = Math.max(0, Number(stock[it.id]) || 0);
    const deducted = Math.min(before, it.cantidad);
    return { id: it.id, before, after: before - deducted, deducted, oversold: it.cantidad - deducted };
  });
}

/**
 * Unidades a reponer al revertir una venta. Solo vuelve lo que salió del inventario:
 * las unidades vendidas sin stock ya se reembolsaron y nunca se descontaron.
 * Las ventas anteriores a `stockApplied` reponen la cantidad completa.
 */
export function restockUnits(items: SaleLine[], stockApplied?: Record<string, number> | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const applied = stockApplied?.[it.id];
    out[it.id] = Number.isFinite(applied) ? Math.max(0, Number(applied)) : it.cantidad;
  }
  return out;
}

/** Vencimiento del plan tras revertir un pago: se descuentan los días que dio. */
export function reversalExpiry(expira: Date, dias: number): Date {
  const out = new Date(expira);
  out.setDate(out.getDate() - dias);
  return out;
}
