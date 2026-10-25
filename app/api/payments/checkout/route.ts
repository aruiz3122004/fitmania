import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { isMfaSatisfied, mfaRequiredResponse } from '@/lib/mfa-server';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';
import { priceCheckout, CheckoutError } from '@/lib/payments/pricing';
import { createPreference, isMercadoPagoConfigured, type MpPreferenceInput } from '@/lib/payments/mercadopago';
import { SITE_URL } from '@/lib/site';

/**
 * POST /api/payments/checkout — inicia un pago con Mercado Pago (F1-18).
 *
 * Body: `{ planId }` o `{ items: [{ id, cantidad }] }`. El uid y el correo salen del
 * ID token; el monto lo calcula el servidor. Se guarda `payments/{ref}` en `pending`
 * con la foto del checkout y se devuelve la URL de Checkout Pro (tarjeta, PSE, Efecty).
 */
export async function POST(req: NextRequest) {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json({ error: 'El pago con Mercado Pago no está disponible por ahora.' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: 'Debes iniciar sesión para pagar.' }, { status: 401 });

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' }, { status: 401 });
  }
  if (!(await isMfaSatisfied(decoded))) return mfaRequiredResponse();
  if (!decoded.email) return NextResponse.json({ error: 'Tu cuenta no tiene un correo asociado.' }, { status: 400 });
  // F1-06: los recibos van a ese correo. El ID token puede ser anterior a la
  // verificación (se renueva cada hora): ante un "no", se consulta el estado real.
  if (!decoded.email_verified && !(await getAdminAuth().getUser(decoded.uid)).emailVerified) {
    return NextResponse.json(
      { error: 'Verifica tu correo antes de pagar. Revisa tu bandeja o reenvía el enlace desde tu perfil.', code: 'email_not_verified' },
      { status: 403 }
    );
  }

  // F1-10: límite por usuario (10 intentos cada 10 minutos).
  const rl = await limitAction(`pay:${decoded.uid}`, 10, 600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Demasiados intentos de pago. Espera unos minutos.');

  try {
    const body = await req.json().catch(() => ({}));
    const db = getAdminFirestore();

    let snapshot;
    try {
      snapshot = await priceCheckout(db, { planId: body?.planId, items: body?.items });
    } catch (err) {
      if (err instanceof CheckoutError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }

    const userSnap = await db.collection('users').doc(decoded.uid).get();
    const customerName = String(userSnap.data()?.username || decoded.name || decoded.email.split('@')[0]).slice(0, 100);
    const ref = `fm_${randomUUID()}`;

    // Mercado Pago solo acepta `auto_return` (volver solo al sitio) y `notification_url`
    // (webhook) con una URL https. En local sin túnel se omiten: el pago se confirma al
    // volver a /pago/resultado o en el cron. MERCADOPAGO_PUBLIC_URL (solo desarrollo)
    // apunta a un túnel https para probar ambos.
    const baseUrl = (process.env.MERCADOPAGO_PUBLIC_URL?.trim() || SITE_URL).replace(/\/$/, '');
    const isHttps = baseUrl.startsWith('https://');
    const resultUrl = `${baseUrl}/pago/resultado?ref=${ref}`;

    const preference: MpPreferenceInput = {
      items: snapshot.items.map((it) => ({
        id: it.id,
        title: it.nombre.slice(0, 250),
        quantity: it.cantidad,
        unit_price: it.precio,
        currency_id: 'COP',
      })),
      payer: { email: decoded.email },
      external_reference: ref,
      back_urls: { success: resultUrl, failure: resultUrl, pending: resultUrl },
      statement_descriptor: 'FITMANIA',
      metadata: { uid: decoded.uid, type: snapshot.type },
    };
    if (isHttps) {
      preference.auto_return = 'approved';
      preference.notification_url = `${baseUrl}/api/payments/mercadopago/webhook`;
    }

    // El pago queda registrado ANTES de enviar al cliente a Mercado Pago.
    const paymentRef = db.collection('payments').doc(ref);
    await paymentRef.set({
      gateway: 'mercadopago',
      status: 'pending',
      uid: decoded.uid,
      customerEmail: decoded.email,
      customerName,
      ...snapshot,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const pref = await createPreference(preference, ref);
    await paymentRef.update({ preferenceId: pref.id });

    return NextResponse.json({ url: pref.init_point, ref });
  } catch (error) {
    console.error('[/api/payments/checkout]', error);
    return NextResponse.json({ error: 'No se pudo iniciar el pago. Intenta de nuevo.' }, { status: 500 });
  }
}
