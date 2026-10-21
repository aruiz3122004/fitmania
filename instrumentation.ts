/**
 * Instrumentación del servidor (Next.js).
 * - register(): valida las variables de entorno al iniciar cada instancia (F1-02).
 * - onRequestError(): registro estructurado de errores con su `x-request-id` (F1-03),
 *   base mínima de observabilidad hasta integrar Sentry (F2-11).
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
  const err = error as { message?: string; digest?: string };
  console.error(
    JSON.stringify({
      level: 'error',
      msg: err?.message || 'Error no controlado',
      digest: err?.digest,
      requestId: request.headers['x-request-id'],
      method: request.method,
      path: request.path,
      route: context.routePath,
      routeType: context.routeType,
      at: new Date().toISOString(),
    })
  );
}
