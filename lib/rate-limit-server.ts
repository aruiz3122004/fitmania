import { Redis } from '@upstash/redis';
import { getClientIp } from '@/lib/client-ip';

/**
 * Reinicio del contador de rate limit SOLO desde el servidor y SOLO tras un
 * acceso verificado (F1-10, auditoría B5).
 *
 * Antes existía `POST /api/security/success`, atendido por el middleware sin
 * autenticación: cualquiera podía borrar su propio contador y anular el bloqueo.
 * Las claves deben coincidir con las que usa `proxy.ts`.
 */
let redis: Redis | null = null;
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (url && token) redis = new Redis({ url, token });

export async function resetRateLimitFor(request: Request): Promise<void> {
  if (!redis) return;
  const ip = getClientIp(request.headers);
  try {
    // Solo el grupo de paneles (ver proxy.ts: contadores separados por grupo).
    await redis.del(`fw_attempts_panel_${ip}`, `fw_lockout_panel_${ip}`, `fw_level_panel_${ip}`);
  } catch (error) {
    console.error('Error reiniciando rate limit:', error);
  }
}

/**
 * Límite por clave para acciones del servidor (F1-10): ventana fija en Redis.
 * Clave recomendada: `<acción>:<uid>` (o `<acción>:ip:<ip>` para anónimos), así los
 * socios que comparten la IP del gimnasio no se bloquean entre sí.
 * Sin Redis no limita (fail-open) y lo registra.
 */
export async function limitAction(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ ok: boolean; retryAfter: number }> {
  if (!redis) return { ok: true, retryAfter: 0 };
  const redisKey = `rl_${key}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
    if (count > limit) {
      const ttl = await redis.ttl(redisKey);
      return { ok: false, retryAfter: ttl > 0 ? ttl : windowSeconds };
    }
    return { ok: true, retryAfter: 0 };
  } catch (error) {
    console.error('Error en limitAction:', error);
    return { ok: true, retryAfter: 0 };
  }
}

/** Respuesta 429 estándar para `limitAction`. */
export function tooManyRequests(retryAfter: number, message = 'Demasiadas solicitudes. Intenta más tarde.') {
  return Response.json(
    { error: message, secondsLeft: retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}
