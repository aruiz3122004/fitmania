/**
 * Historial de compras del usuario (/compras).
 *
 * Une dos fuentes sin duplicar:
 *  - `payments/{ref}` (Mercado Pago): todos los intentos con su estado. Si se aprobó,
 *    `orders/{ref}` (mismo id) aporta los reembolsos.
 *  - `orders/{id}` sin pago de Mercado Pago: compras históricas (p. ej. de Stripe, ya retirado).
 *
 * Se ocultan los checkouts abiertos y abandonados (sin pago en Mercado Pago) y los
 * vencidos: el usuario nunca llegó a pagar. Sin imports con alias: se prueba con node --test.
 */

export type PurchaseStatus = 'paid' | 'partially_refunded' | 'refunded' | 'charged_back' | 'pending' | 'rejected' | 'review';
export type PurchaseType = 'plan' | 'products';

export interface PurchaseItem {
  nombre: string;
  precio: number;
  cantidad: number;
}

export interface PurchaseEntry {
  id: string;
  fecha: string | null;
  tipo: PurchaseType;
  concepto: string;
  items: PurchaseItem[];
  total: number;
  reembolsado: number;
  metodo: string | null;
  estado: PurchaseStatus;
  transaccion: string | null;
  dias: number | null;
}

export interface PurchaseSummary {
  compras: number;
  totalPagado: number;
  ultimaCompra: string | null;
}

export interface RawDoc {
  id: string;
  data: Record<string, any>;
}

/** Fecha de Firestore (Timestamp, `{seconds}` o Date/string) → ISO, o null. */
export function toIso(value: any): string | null {
  if (!value) return null;
  let d: Date;
  if (typeof value.toDate === 'function') d = value.toDate();
  else if (typeof value.seconds === 'number') d = new Date(value.seconds * 1000);
  else if (typeof value._seconds === 'number') d = new Date(value._seconds * 1000);
  else d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Pagos guardados antes de las etiquetas legibles traen el id crudo de Mercado Pago.
const METHOD_LABELS: Record<string, string> = { account_money: 'Saldo Mercado Pago', pse: 'PSE', efecty: 'Efecty' };
const methodOf = (v: any) => (v ? METHOD_LABELS[String(v)] ?? String(v) : null);

function itemsOf(raw: any): PurchaseItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it) => ({
    nombre: String(it?.nombre ?? it?.id ?? 'Producto'),
    precio: num(it?.precio),
    cantidad: Math.max(1, num(it?.cantidad) || 1),
  }));
}

/** Monto devuelto según la orden: reembolso total (`amountRefunded`) o parcial (`refund.amount`). */
function refundedOf(order: Record<string, any> | undefined): number {
  if (!order) return 0;
  return num(order.amountRefunded) || num(order.refund?.amount);
}

/** Reembolso parcial: lo que diga la orden. Total o contracargo: la orden o, si falta, el total. */
function refundedAmount(estado: PurchaseStatus, order: Record<string, any> | undefined, total: number): number {
  if (estado === 'partially_refunded') return refundedOf(order);
  if (estado === 'refunded' || estado === 'charged_back') return refundedOf(order) || total;
  return 0;
}

function orderStatus(status: any): PurchaseStatus {
  if (status === 'partially_refunded' || status === 'refunded' || status === 'charged_back') return status;
  return 'paid';
}

function fromPayment(p: RawDoc, order: Record<string, any> | undefined): PurchaseEntry | null {
  const d = p.data;
  const status = String(d.status || 'pending');
  // Checkout abierto sin intento de pago, o vencido: no es una compra.
  if (status === 'expired') return null;
  if (status === 'pending' && !d.mpPaymentId) return null;

  let estado: PurchaseStatus;
  if (status === 'approved') estado = orderStatus(order?.status);
  else if (status === 'refunded' || status === 'charged_back' || status === 'rejected' || status === 'pending') estado = status;
  else if (status === 'amount_mismatch') estado = 'review';
  else return null;

  const tipo: PurchaseType = d.type === 'products' ? 'products' : 'plan';
  return {
    id: p.id,
    fecha: toIso(d.approvedAt) ?? toIso(d.createdAt),
    tipo,
    concepto: String(d.concept || (tipo === 'plan' ? 'Plan Fitmania' : 'Compra en la tienda')),
    items: itemsOf(d.items),
    total: num(d.amount),
    reembolsado: refundedAmount(estado, order, num(d.amount)),
    metodo: methodOf(d.method),
    estado,
    transaccion: d.mpPaymentId ? String(d.mpPaymentId) : null,
    dias: tipo === 'plan' && num(d.dias) > 0 ? num(d.dias) : null,
  };
}

function fromOrder(o: RawDoc): PurchaseEntry {
  const d = o.data;
  const items = itemsOf(d.items);
  const tipo: PurchaseType = d.type === 'plan' || items.length === 0 ? 'plan' : 'products';
  const estado = orderStatus(d.status);
  return {
    id: o.id,
    fecha: toIso(d.fecha),
    tipo,
    concepto: String(d.concepto || (tipo === 'plan' ? 'Plan Fitmania' : 'Compra en la tienda')),
    items,
    total: num(d.total),
    reembolsado: refundedAmount(estado, d, num(d.total)),
    metodo: methodOf(d.banco),
    estado,
    transaccion: d.paymentId ? String(d.paymentId) : o.id,
    dias: null,
  };
}

/** Lista unificada, de la más reciente a la más antigua. */
export function buildPurchaseHistory(payments: RawDoc[], orders: RawDoc[]): PurchaseEntry[] {
  const ordersById = new Map(orders.map((o) => [o.id, o.data]));
  const paymentIds = new Set(payments.map((p) => p.id));

  const entries: PurchaseEntry[] = [];
  for (const p of payments) {
    const entry = fromPayment(p, ordersById.get(p.id));
    if (entry) entries.push(entry);
  }
  for (const o of orders) {
    // Las órdenes de Mercado Pago ya salen de su pago (mismo id).
    if (paymentIds.has(o.id) || o.data.gateway === 'mercadopago') continue;
    entries.push(fromOrder(o));
  }

  return entries.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
}

/** Compras pagadas (aunque luego se reembolsaran en parte), lo invertido neto y la fecha de la última. */
export function summarizePurchases(entries: PurchaseEntry[]): PurchaseSummary {
  const settled = entries.filter((e) => e.estado === 'paid' || e.estado === 'partially_refunded');
  return {
    compras: settled.length,
    totalPagado: settled.reduce((acc, e) => acc + Math.max(0, e.total - e.reembolsado), 0),
    ultimaCompra: settled[0]?.fecha ?? null,
  };
}
