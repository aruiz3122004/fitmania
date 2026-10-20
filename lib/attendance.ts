import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';

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
