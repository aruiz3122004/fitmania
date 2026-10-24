import { NextRequest, NextResponse } from 'next/server';
import type { Query } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyReceptionRequest } from '@/lib/auth-helpers';
import { projectMemberSummary, EXPIRING_DAYS } from '@/lib/reception-members';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';

const FILTERS = ['active', 'expiring', 'expired', 'none', 'all'] as const;
type Filter = (typeof FILTERS)[number];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000; // lista de vigentes para el caché sin conexión (F2-06)

/**
 * GET /api/recepcion/members?status=&q=&cursor=&limit= — directorio de socios (F2-18 / F3-05).
 *
 * Solo nombre, foto, plan, estado y días restantes (sin correo, peso ni altura).
 * - status=active (vigentes, por defecto), expiring (≤ 5 días) y expired se consultan
 *   por rango de `plan.expira`: abrir recepción ya no lee toda la colección `users`.
 * - status=none / all y la búsqueda `q` recorren la colección con `select()` mínimo;
 *   solo se usan cuando recepción lo pide.
 * Paginación: `cursor` es el id del último socio (por rango) o el desplazamiento (recorrido).
 */
export async function GET(request: NextRequest) {
  const decoded = await verifyReceptionRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  // Freno a la extracción masiva si una sesión de recepción se compromete.
  // Filtros, búsqueda y paginación hacen varias consultas por uso normal (páginas de 50).
  const rl = await limitAction(`members:${decoded.uid}`, 200, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const params = request.nextUrl.searchParams;
  const status = (FILTERS as readonly string[]).includes(params.get('status') || '') ? (params.get('status') as Filter) : 'active';
  const q = (params.get('q') || '').trim().toLowerCase().slice(0, 50);
  const cursor = params.get('cursor') || '';
  const limit = Math.min(Math.max(Number(params.get('limit')) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  try {
    const db = getAdminFirestore();
    const users = db.collection('users');
    const now = new Date();

    if (!q && status !== 'none' && status !== 'all') {
      let query: Query = users.select('username', 'photoURL', 'plan');
      if (status === 'active') query = query.where('plan.expira', '>', now).orderBy('plan.expira', 'asc');
      else if (status === 'expiring') {
        query = query
          .where('plan.expira', '>', now)
          .where('plan.expira', '<=', new Date(now.getTime() + EXPIRING_DAYS * 86_400_000))
          .orderBy('plan.expira', 'asc');
      } else query = query.where('plan.expira', '<=', now).orderBy('plan.expira', 'desc');

      if (cursor) {
        const last = await users.doc(cursor).get();
        if (last.exists) query = query.startAfter(last);
      }
      const snap = await query.limit(limit + 1).get();
      const docs = snap.docs.slice(0, limit);
      return NextResponse.json({
        members: docs.map((d) => projectMemberSummary(d.id, d.data(), now)),
        nextCursor: snap.docs.length > limit ? docs[docs.length - 1].id : null,
      });
    }

    // Recorrido con proyección mínima: socios sin plan, todos o búsqueda por nombre.
    const snap = await users.select('username', 'photoURL', 'plan').get();
    const all = snap.docs
      .map((d) => projectMemberSummary(d.id, d.data(), now))
      .filter((m) => (status === 'all' ? true : status === 'active' ? m.status === 'active' || m.status === 'expiring' : m.status === status))
      .filter((m) => !q || m.username.toLowerCase().includes(q))
      .sort((a, b) => a.username.localeCompare(b.username, 'es'));
    const offset = Math.max(Number(cursor) || 0, 0);
    const page = all.slice(offset, offset + limit);
    return NextResponse.json({
      members: page,
      nextCursor: offset + limit < all.length ? String(offset + limit) : null,
    });
  } catch (error) {
    console.error('[/api/recepcion/members]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
