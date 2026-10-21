import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyReceptionRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';
import { getDateKeyInAppTz } from '@/lib/datetime';

/**
 * Cierre de caja diario de recepción (F3-24).
 * GET  ?date=YYYY-MM-DD → ventas en mostrador del día por medio de pago, ingresos
 *                         registrados y cierres ya hechos.
 * POST { countedCash, notes } → registra el cierre de HOY con la diferencia entre el
 *                         efectivo contado y el esperado; avisa al admin.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function daySummary(date: string) {
  const db = getAdminFirestore();
  // Colombia no tiene horario de verano: el día local es [00:00, 24:00) en UTC-5.
  const start = new Date(`${date}T00:00:00-05:00`);
  const end = new Date(`${date}T23:59:59.999-05:00`);
  const [ordersSnap, statsSnap, closuresSnap] = await Promise.all([
    db.collection('orders').where('fecha', '>=', start).where('fecha', '<=', end).get(),
    db.collection('daily_stats').doc(date).get(),
    db.collection('cash_closures').where('date', '==', date).get(),
  ]);

  const sales = ordersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((o) => o.channel === 'pos')
    .map((o) => ({
      id: o.id,
      total: Number(o.total) || 0,
      paymentMethod: o.paymentMethod,
      soldBy: o.soldBy || null,
      hora: o.fecha?.toDate ? o.fecha.toDate().toISOString() : null,
      items: (o.items || []).map((it: any) => `${it.nombre} x${it.cantidad}`).join(', '),
    }))
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

  const totals = { efectivo: 0, datafono: 0, transferencia: 0 } as Record<string, number>;
  for (const s of sales) totals[s.paymentMethod] = (totals[s.paymentMethod] || 0) + s.total;

  return {
    date,
    sales,
    totals,
    totalSales: sales.reduce((acc, s) => acc + s.total, 0),
    entries: Number(statsSnap.data()?.visits) || 0,
    closures: closuresSnap.docs.map((d) => {
      const c = d.data();
      return {
        id: d.id,
        countedCash: c.countedCash,
        expectedCash: c.expectedCash,
        difference: c.difference,
        closedBy: c.closedBy,
        closedAt: c.closedAt?.toDate ? c.closedAt.toDate().toISOString() : null,
        notes: c.notes || null,
      };
    }),
  };
}

export async function GET(request: NextRequest) {
  const decoded = await verifyReceptionRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const date = request.nextUrl.searchParams.get('date') || getDateKeyInAppTz();
  if (!DATE_RE.test(date)) return NextResponse.json({ error: 'Fecha inválida.' }, { status: 400 });
  try {
    return NextResponse.json(await daySummary(date));
  } catch (error) {
    console.error('[/api/recepcion/cash-close GET]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const decoded = await verifyReceptionRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const countedCash = Number(body?.countedCash);
  const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 500) : '';
  if (!Number.isFinite(countedCash) || countedCash < 0 || countedCash > 1_000_000_000) {
    return NextResponse.json({ error: 'Ingresa el efectivo contado.' }, { status: 400 });
  }

  try {
    const date = getDateKeyInAppTz();
    const summary = await daySummary(date);
    const expectedCash = summary.totals.efectivo || 0;
    const difference = countedCash - expectedCash;
    const db = getAdminFirestore();
    const ref = await db.collection('cash_closures').add({
      date,
      countedCash,
      expectedCash,
      difference,
      totals: summary.totals,
      totalSales: summary.totalSales,
      salesCount: summary.sales.length,
      entries: summary.entries,
      notes: notes || null,
      closedBy: decoded.email || null,
      closedByUid: decoded.uid,
      closedAt: new Date(),
    });
    const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
    await db.collection('notifications').add({
      tipo: 'cash_close',
      mensaje: `Cierre de caja ${date} por ${decoded.email || 'recepción'}: ventas ${fmt(summary.totalSales)}, efectivo esperado ${fmt(expectedCash)}, contado ${fmt(countedCash)}${difference ? ` (diferencia ${fmt(difference)})` : ' (cuadra)'}. Ingresos: ${summary.entries}.`,
      leido: false,
      fecha: new Date(),
    });
    await recordAuditLog({
      action: 'CASH_CLOSE',
      category: 'ADMIN_ACTION',
      details: `Cierre de caja ${date}: esperado ${expectedCash}, contado ${countedCash}, diferencia ${difference}.`,
      adminEmail: decoded.email,
      targetId: ref.id,
      request,
    });
    return NextResponse.json({ success: true, id: ref.id, expectedCash, difference });
  } catch (error) {
    console.error('[/api/recepcion/cash-close POST]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
