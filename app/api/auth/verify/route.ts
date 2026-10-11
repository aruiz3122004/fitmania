import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

/**
 * Endpoint interno para verificar si una cookie de sesión es válida.
 * Usado por las páginas protegidas para determinar el estado auth al cargar.
 * 
 * GET /api/auth/verify?role=admin   → verifica fitmania_session + claim admin
 * GET /api/auth/verify?role=recepcion → verifica fitmania_reception_session + email autorizado
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
      return NextResponse.json({ valid: false, reason: 'No session cookie found' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Verificaciones específicas por rol
    if (role === 'admin') {
      if (!decodedToken.admin) {
        return NextResponse.json({ valid: false, reason: 'No admin claim' }, { status: 403 });
      }
      return NextResponse.json({ valid: true, uid: decodedToken.uid, role: 'admin' }, { status: 200 });
    }

    if (role === 'recepcion') {
      const authorizedEmail = process.env.RECEPTION_AUTHORIZED_EMAIL;
      if (!authorizedEmail || decodedToken.email?.toLowerCase() !== authorizedEmail.toLowerCase()) {
        return NextResponse.json({ valid: false, reason: 'Email not authorized for reception' }, { status: 403 });
      }
      return NextResponse.json({ valid: true, uid: decodedToken.uid, role: 'recepcion' }, { status: 200 });
    }

    return NextResponse.json({ valid: false, reason: 'Unknown role' }, { status: 400 });

  } catch (error: any) {
    // Token inválido, expirado o malformado
    return NextResponse.json({ valid: false, reason: 'Invalid or expired token' }, { status: 401 });
  }
}
