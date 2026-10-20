/**
 * Token de "puerta" de los paneles internos firmado con HMAC-SHA256 (F1-12).
 *
 * Antes la cookie de puerta valía literalmente `'true'` y el middleware dejaba
 * pasar con CUALQUIER valor en la cookie de sesión: ambas se podían falsificar a
 * mano desde el navegador. Ahora la cookie lleva `<exp>.<firma>`, donde la firma
 * es HMAC(secreto, `<scope>.<exp>`). Sin el secreto no se puede fabricar.
 *
 * El secreto es la propia llave de la puerta (`ADMIN_GATE_KEY` /
 * `RECEPTION_GATE_KEY`), así que no requiere variables de entorno nuevas.
 *
 * Usa Web Crypto: funciona en el middleware (Edge) y en route handlers (Node).
 */

export type GateScope = 'admin' | 'recepcion';

export const GATE_COOKIE: Record<GateScope, string> = {
  admin: 'fitmania_admin_gate',
  recepcion: 'fitmania_reception_gate',
};

export function getGateSecret(scope: GateScope): string | undefined {
  return scope === 'admin' ? process.env.ADMIN_GATE_KEY : process.env.RECEPTION_GATE_KEY;
}

const encoder = new TextEncoder();

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/** Comparación en tiempo constante (evita filtrar la firma por tiempos de respuesta). */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createGateToken(scope: GateScope, secret: string, ttlSeconds: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${exp}.${await sign(secret, `${scope}.${exp}`)}`;
}

export async function verifyGateToken(
  scope: GateScope,
  secret: string,
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;
  const [expRaw, signature] = token.split('.');
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || !signature || exp <= Math.floor(Date.now() / 1000)) return false;
  return timingSafeEqualStrings(signature, await sign(secret, `${scope}.${exp}`));
}

/** Opciones comunes de la cookie de puerta. */
export function gateCookieOptions(maxAgeSeconds: number) {
  return {
    maxAge: maxAgeSeconds,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax' as const,
  };
}
