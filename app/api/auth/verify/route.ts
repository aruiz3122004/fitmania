import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { isReceptionEmailAllowed } from '@/lib/auth-helpers';

/**
 * Endpoint interno para verificar si una cookie de sesión es válida.
 * Usado por las páginas protegidas para determinar el estado auth al cargar.
 * 
 * GET /api/auth/verify?role=admin   → verifica fitmania_session + claim admin
 * GET /api/auth/verify?role=recepcion → verifica fitmania_reception_session + email autorizado
 *
 * Siempre responde 200 con `{ valid }` (salvo rol desconocido): "sin sesión" es el
 * estado normal antes del login, y un 401/403 aparecía como error en la consola.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') || 'admin';

    // Extraer la cookie correcta según el rol
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...vals] = c.trim().split('=');
        return [key, vals.join('=')];
      })
    );

    const cookieName = role === 'recepcion' ? 'fitmania_reception_session' : 'fitmania_session';
    const token = cookies[cookieName];

    if (!token) {
      return NextResponse.json({ valid: false, reason: 'No session cookie found' }, { status: 200 });
    }

    const adminAuth = getAdminAuth();
    // T-15: la cookie contiene una session cookie de Firebase (no un ID token).
    // `checkRevoked=true` invalida sesiones revocadas de inmediato.
    const decodedToken = await adminAuth.verifySessionCookie(token, true);

    // Verificaciones específicas por rol
    if (role === 'admin') {
      if (!decodedToken.admin) {
        return NextResponse.json({ valid: false, reason: 'No admin claim' }, { status: 200 });
      }
      return NextResponse.json({ valid: true, uid: decodedToken.uid, role: 'admin' }, { status: 200 });
    }

    if (role === 'recepcion') {
      if (!isReceptionEmailAllowed(decodedToken.email)) {
        return NextResponse.json({ valid: false, reason: 'Email not authorized for reception' }, { status: 200 });
      }
      // T-16: el claim se gestiona centralmente y se valida en cada verificación.
      if (decodedToken.receptionist !== true) {
        return NextResponse.json({ valid: false, reason: 'No receptionist claim' }, { status: 200 });
      }
      return NextResponse.json({ valid: true, uid: decodedToken.uid, role: 'recepcion' }, { status: 200 });
    }

    return NextResponse.json({ valid: false, reason: 'Unknown role' }, { status: 400 });

  } catch (error: any) {
    // Token inválido, expirado o malformado
    return NextResponse.json({ valid: false, reason: 'Invalid or expired token' }, { status: 200 });
  }
}
