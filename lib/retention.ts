import type { Firestore } from 'firebase-admin/firestore';

/**
 * Política de retención de datos (F2-26, Ley 1581: los datos se conservan solo el
 * tiempo necesario para su finalidad). La ejecuta el cron diario por lotes.
 *
 * | Datos                         | Plazo     | Acción                                  |
 * |-------------------------------|-----------|-----------------------------------------|
 * | Ingresos (entry_logs/checkIns)| 24 meses  | Anonimizar nombre y correo              |
 * | Registro de correos           | 12 meses  | Borrar                                  |
 * | Notificaciones leídas         | 90 días   | Borrar                                  |
 * | Auditoría (audit_logs)        | 5 años    | Borrar                                  |
 * | Órdenes                       | 10 años   | Se conservan (Código de Comercio, art. 60) |
 */
const BATCH = 400;
const DAY = 86_400_000;

export interface RetentionResult {
  entriesAnonymized: number;
  emailEventsDeleted: number;
  notificationsDeleted: number;
  auditLogsDeleted: number;
}

export async function applyRetention(db: Firestore, now = new Date()): Promise<RetentionResult> {
  const result: RetentionResult = { entriesAnonymized: 0, emailEventsDeleted: 0, notificationsDeleted: 0, auditLogsDeleted: 0 };
  const writer = db.bulkWriter();

  // Ingresos de más de 24 meses: se conservan para estadísticas, sin identificar al socio.
  const entriesCutoff = new Date(now.getTime() - 730 * DAY);
  const oldEntries = await db.collection('entry_logs').where('timestamp', '<', entriesCutoff).orderBy('timestamp').limit(BATCH).get();
  for (const doc of oldEntries.docs) {
    if (doc.data().anonymizedAt) continue;
    writer.update(doc.ref, { userName: 'Socio', userEmail: '', anonymizedAt: now });
    writer.set(db.collection('checkIns').doc(doc.id), { userName: 'Socio' }, { merge: true });
    result.entriesAnonymized++;
  }

  const deleteOlderThan = async (collection: string, field: string, cutoff: Date, extra?: (d: FirebaseFirestore.DocumentData) => boolean) => {
    const snap = await db.collection(collection).where(field, '<', cutoff).orderBy(field).limit(BATCH).get();
    let n = 0;
    for (const doc of snap.docs) {
      if (extra && !extra(doc.data())) continue;
      writer.delete(doc.ref);
      n++;
    }
    return n;
  };

  result.emailEventsDeleted = await deleteOlderThan('email_events', 'createdAt', new Date(now.getTime() - 365 * DAY));
  result.notificationsDeleted = await deleteOlderThan('notifications', 'fecha', new Date(now.getTime() - 90 * DAY), (d) => d.leido === true);
  result.auditLogsDeleted = await deleteOlderThan('audit_logs', 'timestamp', new Date(now.getTime() - 5 * 365 * DAY));

  await writer.close();
  return result;
}
