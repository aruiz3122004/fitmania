import { getAdminAuth } from '@/lib/firebase-admin';
import { isMfaSatisfied } from '@/lib/mfa-server';

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
 * Solo acepta la cookie `fitmania_session` (session cookie de Firebase) con
 * `verifySessionCookie(..., true)`, que comprueba revocación (T-15, auditoría A-4).
 * Se quitó la vía `Authorization: Bearer <idToken>`: no revisaba revocación y
 * saltaba la verificación en dos pasos que se exige al crear la sesión.
 *
 * @returns El token decodificado si es válido, o null si no.
 */
export async function verifyAdminRequest(request: Request) {
  const adminAuth = getAdminAuth();

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

/**
 * Verifica a un usuario final por `Authorization: Bearer <idToken>`.
 * Para endpoints del propio usuario (/api/me/*, registro, foro).
 * Si la cuenta tiene la verificación en dos pasos activa, la sesión debe haberla
 * completado (lib/mfa.ts); si no, se trata como no autorizada.
 */
export async function verifyUserRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return (await isMfaSatisfied(decoded)) ? decoded : null;
  } catch {
    return null;
  }
}
