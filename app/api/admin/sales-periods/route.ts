import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';

/**
 * Cierres de periodo de ventas (F2-24).
 *
 * Reemplaza el "archivar ventas" como cierre contable: en lugar de marcar órdenes,
 * se calcula y guarda un resumen inmutable por mes en `sales_periods/{YYYY-MM}`.
 * Las órdenes no se modifican, así los ingresos de cualquier mes siguen consultables.
 *
 * GET  → últimos 24 cierres
 * POST { month: 'YYYY-MM' } → calcula (o recalcula) el cierre del mes
 */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const snap = await getAdminFirestore().collection('sales_periods').orderBy('month', 'desc').limit(24).get();
    return NextResponse.json(snap.docs.map((d) => {
      const p = d.data();
      return { ...p, closedAt: p.closedAt?.toDate ? p.closedAt.toDate().toISOString() : null };
    }));
  } catch (error) {
    console.error('[/api/admin/sales-periods GET]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const month = typeof body?.month === 'string' ? body.month : '';
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: 'Mes inválido (YYYY-MM).' }, { status: 400 });

  try {
    const [y, m] = month.split('-').map(Number);
    // Límites del mes en hora de Colombia (UTC-5, sin horario de verano).
    const start = new Date(`${month}-01T00:00:00-05:00`);
    const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    const end = new Date(`${nextMonth}-01T00:00:00-05:00`);

    const db = getAdminFirestore();
    const snap = await db.collection('orders').where('fecha', '>=', start).where('fecha', '<', end).get();

    const summary = {
      month,
      orders: snap.size,
      plans: { count: 0, total: 0 },
      web: { count: 0, total: 0 },
      pos: { count: 0, total: 0, byMethod: { efectivo: 0, datafono: 0, transferencia: 0 } as Record<string, number> },
      refunds: 0,
      gross: 0,
      net: 0,
    };

    for (const doc of snap.docs) {
      const o = doc.data();
      const total = Number(o.total) || 0;
      summary.gross += total;
      summary.refunds += Number(o.amountRefunded ?? o.refund?.amount ?? 0) || 0;
      if (o.channel === 'pos') {
        summary.pos.count++;
        summary.pos.total += total;
        summary.pos.byMethod[o.paymentMethod] = (summary.pos.byMethod[o.paymentMethod] || 0) + total;
      } else if (o.type === 'plan') {
        summary.plans.count++;
        summary.plans.total += total;
      } else {
        summary.web.count++;
        summary.web.total += total;
      }
    }
    summary.net = summary.gross - summary.refunds;

    await db.collection('sales_periods').doc(month).set({
      ...summary,
      closedAt: new Date(),
      closedBy: isAdmin.email || null,
    });

    await recordAuditLog({
      action: 'CLOSE_SALES_PERIOD',
      category: 'ADMIN_ACTION',
      details: `Cierre de ventas ${month}: bruto ${summary.gross}, reembolsos ${summary.refunds}, neto ${summary.net} (${summary.orders} órdenes).`,
      adminEmail: isAdmin.email,
      actorUid: isAdmin.uid,
      targetId: month,
      request,
    });

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error('[/api/admin/sales-periods POST]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
