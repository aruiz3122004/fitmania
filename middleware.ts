import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';
import { getClientIp } from '@/lib/client-ip';
import {
  GATE_COOKIE,
  type GateScope,
  createGateToken,
  gateCookieOptions,
  getGateSecret,
  timingSafeEqualStrings,
  verifyGateToken,
} from '@/lib/gate-token';

// Inicializar Upstash Redis de forma directa para control granular
let redis: Redis | null = null;
try {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    redis = new Redis({ url, token });
  }
} catch (error) {
  console.error('Error al inicializar Upstash Redis:', error);
}

const MAX_ATTEMPTS = 15;

// Aviso único por instancia si el rate limiting queda apagado (auditoría A-1).
// Sin Upstash el sistema es fail-open: se salta TODO el bloqueo sin avisar.
let warnedNoRedis = false;

// Penalizaciones progresivas basadas en niveles de castigo (1m, 5m, 15m, 30m, 45m, 1h)
function getLockoutTime(level: number): number {
  switch (level) {
    case 1: return 60;        // 1 minuto
    case 2: return 300;       // 5 minutos
    case 3: return 900;       // 15 minutos
    case 4: return 1800;      // 30 minutos
    case 5: return 2700;      // 45 minutos
    default: return 3600;     // 1 hora máximo para niveles consecuentes
  }
}

