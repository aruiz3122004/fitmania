import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Cliente mínimo de Mercado Pago (Checkout Pro) y verificación de webhooks.
 *
 * Sin imports del proyecto para poder probarlo con `node --test`.
 * Credenciales: `MERCADOPAGO_ACCESS_TOKEN` (las de prueba también empiezan por
 * `APP_USR-`) y `MERCADOPAGO_WEBHOOK_SECRET` (Tus integraciones → Webhooks).
 */
const API = 'https://api.mercadopago.com';

/**
 * Solo desarrollo: `MERCADOPAGO_API_URL` apunta a un simulador local de la API para
 * probar escenarios (rechazo, reembolso, sobreventa…) sin pasar por el navegador.
 * En producción siempre se usa la API real.
 */
function apiBase(): string {
  const override = process.env.NODE_ENV !== 'production' ? process.env.MERCADOPAGO_API_URL?.trim() : '';
  return override ? override.replace(/\/$/, '') : API;
}

export class MercadoPagoError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function isMercadoPagoConfigured(): boolean {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
}

async function mpFetch<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new MercadoPagoError('Mercado Pago no está configurado.', 503);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (init.idempotencyKey) headers['X-Idempotency-Key'] = init.idempotencyKey;
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // El detalle va a los logs del servidor; nunca al cliente.
    console.error(`[mercadopago] ${init.method || 'GET'} ${path} → ${res.status}: ${body.slice(0, 500)}`);
    throw new MercadoPagoError(`Mercado Pago respondió ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Tipos (solo los campos que usa la app)
// ---------------------------------------------------------------------------

export interface MpPreferenceItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: 'COP';
}

export interface MpPreferenceInput {
  items: MpPreferenceItem[];
  payer: { email: string };
  external_reference: string;
  back_urls: { success: string; failure: string; pending: string };
  auto_return?: 'approved';
  notification_url?: string;
  statement_descriptor?: string;
  metadata?: Record<string, string>;
}

export interface MpPreference {
  id: string;
  init_point: string;
}

export interface MpPayment {
  id: number;
  status: string; // approved | pending | in_process | authorized | in_mediation | rejected | cancelled | refunded | charged_back
  status_detail?: string;
  external_reference: string | null;
  transaction_amount: number;
  transaction_amount_refunded?: number;
  currency_id: string;
  payment_method_id?: string; // visa, master, pse, efecty…
  payment_type_id?: string; // credit_card, debit_card, bank_transfer, ticket…
  date_created?: string;
  date_approved?: string | null;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function createPreference(input: MpPreferenceInput, idempotencyKey: string) {
  return mpFetch<MpPreference>('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify(input),
    idempotencyKey,
  });
}

export function getPayment(paymentId: string | number) {
  return mpFetch<MpPayment>(`/v1/payments/${encodeURIComponent(String(paymentId))}`);
}

/** Pagos asociados a una referencia propia, del más reciente al más antiguo. */
export async function searchPaymentsByReference(reference: string): Promise<MpPayment[]> {
  const qs = new URLSearchParams({ external_reference: reference, sort: 'date_created', criteria: 'desc' });
  const data = await mpFetch<{ results?: MpPayment[] }>(`/v1/payments/search?${qs}`);
  return data.results ?? [];
}

/** Reembolso parcial (o total si se omite `amount`). */
export function refundPayment(paymentId: string | number, amount: number | undefined, idempotencyKey: string) {
  return mpFetch<{ id: number; amount: number }>(`/v1/payments/${encodeURIComponent(String(paymentId))}/refunds`, {
    method: 'POST',
    body: JSON.stringify(amount === undefined ? {} : { amount }),
    idempotencyKey,
  });
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

export type PaymentOutcome = 'approved' | 'pending' | 'rejected' | 'reversed';

/**
 * Agrupa los estados de Mercado Pago en lo que le importa a la app.
 * `in_mediation` (disputa abierta sobre un pago aprobado) se trata como aprobado:
 * el efecto se revierte solo si termina en `charged_back`.
 */
export function classifyPaymentStatus(status: string): PaymentOutcome {
  switch (status) {
    case 'approved':
    case 'in_mediation':
      return 'approved';
    case 'rejected':
    case 'cancelled':
      return 'rejected';
    case 'refunded':
    case 'charged_back':
      return 'reversed';
    default:
      // pending, in_process, authorized y cualquier estado nuevo: esperar.
      return 'pending';
  }
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/**
 * Verifica la cabecera `x-signature` de un webhook de Mercado Pago.
 *
 * Formato: `ts=<timestamp>,v1=<hmac>`. El HMAC-SHA256 (hex) se calcula sobre
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con el secreto del webhook;
 * `data.id` alfanumérico va en minúsculas y las partes ausentes se omiten.
 */
export function verifyWebhookSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = params;
  if (!xSignature || !secret) return false;

  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of xSignature.split(',')) {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=').trim();
    if (key.trim() === 'ts') ts = value;
    else if (key.trim() === 'v1') v1 = value;
  }
  if (!ts || !v1) return false;

  const id = dataId && /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifest = '';
  if (id) manifest += `id:${id};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(v1.toLowerCase(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
