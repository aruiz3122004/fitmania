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

    // Verificar que el token de Firebase es válido y no ha expirado
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Verificar que el usuario tiene el custom claim de administrador
    const authorizedAdminEmail = process.env.ADMIN_AUTHORIZED_EMAIL;
    if (!decodedToken.admin || (authorizedAdminEmail && decodedToken.email?.toLowerCase() !== authorizedAdminEmail.toLowerCase())) {
      await recordAuditLog({
        action: 'LOGIN_FAILED',
        category: 'AUTH_FAILURE',
        details: `Intento de acceso denegado a panel Admin. Razón: Sin privilegios de Admin. Correo: ${decodedToken.email}`,
        adminEmail: decodedToken.email,
        targetId: decodedToken.uid,
        request: request,
      });
      return NextResponse.json({ error: 'Acceso denegado: no tienes privilegios de administrador.' }, { status: 403 });
    }

    // Crear la respuesta con la cookie HttpOnly segura (1 hora)
    const response = NextResponse.json({ success: true, uid: decodedToken.uid }, { status: 200 });

    response.cookies.set('fitmania_session', idToken, {
      httpOnly: true,       // No accesible desde JavaScript (protege contra XSS)
      secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
      sameSite: 'strict',   // Protege contra CSRF
      path: '/',
      maxAge: 60 * 60,      // 1 hora en segundos
    });

    await recordAuditLog({
      action: 'LOGIN_ADMIN',
      category: 'AUTH_SUCCESS',
      details: 'Inicio de sesión administrativo exitoso.',
      adminEmail: decodedToken.email,
      targetId: decodedToken.uid,
      request: request,
    });

    return response;
  } catch (error: any) {
    console.error('Error in /api/admin/login:', error);
    return NextResponse.json({ 
      error: 'Credenciales inválidas o token expirado.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code
    }, { status: 401 });
  }
}
