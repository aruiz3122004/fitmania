/**
 * Instrumentación del servidor (Next.js).
 * - register(): valida las variables de entorno al iniciar cada instancia (F1-02).
 * - onRequestError(): registro estructurado de errores con su `x-request-id` (F1-03),
 *   y reporte a Sentry si `SENTRY_DSN` está definida (F2-11, lib/sentry.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logEnvReport } = await import('@/lib/env');
    logEnvReport();
  }
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  const err = error as { message?: string; digest?: string; name?: string; stack?: string };
  const requestId = request.headers['x-request-id'];
  console.error(
    JSON.stringify({
      level: 'error',
      msg: err?.message || 'Error no controlado',
      digest: err?.digest,
      requestId,
      method: request.method,
      path: request.path,
      route: context.routePath,
      routeType: context.routeType,
      at: new Date().toISOString(),
    })
  );

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { captureError } = await import('@/lib/sentry');
    await captureError({
      source: 'server',
      message: err?.message || 'Error no controlado',
      type: err?.name,
      stack: err?.stack,
      digest: err?.digest,
      requestId: typeof requestId === 'string' ? requestId : undefined,
      path: request.path,
      method: request.method,
      route: context.routePath,
    });
  }
}
