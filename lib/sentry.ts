import { randomUUID } from 'node:crypto';

/**
 * Reporte de errores a Sentry por su API HTTP (F2-11), sin SDK: solo servidor.
 *
 * - Activo únicamente si `SENTRY_DSN` está definida; si no, no hace nada.
 * - Los errores del navegador llegan por /api/client-error, así el DSN no se
 *   publica ni hay que abrir la CSP a sentry.io.
 * - Sin PII: rutas sin query string, sin cuerpo, cabeceras ni datos del usuario;
 *   cada evento lleva el `requestId` para cruzarlo con los logs.
 * Sin imports del proyecto para poder probarlo con `node --test`.
 */

export interface SentryDsn {
  host: string;
  projectId: string;
  publicKey: string;
  envelopeUrl: string;
}

export function parseDsn(dsn: string | undefined): SentryDsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn.trim());
    const projectId = url.pathname.replace(/^\/+|\/+$/g, '');
    if (url.protocol !== 'https:' || !url.username || !/^\d+$/.test(projectId)) return null;
    return {
      host: url.host,
      projectId,
      publicKey: url.username,
      envelopeUrl: `https://${url.host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

/** Ruta sin query string ni fragmento (los parámetros pueden traer datos personales). */
export function scrubPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  return path.split(/[?#]/)[0].slice(0, 200);
}

export interface ErrorReport {
  message: string;
  type?: string;
  stack?: string;
  source: 'server' | 'client';
  requestId?: string;
  digest?: string;
  path?: string;
  method?: string;
  route?: string;
}

export function buildEnvelope(dsn: string, report: ErrorReport, now = new Date(), eventId = randomUUID().replace(/-/g, '')): string {
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: 'javascript',
    level: 'error',
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    ...(process.env.VERCEL_GIT_COMMIT_SHA ? { release: process.env.VERCEL_GIT_COMMIT_SHA } : {}),
    exception: { values: [{ type: report.type || 'Error', value: report.message.slice(0, 1000) }] },
    tags: {
      source: report.source,
      ...(report.requestId ? { requestId: report.requestId } : {}),
      ...(report.digest ? { digest: report.digest } : {}),
      ...(report.route ? { route: report.route } : {}),
    },
    ...(report.path ? { request: { url: scrubPath(report.path), method: report.method } } : {}),
    ...(report.stack ? { extra: { stack: report.stack.slice(0, 4000) } } : {}),
  };
  return [
    JSON.stringify({ event_id: eventId, sent_at: now.toISOString(), dsn }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');
}

/** Envía el error a Sentry. Nunca lanza: el reporte no debe romper la respuesta. */
export async function captureError(report: ErrorReport): Promise<boolean> {
  const dsn = process.env.SENTRY_DSN?.trim();
  const parsed = parseDsn(dsn);
  if (!dsn || !parsed) return false;
  try {
    const res = await fetch(parsed.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=fitmania/1.0`,
      },
      body: buildEnvelope(dsn, report),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
