import { Redis } from '@upstash/redis';
import { getClientIp } from '@/lib/client-ip';

/**
 * Reinicio del contador de rate limit SOLO desde el servidor y SOLO tras un
 * acceso verificado (F1-10, auditoría B5).
 *
 * Antes existía `POST /api/security/success`, atendido por el middleware sin
 * autenticación: cualquiera podía borrar su propio contador y anular el bloqueo.
 * Las claves deben coincidir con las que usa `middleware.ts`.
 */
let redis: Redis | null = null;
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (url && token) redis = new Redis({ url, token });

export async function resetRateLimitFor(request: Request): Promise<void> {
  if (!redis) return;
  const ip = getClientIp(request.headers);
  try {
    await redis.del(`fw_attempts_${ip}`, `fw_lockout_${ip}`, `fw_level_${ip}`);
  } catch (error) {
    console.error('Error reiniciando rate limit:', error);
  }
}
