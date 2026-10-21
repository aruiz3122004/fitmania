import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';
import { formatInAppTz, getDateKeyInAppTz } from '@/lib/datetime';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';

/**
 * Exportes del panel admin en CSV (F2-29). Compatible con Excel (BOM UTF-8 y `;`).
 *
 * GET ?type=members
 * GET ?type=orders&from=YYYY-MM-DD&to=YYYY-MM-DD   (máx. 366 días)
 * GET ?type=entries&from=YYYY-MM-DD&to=YYYY-MM-DD  (máx. 92 días)
 */
export const maxDuration = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 50_000;

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmt(value: any): string {
  const d = toDate(value);
  return d ? formatInAppTz(d, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
}

/** Celda CSV segura: comillas escapadas y neutraliza fórmulas (=, +, -, @) contra inyección en Excel. */
function cell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
}

function rangeDays(from: string, to: string) {
  return (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000 + 1;
}

export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  // Freno a la extracción masiva si una sesión de admin se compromete.
  const rl = await limitAction(`export:${isAdmin.uid}`, 20, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Límite de exportes por hora alcanzado.');

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const db = getAdminFirestore();
    let csv = '';
    let label = '';

    if (type === 'members') {
      const snap = await db.collection('users').select('username', 'email', 'plan', 'createdAt').limit(MAX_ROWS).get();
      const now = Date.now();
      csv = toCsv(
        ['Nombre', 'Correo', 'Plan', 'Estado', 'Inicio', 'Vence', 'Registrado'],
        snap.docs.map((d) => {
          const u = d.data();
          const expira = toDate(u.plan?.expira);
          const estado = !u.plan ? 'Sin plan' : expira && expira.getTime() > now ? 'Activo' : 'Vencido';
          return [u.username, u.email, u.plan?.nombre || '', estado, fmt(u.plan?.inicio), fmt(u.plan?.expira), fmt(u.createdAt)];
        })
      );
      label = 'socios';
    } else if (type === 'orders' || type === 'entries') {
      const maxDays = type === 'orders' ? 366 : 92;
      if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
        return NextResponse.json({ error: 'Rango inválido (from/to en YYYY-MM-DD).' }, { status: 400 });
      }
      if (rangeDays(from, to) > maxDays) {
        return NextResponse.json({ error: `El rango máximo es de ${maxDays} días.` }, { status: 400 });
      }

      if (type === 'orders') {
        // `fecha` es Date: rango en hora de Colombia (UTC-5, sin horario de verano).
        const start = new Date(`${from}T00:00:00-05:00`);
        const end = new Date(`${to}T23:59:59.999-05:00`);
        const snap = await db.collection('orders').where('fecha', '>=', start).where('fecha', '<=', end).limit(MAX_ROWS).get();
        csv = toCsv(
          ['Fecha', 'Orden', 'Cliente', 'Correo', 'Tipo', 'Detalle', 'Total COP', 'Estado', 'Archivada'],
          snap.docs
            .map((d) => ({ id: d.id, o: d.data() }))
            .sort((a, b) => (toDate(a.o.fecha)?.getTime() || 0) - (toDate(b.o.fecha)?.getTime() || 0))
            .map(({ id, o }) => [
              fmt(o.fecha), id, o.customerName, o.customerEmail,
              o.type === 'plan' ? 'Plan' : 'Productos',
              o.type === 'plan' ? o.concepto : (o.items || []).map((it: any) => `${it.nombre} x${it.cantidad}`).join(', '),
              o.total, o.status, o.archived ? 'Sí' : 'No',
            ])
        );
        label = `ventas_${from}_${to}`;
      } else {
        const snap = await db.collection('entry_logs').where('date', '>=', from).where('date', '<=', to).limit(MAX_ROWS).get();
        csv = toCsv(
          ['Fecha', 'Hora', 'Socio', 'Plan activo', 'Plan', 'Autorizado por', 'Origen'],
          snap.docs
            .map((d) => d.data())
            .sort((a, b) => (toDate(a.timestamp)?.getTime() || 0) - (toDate(b.timestamp)?.getTime() || 0))
            .map((e) => {
              const ts = toDate(e.timestamp);
              return [
                e.date,
                ts ? formatInAppTz(ts, { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
                e.userName, e.hasPlanActivo ? 'Sí' : 'No', e.planNombre || '', e.authorizedBy || '', e.source || 'qr',
              ];
            })
        );
        label = `ingresos_${from}_${to}`;
      }
    } else {
      return NextResponse.json({ error: 'Tipo de exporte desconocido.' }, { status: 400 });
    }

    await recordAuditLog({
      action: 'EXPORT_DATA',
      category: 'ADMIN_ACTION',
      details: `Exporte ${label} descargado.`,
      adminEmail: isAdmin.email,
      targetId: type,
      request,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="fitmania_${label}_${getDateKeyInAppTz()}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[/api/admin/export]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
