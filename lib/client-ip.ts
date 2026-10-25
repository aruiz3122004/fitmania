/**
 * IP confiable del cliente (T-11, F1-26).
 *
 * Orden de confianza: Vercel adjunta la IP real en `x-vercel-forwarded-for`;
 * Cloudflare en `cf-connecting-ip`. `x-forwarded-for` es falsificable por el
 * cliente y solo se usa como último recurso (desarrollo local).
 *
 * Compatible con Edge (middleware) y Node (route handlers): solo lee headers.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('cf-connecting-ip')?.trim() ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}
