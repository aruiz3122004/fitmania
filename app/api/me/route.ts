import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { verifyUserRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';
import { deleteMemberAccount } from '@/lib/account-deletion';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';

/**
 * Derechos del titular en autoservicio (F3-11, Ley 1581).
 * GET    → descarga de todos los datos personales del usuario (JSON).
 * DELETE → supresión de la cuenta (body: { confirm: 'ELIMINAR' }).
 */
export const maxDuration = 60;

function serialize(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  return value;
}

export async function GET(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  // F1-10: operaciones pesadas, 5 por hora por usuario.
  const rl = await limitAction(`me:${decoded.uid}`, 5, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  try {
    const db = getAdminFirestore();
    const uid = decoded.uid;
    const [profile, orders, payments, entries, pqrs, posts, comments, consents] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('orders').where('uid', '==', uid).get(),
      db.collection('payments').where('uid', '==', uid).get(),
      db.collection('entry_logs').where('userId', '==', uid).get(),
      db.collection('pqrs').where('userId', '==', uid).get(),
      db.collection('posts').where('autor_id', '==', uid).get(),
      db.collectionGroup('comments').where('autor_id', '==', uid).get(),
      db.collection('consents').where('uid', '==', uid).get(),
    ]);

    const docs = (snap: FirebaseFirestore.QuerySnapshot) => snap.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));
    const payload = {
      generadoEn: new Date().toISOString(),
      cuenta: { uid, email: decoded.email || null, correoVerificado: !!decoded.email_verified },
      perfil: profile.exists ? serialize(profile.data()) : null,
      compras: docs(orders),
      // Todos los intentos de pago con Mercado Pago (también pendientes, rechazados y
      // vencidos). Sin datos bancarios: FITMANIA solo guarda el medio y el id de transacción.
      intentosDePago: docs(payments).map(({ stockApplied: _s, preferenceId: _p, ...rest }: any) => rest),
      ingresos: docs(entries).map(({ userEmail: _e, ...rest }: any) => rest),
      pqrs: docs(pqrs),
      publicaciones: docs(posts),
      comentarios: comments.docs.map((d) => ({ id: d.id, post: d.ref.parent.parent?.id, ...serialize(d.data()) })),
      autorizaciones: docs(consents),
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="mis-datos-fitmania.json"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[/api/me GET]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  // F1-10: operaciones pesadas, 5 por hora por usuario.
  const rl = await limitAction(`me:${decoded.uid}`, 5, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = await request.json().catch(() => null);
  if (body?.confirm !== 'ELIMINAR') {
    return NextResponse.json({ error: 'Confirma escribiendo ELIMINAR.' }, { status: 400 });
  }
  // El personal interno no puede auto-eliminarse por aquí (perdería el acceso a los paneles).
  if (decoded.admin === true || decoded.receptionist === true) {
    return NextResponse.json({ error: 'Las cuentas del personal se gestionan desde el panel de administración.' }, { status: 403 });
  }

  try {
    const summary = await deleteMemberAccount(getAdminFirestore(), getAdminAuth(), decoded.uid);
    await recordAuditLog({
      action: 'SELF_DELETE_ACCOUNT',
      category: 'ADMIN_ACTION',
      details: `El socio eliminó su cuenta (derecho de supresión). Posts: ${summary.posts}, comentarios: ${summary.comments}, ingresos anonimizados: ${summary.entries}.`,
      adminEmail: decoded.email,
      actorUid: decoded.uid,
      targetId: decoded.uid,
      request,
    });
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('[/api/me DELETE]', error);
    return NextResponse.json({ error: 'No se pudo eliminar la cuenta. Intenta de nuevo o contáctanos por PQRS.' }, { status: 500 });
  }
}
