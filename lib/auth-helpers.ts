import { getAdminAuth } from '@/lib/firebase-admin';

/** Parsea el header `Cookie` de un request a un objeto clave→valor. */
function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get('cookie') || '';
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...vals] = c.trim().split('=');
      return [key.trim(), vals.join('=')];
    })
  );
}

/**
 * Verifica la sesión de administrador en un request de API.
 *
 * - Header `Authorization: Bearer <idToken>` → `verifyIdToken` (compatibilidad).
 * - Cookie `fitmania_session` (session cookie de Firebase) → `verifySessionCookie(..., true)`,
 *   que además comprueba revocación (T-15, auditoría A-4).
 *
 * @returns El token decodificado si es válido, o null si no.
 */
export async function verifyAdminRequest(request: Request) {
  const adminAuth = getAdminAuth();

  // 1. Bearer token (compatibilidad con llamadas existentes)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      if (decoded.admin) return decoded;
    } catch {
      // Token de header inválido, intentar cookie
    }
  }

  // 2. Cookie de sesión (verifySessionCookie + checkRevoked)
  const sessionToken = parseCookies(request)['fitmania_session'];
  if (sessionToken) {
    try {
      const decoded = await adminAuth.verifySessionCookie(sessionToken, true);
      if (decoded.admin) return decoded;
    } catch {
      // Cookie inválida, expirada o revocada
    }
  }

  return null;
}

/**
 * Verifica la sesión de recepción (T-10 + T-16).
 *
 * Requiere: session cookie válida y NO revocada + email autorizado + claim `receptionist`.
 * El claim ya NO se auto-otorga en el login; se gestiona centralmente desde el panel
 * admin o con `scripts/manage-claims.js` (auditoría A-5).
 */
export async function verifyReceptionRequest(request: Request) {
  const adminAuth = getAdminAuth();
  const authorizedEmail = process.env.RECEPTION_AUTHORIZED_EMAIL;

  const sessionToken = parseCookies(request)['fitmania_reception_session'];
  if (!sessionToken) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionToken, true);
    if (!authorizedEmail || decoded.email?.toLowerCase() !== authorizedEmail.toLowerCase()) {
      return null;
    }
    if (decoded.receptionist !== true) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
