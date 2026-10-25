import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { syncMercadoPagoPayment } from '@/lib/payments/fulfillment';
import { sandboxOnly } from '@/lib/sandbox/server';

/**
 * POST /api/sandbox/pay { ref, outcome: 'approved' | 'rejected', method } — pasarela
 * simulada. Arma el pago como lo devolvería Mercado Pago y lo aplica con la misma
 * función que el webhook real: activa el plan o descuenta stock, crea la orden, el
 * aviso al panel y el correo (que llega al buzón del sandbox).
 */
const METHODS: Record<string, { payment_method_id: string; payment_type_id: string }> = {
  visa: { payment_method_id: 'visa', payment_type_id: 'credit_card' },
  pse: { payment_method_id: 'pse', payment_type_id: 'bank_transfer' },
  efecty: { payment_method_id: 'efecty', payment_type_id: 'ticket' },
};

export async function POST(request: Request) {
  const notHere = sandboxOnly();
  if (notHere) return notHere;

  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ref = typeof body?.ref === 'string' ? body.ref : '';
  const outcome = body?.outcome === 'rejected' ? 'rejected' : 'approved';
  const method = METHODS[body?.method] ?? METHODS.visa;
  if (!/^fm_[0-9a-f-]{36}$/.test(ref)) return NextResponse.json({ error: 'Referencia no válida.' }, { status: 400 });

  const db = getAdminFirestore();
  const snap = await db.collection('payments').doc(ref).get();
  if (!snap.exists || snap.data()?.uid !== uid) return NextResponse.json({ error: 'Pago no encontrado.' }, { status: 404 });
  if (snap.data()?.status !== 'pending') return NextResponse.json({ error: 'Este pago ya se procesó.' }, { status: 409 });

  const now = new Date().toISOString();
  const result = await syncMercadoPagoPayment(db, {
    id: randomInt(100_000_000, 999_999_999),
    status: outcome,
    status_detail: outcome === 'approved' ? 'accredited' : 'cc_rejected_insufficient_amount',
    external_reference: ref,
    transaction_amount: Number(snap.data()?.amount) || 0,
    currency_id: 'COP',
    ...method,
    date_created: now,
    date_approved: outcome === 'approved' ? now : null,
  });

  return NextResponse.json({ result, redirect: `/pago/resultado?ref=${ref}` });
}
