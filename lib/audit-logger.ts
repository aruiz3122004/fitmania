import { getAdminFirestore } from '@/lib/firebase-admin';
import { headers } from 'next/headers';

type AuditCategory = 'AUTH_SUCCESS' | 'AUTH_FAILURE' | 'ADMIN_ACTION' | 'SECURITY_BLOCK';

interface AuditLogOptions {
  action: string;
  category: AuditCategory;
  details: string;
  adminEmail?: string;
  targetId?: string;
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
    
    try {
      const headersList = await headers();
      ip = (headersList.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
    } catch {
      // Fallback si no estamos en contexto aplicable para next/headers
      if (options.request) {
         ip = (options.request.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
      }
    }

    const logEntry = {
      action: options.action,
      category: options.category,
      details: options.details,
      adminEmail: options.adminEmail || 'SYSTEM/ANON',
      targetId: options.targetId || null,
      ip: ip,
      timestamp: new Date(),
    };

    await db.collection('audit_logs').add(logEntry);
  } catch (error) {
    // Nunca romper el flujo principal si el logger falla
    console.error('CRITICAL: Failure writing to audit_logs:', error);
  }
}
