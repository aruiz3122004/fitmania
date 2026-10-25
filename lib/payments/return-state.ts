/**
 * Qué mostrar en /pago/resultado al volver de Mercado Pago.
 *
 * Mercado Pago vuelve con `payment_id=null` cuando el cliente sale del checkout sin
 * pagar ("Volver al sitio"). Si además el servidor no conoce ningún pago de esa
 * referencia, no hubo cobro: se muestra "pago no completado" en lugar de "en proceso"
 * (que promete un correo que nunca llega). PSE y Efecty sí vuelven con su id.
 * Sin imports con alias: se prueba con node --test.
 */

export type ReturnState = 'exitoso' | 'fallido' | 'pendiente' | 'incompleto' | 'reintentar';

const FAILED = ['rejected', 'refunded', 'charged_back', 'expired'];

/** Id de pago válido de la URL de retorno, o '' (Mercado Pago manda el texto "null"). */
export function cleanPaymentId(value: string | null | undefined): string {
  const v = (value || '').trim();
  return /^\d+$/.test(v) ? v : '';
}

export function returnState(params: {
  status: string | undefined;
  urlPaymentId: string;
  serverPaymentId: unknown;
  attempt: number;
  maxAttempts?: number;
}): ReturnState {
  const { status, urlPaymentId, serverPaymentId, attempt, maxAttempts = 5 } = params;
  if (status === 'approved') return 'exitoso';
  if (status && FAILED.includes(status)) return 'fallido';
  if (status === 'pending' && !urlPaymentId && !serverPaymentId) return 'incompleto';
  if (status === 'pending' && attempt < maxAttempts) return 'reintentar';
  return 'pendiente';
}
