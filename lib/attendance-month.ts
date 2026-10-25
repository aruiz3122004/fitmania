/**
 * Resumen mensual de asistencia (F3-01) a partir de los `daily_stats` del mes.
 * Función pura, sin imports del proyecto, para probarla con `node --test`.
 */

export interface DayTotals {
  date: string; // YYYY-MM-DD
  visits: number;
  uniqueMembers: number;
  byHour: Record<string, number>;
}

export interface MonthSummary {
  month: string; // YYYY-MM
  daysCounted: number;
  visits: number;
  uniqueMemberDays: number; // suma de socios distintos por día
  avgVisitsPerDay: number;
  peakHour: string | null; // "18" = 18:00–18:59
  byHour: Record<string, number>;
  busiestDay: { date: string; visits: number } | null;
}

/**
 * `daysCounted` son los días cerrados del mes (del 1 al último cerrado), con o sin
 * ingresos: un día sin visitas también baja la media.
 */
export function summarizeMonth(month: string, days: DayTotals[], daysCounted: number): MonthSummary {
  const byHour: Record<string, number> = {};
  let visits = 0;
  let uniqueMemberDays = 0;
  let busiestDay: MonthSummary['busiestDay'] = null;

  for (const d of days) {
    if (!d.date.startsWith(`${month}-`)) continue;
    visits += d.visits;
    uniqueMemberDays += d.uniqueMembers;
    for (const [hour, n] of Object.entries(d.byHour)) byHour[hour] = (byHour[hour] || 0) + n;
    if (d.visits > 0 && (!busiestDay || d.visits > busiestDay.visits)) busiestDay = { date: d.date, visits: d.visits };
  }

  let peakHour: string | null = null;
  for (const [hour, n] of Object.entries(byHour)) {
    if (n > 0 && (peakHour === null || n > byHour[peakHour] || (n === byHour[peakHour] && hour < peakHour))) peakHour = hour;
  }

  return {
    month,
    daysCounted,
    visits,
    uniqueMemberDays,
    avgVisitsPerDay: daysCounted > 0 ? Math.round((visits / daysCounted) * 10) / 10 : 0,
    peakHour,
    byHour,
    busiestDay,
  };
}

/** Día anterior a `date` (YYYY-MM-DD), sin depender de la zona horaria del servidor. */
export function previousDateKey(date: string, days = 1): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
