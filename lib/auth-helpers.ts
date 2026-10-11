import { getAdminAuth } from '@/lib/firebase-admin';

/**
 * Verifica la cookie de sesión de administrador en un request de API.
 * Primero intenta el Bearer token (para compatibilidad con el dashboard existente),
 * luego la cookie HttpOnly.
 * 
 * @returns El token decodificado si es válido, o null si no.
 */
export async function verifyAdminRequest(request: Request) {
  const adminAuth = getAdminAuth();

  // 1. Intentar Bearer token en el header Authorization (compatibilidad con llamadas existentes)
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

  // 2. Intentar cookie HttpOnly
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...vals] = c.trim().split('=');
      return [key.trim(), vals.join('=')];
    })
  );

  const sessionToken = cookies['fitmania_session'];
  if (sessionToken) {
    try {
      const decoded = await adminAuth.verifyIdToken(sessionToken);
      if (decoded.admin) return decoded;
    } catch {
      // Token de cookie inválido o expirado
    }
  }

  return null;
}

/**
 * Verifica la cookie de sesión de recepción.
 */
export async function verifyReceptionRequest(request: Request) {
  const adminAuth = getAdminAuth();
  const authorizedEmail = process.env.RECEPTION_AUTHORIZED_EMAIL;

  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...vals] = c.trim().split('=');
      return [key.trim(), vals.join('=')];
    })
  );

  const sessionToken = cookies['fitmania_reception_session'];
  if (!sessionToken) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(sessionToken);
    if (!authorizedEmail || decoded.email?.toLowerCase() !== authorizedEmail.toLowerCase()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
