import { NextResponse } from 'next/server';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';
import { getClientIp } from '@/lib/client-ip';
import { SandboxError, sandboxOnly, startSandboxSession } from '@/lib/sandbox/server';

// El primer visitante tras un rato puede disparar el reinicio de los datos de ejemplo.
export const maxDuration = 60;

/**
 * POST /api/sandbox/start — crea una cuenta temporal con todos los roles y devuelve un
 * token para iniciar sesión con ella. Solo existe en el despliegue del sandbox.
 */
export async function POST(request: Request) {
  const notHere = sandboxOnly();
  if (notHere) return notHere;

  // Cada visita crea una cuenta: 6 por hora por red es de sobra para probar.
  const rl = await limitAction(`sandbox:ip:${getClientIp(request.headers)}`, 6, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Ya abriste varias sesiones de prueba. Intenta más tarde.');

  try {
    return NextResponse.json(await startSandboxSession());
  } catch (error) {
    if (error instanceof SandboxError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[/api/sandbox/start]', error);
    return NextResponse.json({ error: 'No se pudo preparar el sandbox. Intenta de nuevo.' }, { status: 500 });
  }
}
