import { NextResponse } from 'next/server';
import { getAdminFirestore, getAdminMessaging } from '@/lib/firebase-admin';
import { verifyUserRequest } from '@/lib/auth-helpers';
import { NEWS_TOPIC, prefsOf, tokenDocId, type PushPrefs } from '@/lib/push-server';

/**
 * Notificaciones push del socio (F3-13 / F3-15).
 * GET    → preferencias y si este dispositivo está registrado (?token=)
 * POST   { token }  → registra el dispositivo (y lo suscribe a noticias si aplica)
 * DELETE { token }  → lo da de baja
 * PATCH  { prefs: { entries?, news?, reminders? } } → guarda preferencias
 */
const KINDS: (keyof PushPrefs)[] = ['entries', 'news', 'reminders'];

function validToken(token: unknown): token is string {
  return typeof token === 'string' && token.length > 20 && token.length < 4096;
}

export async function GET(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  try {
    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(decoded.uid);
    const token = new URL(request.url).searchParams.get('token');
    const [user, tokenSnap] = await Promise.all([
      userRef.get(),
      validToken(token) ? userRef.collection('push_tokens').doc(tokenDocId(token)).get() : Promise.resolve(null),
    ]);
    return NextResponse.json({ prefs: prefsOf(user.data()), registered: !!tokenSnap?.exists });
  } catch (error) {
    console.error('[/api/me/push GET]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!validToken(body?.token)) return NextResponse.json({ error: 'Token inválido.' }, { status: 400 });

  try {
    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(decoded.uid);
    await userRef.collection('push_tokens').doc(tokenDocId(body.token)).set(
      { token: body.token, userAgent: (request.headers.get('user-agent') || '').slice(0, 200), lastSeen: new Date() },
      { merge: true }
    );
    const prefs = prefsOf((await userRef.get()).data());
    if (prefs.news) await getAdminMessaging().subscribeToTopic([body.token], NEWS_TOPIC).catch(() => {});
    return NextResponse.json({ success: true, prefs });
  } catch (error) {
    console.error('[/api/me/push POST]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!validToken(body?.token)) return NextResponse.json({ error: 'Token inválido.' }, { status: 400 });
  try {
    const db = getAdminFirestore();
    await db.collection('users').doc(decoded.uid).collection('push_tokens').doc(tokenDocId(body.token)).delete();
    await getAdminMessaging().unsubscribeFromTopic([body.token], NEWS_TOPIC).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[/api/me/push DELETE]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const incoming = body?.prefs;
  if (!incoming || typeof incoming !== 'object') return NextResponse.json({ error: 'Preferencias inválidas.' }, { status: 400 });

  try {
    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(decoded.uid);
    const current = prefsOf((await userRef.get()).data());
    const next: PushPrefs = { ...current };
    for (const kind of KINDS) if (typeof incoming[kind] === 'boolean') next[kind] = incoming[kind];
    await userRef.set({ notificationPrefs: next }, { merge: true });

    // Mantener la suscripción al tema de noticias alineada con la preferencia.
    if (next.news !== current.news) {
      const tokens = (await userRef.collection('push_tokens').get()).docs.map((d) => String(d.data().token)).filter(Boolean);
      if (tokens.length) {
        const messaging = getAdminMessaging();
        await (next.news ? messaging.subscribeToTopic(tokens, NEWS_TOPIC) : messaging.unsubscribeFromTopic(tokens, NEWS_TOPIC)).catch(() => {});
      }
    }
    return NextResponse.json({ success: true, prefs: next });
  } catch (error) {
    console.error('[/api/me/push PATCH]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
