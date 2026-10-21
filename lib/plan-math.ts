/**
 * Cálculo del vencimiento al renovar un plan (B3 / F3-25). Función pura para
 * poder probarla sin Stripe ni Firestore (F1-28).
 *
 * - Plan vigente: los días nuevos se suman al vencimiento actual.
 * - Plan vencido o inexistente: los días cuentan desde hoy.
 * - Plan congelado: además se suman los días congelados a favor (remainingMs).
 */
export function computeRenewalExpiry(params: {
  existingExpira: Date | null;
  dias: number;
  frozenMs?: number;
  now?: Date;
}): Date {
  const now = params.now ?? new Date();
  const base = params.existingExpira && params.existingExpira.getTime() > now.getTime()
    ? new Date(params.existingExpira)
    : new Date(now);
  const expira = new Date(base);
  expira.setDate(base.getDate() + params.dias);
  if (params.frozenMs && params.frozenMs > 0) expira.setTime(expira.getTime() + params.frozenMs);
  return expira;
}
