import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';

/**
 * Congelamiento de plan (F3-25): incapacidad, viaje, etc.
 * POST { uid, action: 'freeze', reason }  → guarda el tiempo restante y deja el plan
 *                                            inactivo (expira = ahora).
 * POST { uid, action: 'unfreeze' }        → reactiva sumando el tiempo guardado.
 * Al dejar `expira` en el pasado, ingresos, recordatorios y el pase de acceso
 * tratan el plan como no vigente sin lógica adicional.
 */
export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const uid = typeof body?.uid === 'string' && !body.uid.includes('/') ? body.uid : '';
  const action = body?.action;
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
  if (!uid || (action !== 'freeze' && action !== 'unfreeze')) {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
  if (action === 'freeze' && !reason) {
    return NextResponse.json({ error: 'Indica el motivo del congelamiento.' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const ref = db.collection('users').doc(uid);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const plan = snap.data()?.plan;
      if (!plan) return { error: 'El socio no tiene plan.', status: 400 };
      const now = new Date();
      const expira = plan.expira?.toDate ? plan.expira.toDate() : plan.expira ? new Date(plan.expira) : null;

      if (action === 'freeze') {
        if (plan.frozen) return { error: 'El plan ya está congelado.', status: 409 };
        if (!expira || expira <= now) return { error: 'Solo se puede congelar un plan vigente.', status: 400 };
        const remainingMs = expira.getTime() - now.getTime();
        tx.update(ref, {
          'plan.frozen': { since: now, reason, remainingMs, by: isAdmin.email || null },
          'plan.expira': now,
        });
        return { ok: true, remainingDays: Math.ceil(remainingMs / 86400000) };
      }

      if (!plan.frozen) return { error: 'El plan no está congelado.', status: 409 };
      const nuevaExpira = new Date(now.getTime() + Number(plan.frozen.remainingMs || 0));
      const history = Array.isArray(plan.freezeHistory) ? plan.freezeHistory.slice(-9) : [];
      tx.update(ref, {
        'plan.expira': nuevaExpira,
        'plan.frozen': null,
        'plan.freezeHistory': [...history, { since: plan.frozen.since, until: now, reason: plan.frozen.reason }],
      });
      return { ok: true, expira: nuevaExpira.toISOString() };
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

    await recordAuditLog({
      action: action === 'freeze' ? 'FREEZE_PLAN' : 'UNFREEZE_PLAN',
      category: 'PLAN_MANAGEMENT',
      details: action === 'freeze'
        ? `Plan del socio ${uid} congelado (${result.remainingDays} días a favor). Motivo: ${reason}`
        : `Plan del socio ${uid} reactivado; nuevo vencimiento ${result.expira}.`,
      adminEmail: isAdmin.email,
      actorUid: isAdmin.uid,
      targetId: uid,
      request,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[/api/admin/users/freeze]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
