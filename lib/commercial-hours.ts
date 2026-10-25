/**
 * Franja horaria de la Ley 2300 de 2023 para mensajes no transaccionales
 * (noticias/promociones): lunes a viernes 7:00–19:00 y sábados 8:00–15:00, hora de
 * Colombia; nunca domingos. TODO: excluir también los festivos nacionales.
 */
const TIME_ZONE = 'America/Bogota';

export function isWithinCommercialHours(date: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  if (weekday === 'Sun') return false;
  if (weekday === 'Sat') return hour >= 8 && hour < 15;
  return hour >= 7 && hour < 19;
}
