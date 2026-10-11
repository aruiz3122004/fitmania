import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';

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
// CONFIGURACIÓN DE SEGURIDAD PROACTIVA (CSP)
// -------------------------------------------------------
function applySecurityHeaders(response: NextResponse) {
  const isProd = process.env.NODE_ENV === 'production';
  
  // CSP: Content Security Policy robusta para soportar Stripe, Firebase, Cloudinary y Google Fonts
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com https://*.firebaseapp.com https://apis.google.com https://va.vercel-scripts.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://res.cloudinary.com https://*.googleusercontent.com https://*.stripe.com https://*.firebaseapp.com;
    connect-src 'self' https://*.stripe.com https://*.googleapis.com https://*.firebaseio.com https://res.cloudinary.com https://va.vercel-scripts.com;
    frame-src 'self' https://*.stripe.com https://*.firebaseapp.com;
    font-src 'self' data: https://fonts.gstatic.com;
    worker-src 'self' blob:;
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  const headers = response.headers;
  
  // Inyectar CSP
  headers.set('Content-Security-Policy', cspHeader);
  
  // Prevenir Clickjacking (solo permitir el mismo origen si fuera necesario, o denegar por completo)
  headers.set('X-Frame-Options', 'DENY');
  
  // Prevenir sniffing de tipos de contenido
  headers.set('X-Content-Type-Options', 'nosniff');
  
  // Referrer Policy para privacidad
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // HSTS (HTTP Strict Transport Security) - Solo en producción
  if (isProd) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  return response;
}

export default async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // -------------------------------------------------------
  // RATE LIMITING GLOBAL (Arquitectura Progresiva y Exacta)
  // -------------------------------------------------------
  if (redis) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    // 1. REINICIO DE INTENTOS (Solo si login/pago fue exitoso)
    if (pathname === '/api/security/success') {
      try {
        await redis.del(`fw_attempts_${ip}`, `fw_lockout_${ip}`, `fw_level_${ip}`);
        return applySecurityHeaders(NextResponse.json({ success: true, message: 'Intentos restaurados' }));
      } catch (e) {
        console.error('Error limpiando rate limit:', e);
        return applySecurityHeaders(NextResponse.json({ success: true })); // Fallback
      }
    }

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
          return applySecurityHeaders(resp);
        }

        // B. Lectura inofensiva de estado (Renderizado inicial de la página)
        if (isCheckEndpoint) {
          const currentAttempts = (await redis.get<number>(`fw_attempts_${ip}`)) || 0;
          return applySecurityHeaders(NextResponse.json({
            success: true,
            remaining: Math.max(0, MAX_ATTEMPTS - currentAttempts),
          }));
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
          try {
            fetch(`${request.nextUrl.origin}/api/security/log-block`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-middleware-secret': process.env.UPSTASH_REDIS_REST_TOKEN || 'fitmania_fallback' 
              },
              body: JSON.stringify({ ip, attempts: MAX_ATTEMPTS, url: pathname })
            }).catch(() => {}); // Fire and forget
          } catch(e) {}

          const resp = NextResponse.json(
            { error: 'Límite alcanzado, pasarela bloqueada.', remaining: 0, secondsLeft: lockoutTime },
            { status: 429 }
          );
          resp.headers.set('X-RateLimit-Limit', MAX_ATTEMPTS.toString());
          resp.headers.set('X-RateLimit-Remaining', '0');
          resp.headers.set('X-RateLimit-SecondsLeft', lockoutTime.toString());
          return applySecurityHeaders(resp);
        }

        // D. Intento válido procesado (aún le quedan oportunidades)
        const remaining = Math.max(0, MAX_ATTEMPTS - attempts);
        
        if (pathname === '/api/security/attempt') {
          // Interceptamos su llegada porque su único trabajo era alertar al middleware del click
          return applySecurityHeaders(NextResponse.json({ success: true, remaining }));
        } else {
          // Si es un API Route propio (Stripe, Admin), lo dejamos pasar e inyectamos los headers
          const response = NextResponse.next();
          response.headers.set('X-RateLimit-Limit', MAX_ATTEMPTS.toString());
          response.headers.set('X-RateLimit-Remaining', remaining.toString());
          return applySecurityHeaders(response);
        }

      } catch (e) {
        console.error('Error procesando intentos con Redis:', e);
        // Fail-open si redis falla catastroficamente
        return applySecurityHeaders(NextResponse.next());
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
    const key = searchParams.get('key');
    const validKey = process.env.ADMIN_GATE_KEY;
    const adminGateCookie = request.cookies.get('fitmania_admin_gate')?.value;
    
    // Permitir si ya tiene sesión iniciada o si ya pasó la "gate" con cookie
    if (adminSession || adminGateCookie === 'true') {
      return applySecurityHeaders(NextResponse.next());
    }

    // Si trae la llave correcta, dejarlo pasar y ponerle la cookie por 1 hora
    if (validKey && key === validKey) {
      const resp = NextResponse.next();
      resp.cookies.set('fitmania_admin_gate', 'true', {
        maxAge: 3600, // 1 hora
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax'
      });
      return applySecurityHeaders(resp);
    }

    return applySecurityHeaders(NextResponse.rewrite(new URL('/404', request.url)));
  }

  if (normalizedPath === '/fitception') {
    const key = searchParams.get('key');
    const validKey = process.env.RECEPTION_GATE_KEY;
    const receptionGateCookie = request.cookies.get('fitmania_reception_gate')?.value;
    
    // Permitir si ya tiene sesión iniciada o si ya pasó la "gate" con cookie
    if (receptionSession || receptionGateCookie === 'true') {
      return applySecurityHeaders(NextResponse.next());
    }

    // Si trae la llave correcta, dejarlo pasar y ponerle la cookie por 1 hora
    if (validKey && key === validKey) {
      const resp = NextResponse.next();
      resp.cookies.set('fitmania_reception_gate', 'true', {
        maxAge: 3600, // 1 hora
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax'
      });
      return applySecurityHeaders(resp);
    }

    return applySecurityHeaders(NextResponse.rewrite(new URL('/404', request.url)));
  }

  // -------------------------------------------------------
  // SEGURIDAD DE APIS (Sesiones)
  // -------------------------------------------------------
  const isAdminApi = pathname.startsWith('/api/admin/') && 
                     !pathname.startsWith('/api/admin/login');
  if (isAdminApi && !adminSession) {
    return applySecurityHeaders(NextResponse.json({ error: 'No autorizado' }, { status: 401 }));
  }

  const isRecepcionApi = pathname.startsWith('/api/recepcion/') && 
                         !pathname.startsWith('/api/recepcion/login');
  if (isRecepcionApi && !receptionSession) {
    return applySecurityHeaders(NextResponse.json({ error: 'No autorizado' }, { status: 401 }));
  }

  // Devolver respuesta final con todas las cabeceras de seguridad aplicadas
  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Coincidir con todas las rutas excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (icono)
     * - Imagenes/Public (tus carpetas de assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|Imagenes|Public).*)',
  ],
};
