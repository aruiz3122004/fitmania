import type { Firestore } from 'firebase-admin/firestore';
import { getDateKeyInAppTz } from '@/lib/datetime';

/**
 * T-18 (auditoría): la generación de notificaciones de "plan por vencer" se
 * desacopla del GET del panel admin. Antes, cada vez que un admin abría/recargaba
 * el panel se escaneaba TODA la colección `users` (coste y superficie innecesarios).
 *
 * Ahora esta lógica vive aquí y la ejecuta un job programado (Vercel Cron →
 * `/api/cron/notifications`). El GET del admin queda como **solo lectura**.
 */
export interface NotificationGenerationResult {
  /** Cantidad de notificaciones nuevas creadas en esta ejecución. */
  created: number;
  /** Cantidad de planes activos evaluados. */
  evaluated: number;
}

export async function generatePlanExpiryNotifications(
  db: Firestore
): Promise<NotificationGenerationResult> {
  const now = new Date();
  const dateKey = getDateKeyInAppTz(now);

  const usersSnapshot = await db.collection('users').where('plan', '!=', null).get();
  const batch = db.batch();
  let created = 0;
  let evaluated = 0;

  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const plan = userData.plan;
    if (!plan || !plan.expira) continue;

    evaluated++;

    const expirationDate = plan.expira.toDate ? plan.expira.toDate() : new Date(plan.expira);
    const diffDays = Math.ceil(
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const planRef = db.collection('notifications');

    // ID determinista por (tipo, uid, día) → idempotente: el job puede correr
    // varias veces al día sin duplicar avisos.
    if (diffDays <= 5 && diffDays > 1) {
      const notifId = `plan5_${doc.id}_${dateKey}`;
      const notifRef = planRef.doc(notifId);
      const existing = await notifRef.get();
      if (!existing.exists) {
        batch.set(notifRef, {
          tipo: 'plan_expiry',
          mensaje: `El plan de ${userData.displayName || userData.username} vence en 5 días.`,
          uid: doc.id,
          leido: false,
          fecha: new Date(),
        });
        created++;
      }
    } else if (diffDays <= 1 && diffDays >= 0) {
      const notifId = `plan1_${doc.id}_${dateKey}`;
      const notifRef = planRef.doc(notifId);
      const existing = await notifRef.get();
      if (!existing.exists) {
        batch.set(notifRef, {
          tipo: 'plan_expiry',
          mensaje: `¡URGENTE! El plan de ${userData.displayName || userData.username} vence mañana.`,
          uid: doc.id,
          leido: false,
          fecha: new Date(),
        });
        created++;
      }
    }
  }

  if (created > 0) await batch.commit();

  return { created, evaluated };
}
