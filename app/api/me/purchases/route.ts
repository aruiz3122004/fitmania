import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyUserRequest } from '@/lib/auth-helpers';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';
import { buildPurchaseHistory, summarizePurchases, type RawDoc } from '@/lib/purchase-history';

/**
 * GET /api/me/purchases — historial de compras del usuario (/compras).
 *
 * `payments` no es legible desde el cliente (reglas), por eso lo arma el servidor:
 * pagos de Mercado Pago + órdenes históricas, solo del uid del token.
 */
const MAX_DOCS = 200;

export async function GET(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const rl = await limitAction(`purchases:${decoded.uid}`, 30, 600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  try {
    const db = getAdminFirestore();
    const [payments, orders] = await Promise.all([
      db.collection('payments').where('uid', '==', decoded.uid).limit(MAX_DOCS).get(),
      db.collection('orders').where('uid', '==', decoded.uid).limit(MAX_DOCS).get(),
    ]);
    const raw = (snap: FirebaseFirestore.QuerySnapshot): RawDoc[] => snap.docs.map((d) => ({ id: d.id, data: d.data() }));

    const purchases = buildPurchaseHistory(raw(payments), raw(orders));
    return NextResponse.json(
      { purchases, summary: summarizePurchases(purchases) },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error: any) {
    console.error('[/api/me/purchases]', error?.message || error);
    return NextResponse.json({ error: 'No se pudo cargar tu historial.' }, { status: 500 });
  }
}
