/**
 * Utilidades de fecha/hora centralizadas (T-20, auditoría M-6).
 *
 * El servidor (Vercel) corre en UTC, así que usar `toLocaleDateString()` sin
 * `timeZone` o restar offsets a mano (p. ej. `- 5*60*60*1000`) produce fechas
 * equivocadas cerca de medianoche. Todo el proyecto debe usar `America/Bogota`
 * a través de estas funciones, sin "magic numbers" de offset.
 */

export const APP_TIME_ZONE = 'America/Bogota';

/**
 * Devuelve la fecha en formato `YYYY-MM-DD` según la zona horaria de la app.
 * Útil como clave de día (dateKey) independientemente de la zona del servidor.
 */
export function getDateKeyInAppTz(date: Date = new Date()): string {
  // `en-CA` produce exactamente `YYYY-MM-DD`.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Formatea una fecha con las opciones dadas, siempre en la zona de la app.
 * Ej.: `formatInAppTz(date, { day: 'numeric', month: 'long', year: 'numeric' })`.
 */
export function formatInAppTz(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  locale: string = 'es-CO'
): string {
  return new Intl.DateTimeFormat(locale, { timeZone: APP_TIME_ZONE, ...options }).format(date);
}