// -------------------------------------------------------
// NONCE + CSP (T-17)
// -------------------------------------------------------
// CSP restrictiva basada en NONCE por request. El nonce se genera con Web Crypto
// (runtime Edge) y se propaga:
//   1. En la RESPUESTA (para que el navegador aplique la política).
//   2. En la REQUEST (para que Next.js lo añada a sus propios <script> en el SSR).
// Nota: el nonce exige renderizado dinámico (ver `export const dynamic` en el
// layout raíz); las páginas estáticas no reciben nonce en build.
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === 'production';

  // Producción: 'nonce' + 'strict-dynamic' (sin 'unsafe-inline' ni 'unsafe-eval').
  // Desarrollo: Next/webpack requieren 'unsafe-eval' e inline para el HMR.
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' https://*.stripe.com https://*.firebaseapp.com https://apis.google.com https://va.vercel-scripts.com`
    : `'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline' https://*.stripe.com https://*.firebaseapp.com https://apis.google.com https://va.vercel-scripts.com`;

  // style-src conserva 'unsafe-inline': la app usa atributos `style=` de React y
  // un <style> inline; en CSP3 un nonce en style-src haría ignorar 'unsafe-inline'.
  return `
    default-src 'self';
    script-src ${scriptSrc};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://res.cloudinary.com https://*.googleusercontent.com https://*.stripe.com https://*.firebaseapp.com;
    connect-src 'self' https://*.stripe.com https://*.googleapis.com https://*.firebaseio.com https://api.cloudinary.com https://res.cloudinary.com https://va.vercel-scripts.com;
    frame-src 'self' https://*.stripe.com https://*.firebaseapp.com;
    font-src 'self' data: https://fonts.gstatic.com;
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();
}

function applySecurityHeaders(response: NextResponse, csp: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const headers = response.headers;

  headers.set('Content-Security-Policy', csp);
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // F1-16: la cámara solo la usa el escáner QR de recepción (mismo origen).
  headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(self)');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  if (isProd) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  return response;
}

// Deja pasar y propaga el nonce a Next.js (necesario para el SSR de páginas).
function nextWithNonce(request: NextRequest, nonce: string, csp: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return applySecurityHeaders(response, csp);
}

// Rewrite (p. ej. a /404) propagando el nonce.
function rewriteWithNonce(request: NextRequest, destination: URL, nonce: string, csp: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
  return applySecurityHeaders(response, csp);
}

// -------------------------------------------------------
// PUERTA DE PANELES INTERNOS (F1-12)
// -------------------------------------------------------
// La cookie de puerta es un token HMAC firmado con la llave del panel (no un literal
// `'true'`), y la mera presencia de una cookie de sesión YA NO abre la puerta: ambas
// se podían falsificar a mano. Los logins de panel emiten el token tras verificar
// la sesión, así que el acceso directo por rol (`enterPanel`) sigue funcionando.
const GATE_TTL_SECONDS = 60 * 60; // 1 hora al entrar con `?key=`

async function handlePanelGate(
  request: NextRequest,
  scope: GateScope,
  hasSessionCookie: boolean,
  nonce: string,
  csp: string
) {
  const secret = getGateSecret(scope);

  // Sin llave configurada: comportamiento anterior (solo sesión), con aviso.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[SECURITY] Falta la llave de puerta del panel "${scope}" (ADMIN_GATE_KEY / RECEPTION_GATE_KEY).`);
    }
    return hasSessionCookie
      ? nextWithNonce(request, nonce, csp)
      : rewriteWithNonce(request, new URL('/404', request.url), nonce, csp);
  }

  const gateCookie = request.cookies.get(GATE_COOKIE[scope])?.value;
  if (await verifyGateToken(scope, secret, gateCookie)) {
    return nextWithNonce(request, nonce, csp);
  }

  const key = request.nextUrl.searchParams.get('key');
  if (key && timingSafeEqualStrings(key, secret)) {
    const resp = nextWithNonce(request, nonce, csp);
    resp.cookies.set(
      GATE_COOKIE[scope],
      await createGateToken(scope, secret, GATE_TTL_SECONDS),
      gateCookieOptions(GATE_TTL_SECONDS)
    );
    return resp;
  }

  return rewriteWithNonce(request, new URL('/404', request.url), nonce, csp);
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // -------------------------------------------------------
  // RATE LIMITING GLOBAL (Arquitectura Progresiva y Exacta)
  // -------------------------------------------------------
  if (!redis && !warnedNoRedis && process.env.NODE_ENV === 'production') {
    warnedNoRedis = true;
    console.warn('[SECURITY] Rate limiting DESACTIVADO: faltan UPSTASH_REDIS_REST_URL/_TOKEN. Ver auditoría A-1.');
  }

  if (redis) {
    // IP confiable (T-11, auditoría A-1): Vercel adjunta la IP real del cliente;
    // NO confiar en el primer valor de x-forwarded-for (header falsificable por el atacante).
    const ip = getClientIp(request.headers);

    // F1-10 (auditoría B5): se eliminó `/api/security/success`. Reiniciaba el contador
    // SIN autenticación, así que cualquiera podía anular su propio bloqueo. El reinicio
    // ahora lo hace el servidor tras un login de panel verificado (lib/rate-limit-server.ts).

    const sensitiveEndpoints = [
      '/api/admin/login',
      '/api/recepcion/login',
      '/api/stripe/create-payment',
      '/api/security/attempt'  // Endpoint para consumir intentos en formularios públicos
    ];

    const isAttemptEndpoint = sensitiveEndpoints.some(ep => pathname.startsWith(ep));
    const isCheckEndpoint = pathname === '/api/security/check';

    if (isAttemptEndpoint || isCheckEndpoint) {
      try {
        // A. Verificar si el usuario está bajo una condena actual
        const lockoutTtl = await redis.ttl(`fw_lockout_${ip}`);

        if (lockoutTtl > 0) {
          // Usuario bloqueado
          const resp = NextResponse.json(
            { error: 'Bloqueo de seguridad por excesos de intentos.', remaining: 0, secondsLeft: lockoutTtl },
            { status: 429 }
          );
          resp.headers.set('X-RateLimit-Limit', MAX_ATTEMPTS.toString());
          resp.headers.set('X-RateLimit-Remaining', '0');
          resp.headers.set('X-RateLimit-SecondsLeft', lockoutTtl.toString());
          return applySecurityHeaders(resp, csp);
        }

        // B. Lectura inofensiva de estado (Renderizado inicial de la página)
        if (isCheckEndpoint) {
          const currentAttempts = (await redis.get<number>(`fw_attempts_${ip}`)) || 0;
          return applySecurityHeaders(NextResponse.json({
            success: true,
            remaining: Math.max(0, MAX_ATTEMPTS - currentAttempts),
          }), csp);
        }

        // C. Ejecutar Intento Explicito (Pulsó ENTRAR o PAGAR)
        const attempts = await redis.incr(`fw_attempts_${ip}`);

        // Limpiador básico: si es primer error asilar intentos tras 1 hora si el usuario desiste
        if (attempts === 1) await redis.expire(`fw_attempts_${ip}`, 3600);

        if (attempts > MAX_ATTEMPTS) {
          // Ha superado el limite: asginar nivel de penalización
          const level = await redis.incr(`fw_level_${ip}`);
          if (level === 1) await redis.expire(`fw_level_${ip}`, 86400); // Récord base 24h

          const lockoutTime = getLockoutTime(level);
          await redis.setex(`fw_lockout_${ip}`, lockoutTime, 'blocked'); // Activar cuenta regresiva
          await redis.del(`fw_attempts_${ip}`); // Resetear contador para re-evaluación posterior al castigo

          // Registrar en auditoría asíncronamente
          // B-6: usar un secreto interno propio (no reutilizar UPSTASH_REDIS_REST_TOKEN).
          const internalSecret = process.env.INTERNAL_MIDDLEWARE_SECRET;
          if (internalSecret) {
            try {
              fetch(`${request.nextUrl.origin}/api/security/log-block`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-middleware-secret': internalSecret
                },
                body: JSON.stringify({ ip, attempts: MAX_ATTEMPTS, url: pathname })
              }).catch(() => {}); // Fire and forget
            } catch(e) {}
          }

          const resp = NextResponse.json(
            { error: 'Límite alcanzado, pasarela bloqueada.', remaining: 0, secondsLeft: lockoutTime },
            { status: 429 }
          );
          resp.headers.set('X-RateLimit-Limit', MAX_ATTEMPTS.toString());
          resp.headers.set('X-RateLimit-Remaining', '0');
          resp.headers.set('X-RateLimit-SecondsLeft', lockoutTime.toString());
          return applySecurityHeaders(resp, csp);
        }

        // D. Intento válido procesado (aún le quedan oportunidades)
        const remaining = Math.max(0, MAX_ATTEMPTS - attempts);

        if (pathname === '/api/security/attempt') {
          // Interceptamos su llegada porque su único trabajo era alertar al middleware del click
          return applySecurityHeaders(NextResponse.json({ success: true, remaining }), csp);
        } else {
          // Si es un API Route propio (Stripe, Admin), lo dejamos pasar e inyectamos los headers
          const response = NextResponse.next();
          response.headers.set('X-RateLimit-Limit', MAX_ATTEMPTS.toString());
          response.headers.set('X-RateLimit-Remaining', remaining.toString());
          return applySecurityHeaders(response, csp);
        }

      } catch (e) {
        console.error('Error procesando intentos con Redis:', e);
        // Fail-open si redis falla catastroficamente
        return applySecurityHeaders(NextResponse.next(), csp);
      }
    }
  }

  // Leer cookies de sesión
  const adminSession = request.cookies.get('fitmania_session')?.value;
  const receptionSession = request.cookies.get('fitmania_reception_session')?.value;

  // --- PROTECCIÓN DE PÁGINAS (ADMIN Y RECEPCIÓN INVISIBLES) ---

  // Normalizar el pathname para que la comparación sea robusta (sin slash final)
  const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (normalizedPath === '/fitministration') {
    return handlePanelGate(request, 'admin', !!adminSession, nonce, csp);
  }

  if (normalizedPath === '/fitception') {
    return handlePanelGate(request, 'recepcion', !!receptionSession, nonce, csp);
  }

  // -------------------------------------------------------
  // SEGURIDAD DE APIS (Sesiones)
  // -------------------------------------------------------
  const isAdminApi = pathname.startsWith('/api/admin/') &&
                     !pathname.startsWith('/api/admin/login');
  if (isAdminApi && !adminSession) {
    return applySecurityHeaders(NextResponse.json({ error: 'No autorizado' }, { status: 401 }), csp);
  }

  const isRecepcionApi = pathname.startsWith('/api/recepcion/') &&
                         !pathname.startsWith('/api/recepcion/login');
  if (isRecepcionApi && !receptionSession) {
    return applySecurityHeaders(NextResponse.json({ error: 'No autorizado' }, { status: 401 }), csp);
  }

  // Devolver respuesta final con todas las cabeceras de seguridad aplicadas
  return nextWithNonce(request, nonce, csp);
}

export const config = {
  matcher: [
    /*
     * Coincidir con todas las rutas excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (icono)
     * - Imagenes/Public (tus carpetas de assets)
     * - Archivos estáticos por extensión
     *
     * IMPORTANTE: NO excluir `api`. El middleware es quien aplica el rate limit
     * y protege las APIs de admin/recepción, y además atiende endpoints que no
     * existen como route handler (/api/security/attempt).
     * Si se excluye `api`, esos endpoints devuelven el HTML del 404.
     */
    '/((?!_next/static|_next/image|favicon.ico|Imagenes|Public|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.webp$|.*\\.woff2?$|.*\\.ico$).*)',
  ],
};
