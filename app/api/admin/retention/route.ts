import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';

/**
 * GET /api/admin/retention?days=14 — socios con plan ACTIVO que no han venido en
 * N días (F3-26). Sirve para contactarlos antes de que abandonen.
 * `lastEntryAt` lo actualiza la transacción de cada ingreso.
 */
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
    const days = Math.min(90, Math.max(3, parseInt(searchParams.get('days') || '14', 10) || 14));
    const now = Date.now();
    const threshold = now - days * 86400000;

    const snap = await getAdminFirestore()
      .collection('users')
      .where('plan.expira', '>', new Date(now))
      .select('username', 'email', 'plan', 'lastEntryAt', 'createdAt')
      .get();

    const atRisk = snap.docs
      .map((doc) => {
        const u = doc.data();
        const last = toDate(u.lastEntryAt);
        const expira = toDate(u.plan?.expira);
        return {
          uid: doc.id,
          username: u.username || 'Socio',
          email: u.email || '',
          plan: u.plan?.nombre || '',
          expira: expira ? expira.toISOString() : null,
          lastEntryAt: last ? last.toISOString() : null,
          daysAbsent: last ? Math.floor((now - last.getTime()) / 86400000) : null,
        };
      })
      .filter((m) => !m.lastEntryAt || new Date(m.lastEntryAt).getTime() < threshold)
      .sort((a, b) => (b.daysAbsent ?? 9999) - (a.daysAbsent ?? 9999));

    return NextResponse.json({ days, activeMembers: snap.size, atRisk });
  } catch (error) {
    console.error('[/api/admin/retention]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
