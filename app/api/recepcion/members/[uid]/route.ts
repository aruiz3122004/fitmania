import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyReceptionRequest } from '@/lib/auth-helpers';
import { maskEmail, projectMemberSummary, toDateValue, toSeconds } from '@/lib/reception-members';

const HISTORY_LIMIT = 5;

/**
 * GET /api/recepcion/members/:uid — ficha del socio escaneado (F2-18).
 *
 * Una lectura del socio + sus últimas órdenes y check-ins, con datos mínimos.
 * Reemplaza las lecturas directas del navegador a `users`, `orders` y `checkIns`.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const decoded = await verifyReceptionRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { uid } = await params;
  if (!uid || uid.includes('/') || uid.length > 128) {
    return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Socio no encontrado.' }, { status: 404 });
    }
    const data = userSnap.data() || {};

    // Sin orderBy para no exigir índices compuestos; se ordena en memoria (pocos docs por socio).
    const [ordersSnap, checkInsSnap] = await Promise.all([
      db.collection('orders').where('uid', '==', uid).get(),
      db.collection('checkIns').where('userId', '==', uid).get(),
    ]);

    const byDateDesc = (a: Date | null, b: Date | null) => (b?.getTime() || 0) - (a?.getTime() || 0);

    const orders = ordersSnap.docs
      .map((d) => ({ id: d.id, raw: d.data() }))
      .sort((a, b) => byDateDesc(toDateValue(a.raw.fecha), toDateValue(b.raw.fecha)))
      .slice(0, HISTORY_LIMIT)
      .map(({ id, raw }) => ({
        id,
        fecha: toSeconds(raw.fecha),
        total: Number(raw.total) || 0,
        concepto: raw.concepto || null,
        items: Array.isArray(raw.items) ? raw.items.map((it: any) => ({ nombre: it.nombre, cantidad: it.cantidad })) : [],
      }));

    const checkIns = checkInsSnap.docs
      .map((d) => ({ id: d.id, raw: d.data() }))
      .sort((a, b) => byDateDesc(toDateValue(a.raw.timestamp), toDateValue(b.raw.timestamp)))
      .slice(0, HISTORY_LIMIT)
      .map(({ id, raw }) => ({ id, timestamp: toSeconds(raw.timestamp) }));

    return NextResponse.json({
      member: {
        ...projectMemberSummary(uid, data),
        email: maskEmail(data.email),
        createdAt: toSeconds(data.createdAt),
      },
      orders,
      checkIns,
    });
  } catch (error) {
    console.error('[/api/recepcion/members/:uid]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
