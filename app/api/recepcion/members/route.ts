import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyReceptionRequest } from '@/lib/auth-helpers';
import { projectMemberSummary } from '@/lib/reception-members';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';

/**
 * GET /api/recepcion/members — directorio de socios para recepción (F3-05, parcial).
 *
 * Devuelve solo nombre, foto y resumen del plan (sin correo, peso ni altura).
 * `select()` limita los campos leídos en el servidor.
 * TODO(F2-18): paginar con cursor y filtrar por estado en Firestore cuando crezca.
 */
export async function GET(request: NextRequest) {
  const decoded = await verifyReceptionRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  // Freno a la extracción masiva si una sesión de recepción se compromete.
  const rl = await limitAction(`members:${decoded.uid}`, 60, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  try {
    const snap = await getAdminFirestore()
      .collection('users')
      .select('username', 'photoURL', 'plan')
      .get();

    const members = snap.docs
      .map((doc) => projectMemberSummary(doc.id, doc.data()))
      .sort((a, b) => a.username.localeCompare(b.username, 'es'));

    return NextResponse.json({ members });
  } catch (error) {
    console.error('[/api/recepcion/members]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
