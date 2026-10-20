import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';
import { DAILY_STATS, toDailyStats, type DailyStats } from '@/lib/attendance';
import { formatInAppTz, getHourKeyInAppTz } from '@/lib/datetime';

/**
 * Asistencia para el panel admin (F3-02 mapa de concurrencia, F3-03 medias, F3-04 diario).
 *
 * GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD      → agregados diarios del rango (máx. 366 días)
 * GET  ?date=YYYY-MM-DD&entries=1&page=N   → diario: ingresos del día, paginados
 * POST { from, to }                        → reconstruye daily_stats desde entry_logs (máx. 92 días)
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const MAX_REBUILD_DAYS = 92;
const DIARY_PAGE_SIZE = 50;

function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function parseRange(from: string | null, to: string | null, maxDays: number) {
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return { error: 'Rango inválido: usa from y to con formato YYYY-MM-DD (from <= to).' };
  }
  const days = daysBetween(from, to);
  if (days.length > maxDays) return { error: `El rango máximo es de ${maxDays} días.` };
  return { days };
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const db = getAdminFirestore();

    // ─── Diario de un día ───
    if (searchParams.get('entries')) {
      const date = searchParams.get('date');
      if (!date || !DATE_RE.test(date)) {
        return NextResponse.json({ error: 'Parámetro `date` requerido (YYYY-MM-DD).' }, { status: 400 });
      }
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const snap = await db.collection('entry_logs').where('date', '==', date).get();
      const all = snap.docs
        .map((doc) => {
          const d = doc.data();
          const ts = toDate(d.timestamp) || new Date(0);
          return {
            id: doc.id,
            userName: d.userName || 'Socio',
            hasPlanActivo: !!d.hasPlanActivo,
            planNombre: d.planNombre || null,
            hora: formatInAppTz(ts, { hour: '2-digit', minute: '2-digit', hour12: false }),
            authorizedBy: d.authorizedBy || null,
            ts: ts.getTime(),
          };
        })
        .sort((a, b) => b.ts - a.ts);
      const totalPages = Math.max(1, Math.ceil(all.length / DIARY_PAGE_SIZE));
      const entries = all.slice((page - 1) * DIARY_PAGE_SIZE, page * DIARY_PAGE_SIZE).map(({ ts: _ts, ...e }) => e);
      return NextResponse.json({ date, entries, totalCount: all.length, currentPage: page, totalPages });
    }

    // ─── Agregados de un rango ───
    const range = parseRange(searchParams.get('from'), searchParams.get('to'), MAX_RANGE_DAYS);
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });

    const days = range.days!;
    const snap = await db
      .collection(DAILY_STATS)
      .where('date', '>=', days[0])
      .where('date', '<=', days[days.length - 1])
      .get();
    const byDate = new Map(snap.docs.map((doc) => [doc.id, doc.data()]));
    // Días sin ingresos se devuelven en 0 para que las medias cuenten días reales del calendario.
    const stats: DailyStats[] = days.map((date) => toDailyStats(date, byDate.get(date)));

    return NextResponse.json({ days: stats });
  } catch (error) {
    console.error('[/api/admin/attendance GET]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const body = await request.json().catch(() => null);
    const range = parseRange(body?.from ?? null, body?.to ?? null, MAX_REBUILD_DAYS);
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });
    const days = range.days!;

    const db = getAdminFirestore();
    const snap = await db
      .collection('entry_logs')
      .where('date', '>=', days[0])
      .where('date', '<=', days[days.length - 1])
      .get();

    // Recalcular desde cero cada día del rango.
    const acc = new Map<string, DailyStats & { members: Set<string> }>();
    for (const date of days) {
      acc.set(date, { date, visits: 0, uniqueMembers: 0, withPlan: 0, withoutPlan: 0, byHour: {}, members: new Set() });
    }
    for (const doc of snap.docs) {
      const d = doc.data();
      const day = acc.get(d.date);
      const ts = toDate(d.timestamp);
      if (!day || !ts) continue;
      day.visits++;
      if (d.hasPlanActivo) day.withPlan++;
      else day.withoutPlan++;
      const hour = getHourKeyInAppTz(ts);
      day.byHour[hour] = (day.byHour[hour] || 0) + 1;
      if (d.userId) day.members.add(d.userId);
    }

    const writer = db.bulkWriter();
    for (const { members, ...day } of acc.values()) {
      writer.set(db.collection(DAILY_STATS).doc(day.date), {
        ...day,
        uniqueMembers: members.size,
        updatedAt: new Date(),
        rebuiltAt: new Date(),
      });
    }
    await writer.close();

    await recordAuditLog({
      action: 'REBUILD_ATTENDANCE_STATS',
      category: 'ADMIN_ACTION',
      details: `Agregados de asistencia recalculados del ${days[0]} al ${days[days.length - 1]} (${snap.size} ingresos).`,
      adminEmail: isAdmin.email,
      targetId: `${days[0]}_${days[days.length - 1]}`,
      request,
    });

    return NextResponse.json({ success: true, days: days.length, entries: snap.size });
  } catch (error) {
    console.error('[/api/admin/attendance POST]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
