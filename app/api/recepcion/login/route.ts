import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { recordAuditLog } from '@/lib/audit-logger';

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Se requiere el token de autenticación.' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();

    // Verificar que el token Firebase es válido
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Verificar que el email está autorizado para recepción (sin hardcodear en el cliente)
    const authorizedEmail = process.env.RECEPTION_AUTHORIZED_EMAIL;
    if (!authorizedEmail) {
      console.error('RECEPTION_AUTHORIZED_EMAIL no está configurada en las variables de entorno');
      return NextResponse.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 });
    }

    if (decodedToken.email?.toLowerCase() !== authorizedEmail.toLowerCase()) {
      await recordAuditLog({
        action: 'LOGIN_FAILED',
        category: 'AUTH_FAILURE',
        details: `Intento de acceso denegado a Recepción. Razón: Correo no autorizado. Email: ${decodedToken.email}`,
        adminEmail: decodedToken.email,
        targetId: decodedToken.uid,
        request: request,
      });
      return NextResponse.json({ error: 'Acceso denegado: este correo no está autorizado para recepción.' }, { status: 403 });
    }

    // T-16: el claim `receptionist` se gestiona centralmente (panel admin / script),
    // NO se auto-otorga en el login (auditoría A-5). Debe existir para acceder.
    if (decodedToken.receptionist !== true) {
      await recordAuditLog({
        action: 'LOGIN_FAILED',
        category: 'AUTH_FAILURE',
        details: `Intento de acceso denegado a Recepción. Razón: Sin claim de recepcionista. Email: ${decodedToken.email}`,
        adminEmail: decodedToken.email,
        targetId: decodedToken.uid,
        request: request,
      });
      return NextResponse.json({ error: 'Acceso denegado: tu cuenta no tiene el rol de recepción asignado.' }, { status: 403 });
    }

    // Crear session cookie de Firebase (revocable) en lugar del ID token crudo (T-15).
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: 60 * 60 * 1000, // 1 hora en ms
    });

    const response = NextResponse.json({ success: true, uid: decodedToken.uid }, { status: 200 });

    response.cookies.set('fitmania_reception_session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 hora
    });

    await recordAuditLog({
      action: 'LOGIN_RECEPTION',
      category: 'AUTH_SUCCESS',
      details: 'Inicio de sesión de Recepción exitoso.',
      adminEmail: decodedToken.email,
      targetId: decodedToken.uid,
      request: request,
    });

    return response;
  } catch (error: any) {
    console.error('Error in /api/recepcion/login:', error);
    return NextResponse.json({ 
      error: 'Credenciales inválidas o token expirado.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code
    }, { status: 401 });
  }
}
