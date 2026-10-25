import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { summarizeMonth, previousDateKey } from '@/lib/attendance-month';

/**
 * Agregados de asistencia (F2-03 / F3-01).
 *
 * `daily_stats/{YYYY-MM-DD}` se actualiza en la MISMA transacción que registra
 * cada ingreso, así el mapa de concurrencia, las medias y el diario se leen en
 * O(1) por día en lugar de recorrer `entry_logs`:
 *
 *   { date, visits, uniqueMembers, withPlan, withoutPlan, byHour: { "06": n, ... }, updatedAt }
 *
 * - visits: ingresos registrados (un socio no se cuenta dos veces dentro de la
 *   ventana anti-duplicados de 3 h, pero sí si vuelve más tarde el mismo día).
 * - uniqueMembers: socios distintos del día (primer ingreso del día).
 */
export const DAILY_STATS = 'daily_stats';

export interface DailyStats {
  date: string;
  visits: number;
  uniqueMembers: number;
  withPlan: number;
  withoutPlan: number;
  byHour: Record<string, number>;
}

export function recordEntryInDailyStats(
  db: Firestore,
  tx: Transaction,
  params: { date: string; hourKey: string; isFirstOfDay: boolean; hasPlanActivo: boolean }
) {
  const ref = db.collection(DAILY_STATS).doc(params.date);
  tx.set(
    ref,
    {
      date: params.date,
      visits: FieldValue.increment(1),
      uniqueMembers: FieldValue.increment(params.isFirstOfDay ? 1 : 0),
      withPlan: FieldValue.increment(params.hasPlanActivo ? 1 : 0),
      withoutPlan: FieldValue.increment(params.hasPlanActivo ? 0 : 1),
      byHour: { [params.hourKey]: FieldValue.increment(1) },
      updatedAt: new Date(),
    },
    { merge: true }
  );
}

/** Normaliza un documento de `daily_stats` (campos faltantes en 0). */
export function toDailyStats(date: string, data: FirebaseFirestore.DocumentData | undefined): DailyStats {
  const byHour: Record<string, number> = {};
  for (const [hour, count] of Object.entries(data?.byHour || {})) byHour[hour] = Number(count) || 0;
  return {
    date,
    visits: Number(data?.visits) || 0,
    uniqueMembers: Number(data?.uniqueMembers) || 0,
    withPlan: Number(data?.withPlan) || 0,
    withoutPlan: Number(data?.withoutPlan) || 0,
    byHour,
  };
}

export const MONTHLY_STATS = 'monthly_stats';
/** Días hacia atrás que revisa el cierre (por si el cron no corrió algún día). */
const CLOSE_LOOKBACK_DAYS = 3;
/** La planilla manual (F2-07) admite ingresos de hasta 7 días atrás: esos meses se recalculan. */
const MANUAL_ENTRY_DAYS = 7;

/**
 * Cierre diario (F3-01): marca `closedAt` en los días anteriores a `today` que no
 * estén cerrados (sin tocar los contadores; si no hubo ingresos el día queda en 0) y
 * recalcula `monthly_stats/{YYYY-MM}` de los meses que aún pueden cambiar. Idempotente.
 */
export async function closeDailyStats(db: Firestore, today: string) {
  const closed: string[] = [];
  for (let i = CLOSE_LOOKBACK_DAYS; i >= 1; i--) {
    const date = previousDateKey(today, i);
    const ref = db.collection(DAILY_STATS).doc(date);
    const snap = await ref.get();
    if (snap.data()?.closedAt) continue;
    await ref.set({ date, closedAt: new Date() }, { merge: true });
    closed.push(date);
  }

  const months = new Set<string>();
  for (let i = 1; i <= MANUAL_ENTRY_DAYS + 1; i++) months.add(previousDateKey(today, i).slice(0, 7));

  for (const month of months) {
    const snap = await db
      .collection(DAILY_STATS)
      .where('date', '>=', `${month}-01`)
      .where('date', '<=', `${month}-31`)
      .get();
    const days = snap.docs.map((d) => toDailyStats(d.id, d.data()));
    // Días del mes hasta el último cerrado (incluye los días sin ingresos).
    const lastClosed = snap.docs
      .filter((d) => d.data().closedAt)
      .map((d) => d.id)
      .sort()
      .pop();
    const daysCounted = lastClosed ? Number(lastClosed.slice(8, 10)) : 0;
    await db.collection(MONTHLY_STATS).doc(month).set({ ...summarizeMonth(month, days, daysCounted), updatedAt: new Date() });
  }

  return { closed, months: [...months] };
}
