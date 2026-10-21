import type { Firestore } from 'firebase-admin/firestore';
import { formatInAppTz, getDateKeyInAppTz } from '@/lib/datetime';
import { sendPlanReminderEmail } from '@/services/mail';
import { SITE_URL } from '@/lib/site';

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
  /** Recordatorios enviados por correo a los socios (F3-22). */
  emailed: number;
}

export async function generatePlanExpiryNotifications(
  db: Firestore
): Promise<NotificationGenerationResult> {
  const now = new Date();
  const dateKey = getDateKeyInAppTz(now);

  const usersSnapshot = await db.collection('users').where('plan', '!=', null).get();

  // F2-23: sin N+1 ni límite de 500. Antes se hacía un `get()` por socio para ver si
  // el aviso ya existía y todo iba en un único batch (falla con >500 escrituras).
  // Ahora `create()` con ID determinista falla solo si ya existe (idempotente) y
  // BulkWriter agrupa y reintenta las escrituras sin tope.
  const writer = db.bulkWriter();
  writer.onWriteError((error) => {
    if (error.code === 6 /* ALREADY_EXISTS: el aviso de hoy ya existe */) return false;
    return error.failedAttempts < 3;
  });

  let created = 0;
  let evaluated = 0;
  const pending: Promise<unknown>[] = [];
  // F3-22: recordatorio al SOCIO (antes solo se avisaba al admin). Se envía solo si el
  // aviso del día se creó en esta ejecución → como máximo un correo por umbral.
  const reminders: Parameters<typeof sendPlanReminderEmail>[0][] = [];

  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const plan = userData.plan;
    if (!plan || !plan.expira) continue;

    evaluated++;

    const expirationDate = plan.expira.toDate ? plan.expira.toDate() : new Date(plan.expira);
    const diffDays = Math.ceil(
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    let notifId: string | null = null;
    let mensaje = '';
    // ID determinista por (tipo, uid, día) → el job puede correr varias veces al día sin duplicar.
    if (diffDays <= 5 && diffDays > 1) {
      notifId = `plan5_${doc.id}_${dateKey}`;
      mensaje = `El plan de ${userData.displayName || userData.username} vence en ${diffDays} días.`;
    } else if (diffDays <= 1 && diffDays >= 0) {
      notifId = `plan1_${doc.id}_${dateKey}`;
      mensaje = `¡URGENTE! El plan de ${userData.displayName || userData.username} vence mañana.`;
    }
    if (!notifId) continue;

    pending.push(
      writer
        .create(db.collection('notifications').doc(notifId), {
          tipo: 'plan_expiry',
          mensaje,
          uid: doc.id,
          leido: false,
          fecha: new Date(),
        })
        .then(() => {
          created++;
          if (userData.email) {
            reminders.push({
              to: userData.email,
              customerName: userData.username || 'Socio',
              planName: plan.nombre || 'tu plan',
              daysLeft: diffDays,
              expiresOn: formatInAppTz(expirationDate, { day: 'numeric', month: 'long', year: 'numeric' }),
              renewUrl: plan.planId ? `${SITE_URL}/pago?planId=${encodeURIComponent(plan.planId)}` : `${SITE_URL}/planes`,
            });
          }
        })
        .catch(() => { /* ya existía o falló tras reintentos: no se cuenta */ })
    );
  }

  await writer.close();
  await Promise.all(pending);

  // Envío secuencial (pocos por día) para no exceder el rate limit del proveedor de correo.
  let emailed = 0;
  for (const reminder of reminders) {
    try {
      await sendPlanReminderEmail(reminder);
      emailed++;
    } catch (error) {
      console.error('[cron] No se pudo enviar el recordatorio de plan a', reminder.to, error);
    }
  }

  return { created, evaluated, emailed };
}
