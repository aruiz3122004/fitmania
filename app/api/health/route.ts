import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * GET /api/health — estado de las dependencias críticas (F2-10).
 *
 * Pensado para un monitor de uptime (cada 1 min): responde 200 si todo está bien
 * y 503 si falla algo crítico. No expone valores ni nombres de variables.
 */
export const dynamic = 'force-dynamic';

type Check = { ok: boolean; latencyMs?: number; critical: boolean };

async function timed(fn: () => Promise<unknown>): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

export async function GET() {
  const checks: Record<string, Check> = {};

  // Firestore: una lectura de un documento pequeño (exista o no).
  checks.firestore = {
    critical: true,
    ...(await timed(() => getAdminFirestore().collection('system').doc('health').get())),
  };

  // Redis (rate limiting): no crítico para servir la app, pero sin él la protección se apaga.
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  checks.rateLimit = redisUrl && redisToken
    ? { critical: false, ...(await timed(() => new Redis({ url: redisUrl, token: redisToken }).ping())) }
    : { critical: false, ok: false };

  // Configuración mínima para cobrar, enviar correos y correr el cron.
  checks.payments = { critical: true, ok: !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET };
  checks.email = { critical: false, ok: !!process.env.RESEND_API_KEY };
  checks.cron = { critical: false, ok: !!process.env.CRON_SECRET };

  const healthy = Object.values(checks).every((c) => c.ok || !c.critical);
  const degraded = Object.values(checks).some((c) => !c.ok);

  return NextResponse.json(
    {
      status: healthy ? (degraded ? 'degraded' : 'ok') : 'down',
      timestamp: new Date().toISOString(),
      checks: Object.fromEntries(
        Object.entries(checks).map(([name, { ok, latencyMs }]) => [name, latencyMs !== undefined ? { ok, latencyMs } : { ok }])
      ),
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
