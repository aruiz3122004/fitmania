import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { GATE_COOKIE } from '@/lib/gate-token';
import { SandboxError, endSandboxSession, sandboxOnly } from '@/lib/sandbox/server';

export const maxDuration = 60;

/**
 * POST /api/sandbox/end — borra la cuenta temporal y todo lo que creó, y cierra las
 * sesiones de los paneles. La cuenta sale del ID token.
 */
export async function POST(request: Request) {
  const notHere = sandboxOnly();
  if (notHere) return notHere;

  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
  }
  if (decoded.sandbox !== true) {
    return NextResponse.json({ error: 'Solo las cuentas temporales del sandbox se borran aquí.' }, { status: 403 });
  }

  try {
    await endSandboxSession(decoded.uid, decoded.email);
  } catch (error) {
    if (error instanceof SandboxError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[/api/sandbox/end]', error);
    return NextResponse.json({ error: 'No se pudieron borrar tus datos de prueba. Se borrarán solos al vencer la sesión.' }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });
  for (const name of ['fitmania_session', 'fitmania_reception_session', GATE_COOKIE.admin, GATE_COOKIE.recepcion]) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
  return response;
}
