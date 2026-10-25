import { getAdminFirestore } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { getClientIp } from '@/lib/client-ip';
import { auditChanges, normalizeAuditValue } from '@/lib/audit-diff';

type AuditCategory = 'AUTH_SUCCESS' | 'AUTH_FAILURE' | 'ADMIN_ACTION' | 'SECURITY_BLOCK' | 'PLAN_MANAGEMENT';

interface AuditLogOptions {
  action: string;
  category: AuditCategory;
  details: string;
  adminEmail?: string;
  /** F1-26: UID de quien hizo la acción (además del correo). */
  actorUid?: string;
  targetId?: string;
  /**
   * F1-26: estado antes y después. Con ambos se guardan solo los campos cambiados
   * (`changes`); con solo `before` (un borrado) se guarda la foto de lo eliminado.
   */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown>;
  request?: Request; // Para extraer IP (opcional porque en algunas rutas no tenemos request a mano)
}

/**
 * Registra una acción administrativa o evento de seguridad en la colección
 * inmutable `audit_logs` de Firebase.
 */
export async function recordAuditLog(options: AuditLogOptions) {
  try {
    const db = getAdminFirestore();

    // Extraer IP de headers de next/headers o del objeto Request manual
    let ip = 'unknown';
    let requestId: string | null = null;
    
    // F1-26: IP confiable (x-vercel-forwarded-for); `x-forwarded-for` es falsificable.
    try {
      const h = await headers();
      ip = getClientIp(h);
      requestId = h.get('x-request-id');
    } catch {
      // Fallback si no estamos en contexto aplicable para next/headers
      if (options.request) {
         ip = getClientIp(options.request.headers);
         requestId = options.request.headers.get('x-request-id');
      }
    }

    const logEntry = {
      action: options.action,
      category: options.category,
      details: options.details,
      adminEmail: options.adminEmail || 'SYSTEM/ANON',
      actorUid: options.actorUid || null,
      targetId: options.targetId || null,
      ...(options.after
        ? { changes: auditChanges(options.before, options.after) }
        : options.before
          ? { deleted: normalizeAuditValue(options.before) }
          : {}),
      ip: ip,
      requestId, // F1-03: correlación con los logs del servidor
      timestamp: new Date(),
    };

    await db.collection('audit_logs').add(logEntry);
  } catch (error) {
    // Nunca romper el flujo principal si el logger falla
    console.error('CRITICAL: Failure writing to audit_logs:', error);
  }
}
