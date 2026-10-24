import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';
import { reconcileReference } from '@/lib/payments/reconcile';

// La conciliación puede aplicar el pago (transacción + reembolso automático).
export const maxDuration = 30;

/**
 * GET /api/payments/status?ref=<ref>&payment_id=<id> — estado de un pago propio.
 *
 * Lo usa /pago/resultado al volver de Mercado Pago. Si el pago sigue `pending`, se
 * consulta a Mercado Pago y se aplica (por si el webhook no llegó o tarda).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
  }

  const ref = req.nextUrl.searchParams.get('ref') || '';
  if (!/^fm_[0-9a-f-]{36}$/.test(ref)) return NextResponse.json({ error: 'Referencia no válida.' }, { status: 400 });

  const rl = await limitAction(`pay-status:${uid}`, 30, 600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  try {
    const db = getAdminFirestore();
    const paymentRef = db.collection('payments').doc(ref);
    let snap = await paymentRef.get();
    // Misma respuesta si no existe o es de otra persona (no revela referencias ajenas).
    if (!snap.exists || snap.data()?.uid !== uid) {
      return NextResponse.json({ error: 'Pago no encontrado.' }, { status: 404 });
    }

    if (snap.data()?.status === 'pending' || snap.data()?.status === 'rejected') {
      try {
        await reconcileReference(db, ref, req.nextUrl.searchParams.get('payment_id') || undefined);
        snap = await paymentRef.get();
      } catch (err: any) {
        // Si Mercado Pago no responde se informa el estado guardado; el webhook o el cron lo completan.
        console.error('[/api/payments/status] conciliación', ref, err?.message || err);
      }
    }

    const data = snap.data()!;
    return NextResponse.json({
      status: data.status,
      type: data.type,
      // Para "Intentar nuevamente" en /pago/resultado.
      planId: data.planId || null,
      concept: data.concept,
      amount: data.amount,
      method: data.method || null,
      paymentId: data.mpPaymentId || null,
    });
  } catch (error) {
    console.error('[/api/payments/status]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
