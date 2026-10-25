import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { isMfaSatisfied, mfaRequiredResponse } from '@/lib/mfa-server';

/**
 * PATCH /api/me/companion — registra el acompañante del plan del usuario (F1-08).
 *
 * Las reglas de Firestore impiden que el cliente modifique `plan` (para que nadie
 * se active un plan a sí mismo), y eso también bloqueaba guardar
 * `plan.acompanante` desde el navegador. Ahora lo escribe el servidor tras
 * verificar el ID token y que el plan esté vigente.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DIAS = 3;

export async function PATCH(request: Request) {
  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  let uid: string;
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    if (!(await isMfaSatisfied(decodedToken))) return mfaRequiredResponse();
    uid = decodedToken.uid;
  } catch {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const rutinaDias: unknown = body?.rutinaDias;

    if (!nombre || nombre.length > 100) {
      return NextResponse.json({ error: 'Nombre del acompañante inválido.' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email) || email.length > 200) {
      return NextResponse.json({ error: 'Correo del acompañante inválido.' }, { status: 400 });
    }
    if (
      !Array.isArray(rutinaDias) ||
      rutinaDias.length === 0 ||
      rutinaDias.length > MAX_DIAS ||
      !rutinaDias.every((d) => typeof d === 'string' && d.length <= 20)
    ) {
      return NextResponse.json({ error: `Selecciona entre 1 y ${MAX_DIAS} días.` }, { status: 400 });
    }

    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    const plan = snap.data()?.plan;
    const expira = plan?.expira?.toDate ? plan.expira.toDate() : plan?.expira ? new Date(plan.expira) : null;
    if (!plan || !expira || expira.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Necesitas un plan vigente para registrar acompañante.' }, { status: 403 });
    }

    const acompanante = { nombre, email, rutinaDias: Array.from(new Set(rutinaDias as string[])) };
    await userRef.update({ 'plan.acompanante': acompanante });

    return NextResponse.json({ success: true, acompanante });
  } catch (error) {
    console.error('[/api/me/companion]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
