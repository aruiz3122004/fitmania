import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminFirestore, getAdminMessaging } from '@/lib/firebase-admin';
import { isWithinCommercialHours } from '@/lib/commercial-hours';

/**
 * Notificaciones push (F3-13 / F3-14 / F3-15) con Firebase Cloud Messaging.
 *
 * - Tokens: `users/{uid}/push_tokens/{hash}` (solo el servidor los lee).
 * - Preferencias: `users/{uid}.notificationPrefs` { entries, news, reminders }.
 * - Noticias: tema `news` (los socios con `news: true` quedan suscritos).
 * - Ley 2300 de 2023: los mensajes informativos/comerciales (noticias) solo se
 *   envían de lunes a viernes 7:00–19:00 y sábados 8:00–15:00 (hora Colombia);
 *   los transaccionales (ingreso, vencimiento) se envían en cualquier momento.
 *   TODO: excluir también los festivos nacionales.
 */
export type PushKind = 'entries' | 'news' | 'reminders';
export type PushPrefs = Record<PushKind, boolean>;
export const DEFAULT_PUSH_PREFS: PushPrefs = { entries: true, news: true, reminders: true };
export const NEWS_TOPIC = 'news';

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
}

export function tokenDocId(token: string) {
  return createHash('sha256').update(token).digest('hex').slice(0, 40);
}

export function prefsOf(data: any): PushPrefs {
  return { ...DEFAULT_PUSH_PREFS, ...(data?.notificationPrefs || {}) };
}

function webpushPayload(msg: PushMessage) {
  const url = msg.url || '/';
  return {
    // `data` duplica el contenido: el service worker propio lo lee de ahí.
    data: { title: msg.title, body: msg.body, url },
    webpush: {
      notification: { title: msg.title, body: msg.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' },
      fcmOptions: { link: url },
    },
  };
}

/** Envía a todos los dispositivos del socio si su preferencia lo permite. Limpia tokens inválidos. */
export async function sendPushToUser(uid: string, kind: PushKind, msg: PushMessage, db: Firestore = getAdminFirestore()) {
  try {
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists || !prefsOf(userSnap.data())[kind]) return 0;
    const tokensSnap = await db.collection('users').doc(uid).collection('push_tokens').get();
    const tokens = tokensSnap.docs.map((d) => String(d.data().token)).filter(Boolean);
    if (tokens.length === 0) return 0;

    const result = await getAdminMessaging().sendEachForMulticast({ tokens, ...webpushPayload(msg) });
    const invalid = result.responses
      .map((r, i) => (!r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code || '') ? tokens[i] : null))
      .filter((t): t is string => !!t);
    await Promise.all(invalid.map((t) => db.collection('users').doc(uid).collection('push_tokens').doc(tokenDocId(t)).delete()));
    return result.successCount;
  } catch (error) {
    console.error('[push] Error enviando al socio', uid, error);
    return 0;
  }
}

export async function sendPushToTopic(topic: string, msg: PushMessage) {
  try {
    await getAdminMessaging().send({ topic, ...webpushPayload(msg) });
    return true;
  } catch (error) {
    console.error('[push] Error enviando al tema', topic, error);
    return false;
  }
}

/**
 * Envía el push de las noticias publicadas que aún no lo tuvieron, si estamos en la
 * franja permitida. Se llama al publicar y desde el cron diario.
 */
export async function sendPendingNewsPush(db: Firestore = getAdminFirestore()) {
  if (!isWithinCommercialHours()) return 0;
  const now = new Date();
  const snap = await db.collection('news').where('published', '==', true).get();
  let sent = 0;
  for (const doc of snap.docs) {
    const n = doc.data();
    const publishAt = n.publishAt?.toDate ? n.publishAt.toDate() : null;
    if (n.pushSentAt || (publishAt && publishAt > now)) continue;
    // Se marca primero para no reenviar si dos procesos coinciden.
    await doc.ref.update({ pushSentAt: now });
    if (await sendPushToTopic(NEWS_TOPIC, { title: `📣 ${n.titulo}`, body: String(n.descripcion || '').slice(0, 140), url: '/foro' })) sent++;
  }
  return sent;
}
