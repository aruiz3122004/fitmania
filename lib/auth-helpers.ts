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
 * Lista blanca OPCIONAL de correos de recepción (F1-14).
 *
 * Antes `RECEPTION_AUTHORIZED_EMAIL` admitía un único correo, lo que obligaba a
 * compartir una cuenta entre recepcionistas (sin trazabilidad). Ahora:
 *  - Si la variable no está definida, basta el claim `receptionist` (lo asigna solo el admin).
 *  - Si está definida, admite varios correos separados por coma como restricción adicional.
 */
export function isReceptionEmailAllowed(email: string | undefined): boolean {
  const raw = process.env.RECEPTION_AUTHORIZED_EMAIL;
  if (!raw || !raw.trim()) return true;
  if (!email) return false;
  const allowed = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/**
 * Verifica la sesión de recepción (T-10 + T-16).
 *
 * Requiere: session cookie válida y NO revocada + claim `receptionist`
 * (+ correo en la lista blanca opcional). El claim ya NO se auto-otorga en el
 * login; se gestiona centralmente desde el panel admin (auditoría A-5).
 */
export async function verifyReceptionRequest(request: Request) {
  const adminAuth = getAdminAuth();

  const sessionToken = parseCookies(request)['fitmania_reception_session'];
  if (!sessionToken) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionToken, true);
    if (!isReceptionEmailAllowed(decoded.email)) {
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
