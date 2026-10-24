import { NextResponse } from 'next/server';
import { captureError } from '@/lib/sentry';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';
import { getClientIp } from '@/lib/client-ip';

/**
 * POST /api/client-error — errores de la interfaz hacia Sentry (F2-11).
 *
 * Lo llama app/error.tsx. El servidor reenvía a Sentry (el DSN no se publica) con
 * mensaje, tipo, pila, digest y ruta sin query string. Sin datos del usuario.
 */
export async function POST(request: Request) {
  const rl = await limitAction(`client-error:${getClientIp(request.headers)}`, 20, 600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message : '';
  if (!message) return NextResponse.json({ error: 'Sin mensaje.' }, { status: 400 });

  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
  const sent = await captureError({
    source: 'client',
    message: message.slice(0, 1000),
    type: str(body.type, 100),
    stack: str(body.stack, 4000),
    digest: str(body.digest, 100),
    path: str(body.path, 500),
    requestId: request.headers.get('x-request-id') || undefined,
  });
  return NextResponse.json({ received: true, sent });
}
