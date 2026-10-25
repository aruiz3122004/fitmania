import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { isReceptionEmailAllowed } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';
import { resetRateLimitFor } from '@/lib/rate-limit-server';
import { GATE_COOKIE, createGateToken, gateCookieOptions, getGateSecret } from '@/lib/gate-token';
import { isMfaSatisfied } from '@/lib/mfa-server';

// F1-15: la recepción trabaja todo el día; la sesión cubre un turno completo.
const SESSION_SECONDS = 12 * 60 * 60; // 12 horas

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Se requiere el token de autenticación.' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();

    // Verificar que el token Firebase es válido
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // F1-14: lista blanca opcional (varios correos); la autorización real es el claim.
    if (!isReceptionEmailAllowed(decodedToken.email)) {
      await recordAuditLog({
        action: 'LOGIN_FAILED',
        category: 'AUTH_FAILURE',
        details: `Intento de acceso denegado a Recepción. Razón: Correo no autorizado. Email: ${decodedToken.email}`,
        adminEmail: decodedToken.email,
        actorUid: decodedToken.uid,
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
        actorUid: decodedToken.uid,
        targetId: decodedToken.uid,
        request: request,
      });
      return NextResponse.json({ error: 'Acceso denegado: tu cuenta no tiene el rol de recepción asignado.' }, { status: 403 });
    }

    // Verificación en dos pasos por correo (opcional): si está activa, esta sesión debe
    // haberla completado antes de recibir la cookie del panel.
    if (!(await isMfaSatisfied(decodedToken))) {
      return NextResponse.json(
        { error: 'Completa la verificación en dos pasos para entrar al panel.', code: 'mfa_required' },
        { status: 401 }
      );
    }

    // Crear session cookie de Firebase (revocable) en lugar del ID token crudo (T-15).
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_SECONDS * 1000,
    });

    const response = NextResponse.json({ success: true, uid: decodedToken.uid }, { status: 200 });

    response.cookies.set('fitmania_reception_session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // Solo en navegación propia del sitio (defensa CSRF)
      path: '/',
      maxAge: SESSION_SECONDS,
    });

    // F1-12: token de puerta firmado con la misma vigencia que la sesión.
    const gateSecret = getGateSecret('recepcion');
    if (gateSecret) {
      response.cookies.set(
        GATE_COOKIE.recepcion,
        await createGateToken('recepcion', gateSecret, SESSION_SECONDS),
        gateCookieOptions(SESSION_SECONDS)
      );
    }

    // F1-10: acceso verificado → reiniciar el contador de intentos de esta IP.
    await resetRateLimitFor(request);

    await recordAuditLog({
      action: 'LOGIN_RECEPTION',
      category: 'AUTH_SUCCESS',
      details: 'Inicio de sesión de Recepción exitoso.',
      adminEmail: decodedToken.email,
      actorUid: decodedToken.uid,
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
