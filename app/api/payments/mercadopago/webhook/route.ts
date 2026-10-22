import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getPayment, verifyWebhookSignature, MercadoPagoError } from '@/lib/payments/mercadopago';
import { syncMercadoPagoPayment } from '@/lib/payments/fulfillment';

// Margen para la transacción, el reembolso automático y los correos en segundo plano.
export const maxDuration = 30;

/**
 * POST /api/payments/mercadopago/webhook (F1-19).
 *
 * Mercado Pago avisa con `?type=payment&data.id=<id>` (o el formato IPN antiguo
 * `?topic=payment&id=<id>`). El aviso solo dispara la consulta: el estado se lee de
 * la API con nuestro access token, así un aviso falso no puede aprobar nada.
 * Con `MERCADOPAGO_WEBHOOK_SECRET` además se exige la firma `x-signature`.
 *
 * Respuestas: 200 si se procesó o no aplica; 401 con firma inválida; 5xx si algo
 * falló, para que Mercado Pago reintente.
 */
export async function POST(req: NextRequest) {
  const url = req.nextUrl;
  const body = await req.json().catch(() => null);

  const type = url.searchParams.get('type') || url.searchParams.get('topic') || body?.type || body?.topic;
  const dataId = url.searchParams.get('data.id') || url.searchParams.get('id') || body?.data?.id || null;

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (secret) {
    const valid = verifyWebhookSignature({
      xSignature: req.headers.get('x-signature'),
      xRequestId: req.headers.get('x-request-id'),
      dataId: dataId ? String(dataId) : null,
      secret,
    });
    if (!valid) {
      console.warn('[mp-webhook] Firma inválida', { type, dataId });
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
    }
  }

  // Solo interesan los pagos (merchant_order, etc. se confirman como recibidos).
  if (type !== 'payment' || !dataId || !/^\d+$/.test(String(dataId))) {
    return NextResponse.json({ received: true });
  }

  try {
    const payment = await getPayment(String(dataId));
    const result = await syncMercadoPagoPayment(getAdminFirestore(), payment);
    console.log(`[mp-webhook] pago ${payment.id} (${payment.status}) ref ${payment.external_reference}: ${result}`);
    return NextResponse.json({ received: true, result });
  } catch (err: any) {
    // Pago inexistente (p. ej. la notificación de prueba del panel): no reintentar.
    if (err instanceof MercadoPagoError && err.status === 404) {
      return NextResponse.json({ received: true, result: 'not_found' });
    }
    console.error('[mp-webhook] Error procesando el pago', dataId, err?.message || err);
    return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 });
  }
}
