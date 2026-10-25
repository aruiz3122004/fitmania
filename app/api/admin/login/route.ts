import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { recordAuditLog } from '@/lib/audit-logger';
import { resetRateLimitFor } from '@/lib/rate-limit-server';
import { GATE_COOKIE, createGateToken, gateCookieOptions, getGateSecret } from '@/lib/gate-token';
import { getMfaStatus } from '@/lib/mfa-server';
import { IS_SANDBOX } from '@/lib/sandbox';

// Duración de la sesión del panel admin.
const SESSION_SECONDS = 60 * 60; // 1 hora

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
    // En el sandbox cada visitante es admin de su cuenta temporal (proyecto aparte).
    const authorizedAdminEmail = IS_SANDBOX ? undefined : process.env.ADMIN_AUTHORIZED_EMAIL;
    if (!decodedToken.admin || (authorizedAdminEmail && decodedToken.email?.toLowerCase() !== authorizedAdminEmail.toLowerCase())) {
      await recordAuditLog({
        action: 'LOGIN_FAILED',
        category: 'AUTH_FAILURE',
        details: `Intento de acceso denegado a panel Admin. Razón: Sin privilegios de Admin. Correo: ${decodedToken.email}`,
        adminEmail: decodedToken.email,
        actorUid: decodedToken.uid,
        targetId: decodedToken.uid,
        request: request,
      });
      return NextResponse.json({ error: 'Acceso denegado: no tienes privilegios de administrador.' }, { status: 403 });
    }

    // Verificación en dos pasos por correo (opcional): si está activa, esta sesión debe
    // haberla completado. Una sesión iniciada con TOTP de Firebase también cuenta.
    const mfa = await getMfaStatus(decodedToken);
    if (!mfa.verified) {
      return NextResponse.json(
        { error: 'Completa la verificación en dos pasos para entrar al panel.', code: 'mfa_required' },
        { status: 401 }
      );
    }

    // F1-13: con ADMIN_REQUIRE_MFA=true el admin debe tener un segundo factor: TOTP
    // (Firebase) o código por correo. Activarlo DESPUÉS de configurar uno de los dos.
    const hasTotp = !!(decodedToken.firebase as { sign_in_second_factor?: string } | undefined)?.sign_in_second_factor;
    if (!IS_SANDBOX && process.env.ADMIN_REQUIRE_MFA === 'true' && !hasTotp && !mfa.enabled) {
      await recordAuditLog({
        action: 'LOGIN_FAILED',
        category: 'AUTH_FAILURE',
        details: `Acceso denegado a panel Admin: falta la verificación en dos pasos. Correo: ${decodedToken.email}`,
        adminEmail: decodedToken.email,
        actorUid: decodedToken.uid,
        targetId: decodedToken.uid,
        request: request,
      });
      return NextResponse.json(
        { error: 'El panel exige verificación en dos pasos. Actívala en tu perfil e inicia sesión de nuevo.', code: 'mfa_not_configured' },
        { status: 403 }
      );
    }

    // Crear session cookie de Firebase (revocable y verificable server-side) en lugar
    // de guardar el ID token crudo (T-15, auditoría A-4).
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_SECONDS * 1000,
    });

    const response = NextResponse.json({ success: true, uid: decodedToken.uid }, { status: 200 });

    response.cookies.set('fitmania_session', sessionCookie, {
      httpOnly: true,       // No accesible desde JavaScript (protege contra XSS)
      secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
      sameSite: 'strict',  // Solo en navegación propia del sitio (defensa CSRF)
      path: '/',
      maxAge: SESSION_SECONDS,
    });

    // F1-12: token de puerta firmado con la misma vigencia que la sesión, para que
    // el middleware deje pasar al panel sin depender de una cookie falsificable.
    const gateSecret = getGateSecret('admin');
    if (gateSecret) {
      response.cookies.set(
        GATE_COOKIE.admin,
        await createGateToken('admin', gateSecret, SESSION_SECONDS),
        gateCookieOptions(SESSION_SECONDS)
      );
    }

    // F1-10: acceso verificado → reiniciar el contador de intentos de esta IP.
    await resetRateLimitFor(request);

    await recordAuditLog({
      action: 'LOGIN_ADMIN',
      category: 'AUTH_SUCCESS',
      details: 'Inicio de sesión administrativo exitoso.',
      adminEmail: decodedToken.email,
      actorUid: decodedToken.uid,
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
