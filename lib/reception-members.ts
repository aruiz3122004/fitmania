/**
 * Proyecciones mínimas de socios para el panel de recepción (F2-18 / F3-05).
 *
 * Antes recepción leía con el SDK cliente TODA la colección `users` (peso,
 * altura, correo, etc.). Ahora el servidor devuelve solo lo necesario para
 * validar el ingreso. Las fechas se devuelven como `{ seconds }` (misma forma
 * que un Timestamp de Firestore serializado), normalizando también los planes
 * guardados con fecha en texto.
 */

export type SecondsTimestamp = { seconds: number };

export function toDateValue(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toSeconds(value: any): SecondsTimestamp | null {
  const d = toDateValue(value);
  return d ? { seconds: Math.floor(d.getTime() / 1000) } : null;
}

/** `juan.perez@gmail.com` → `ju***@gmail.com` */
export function maskEmail(email: unknown): string {
  if (typeof email !== 'string' || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

export function projectPlan(plan: any) {
  if (!plan) return null;
  const expira = toSeconds(plan.expira);
  if (!expira) return null;
  return {
    nombre: String(plan.nombre || 'Plan'),
    expira,
    acompanante: plan.acompanante
      ? {
          nombre: String(plan.acompanante.nombre || ''),
          rutinaDias: Array.isArray(plan.acompanante.rutinaDias) ? plan.acompanante.rutinaDias : [],
        }
      : null,
  };
}

/** Datos de lista (directorio y búsqueda manual): sin correo ni datos físicos. */
export function projectMemberSummary(id: string, data: any) {
  return {
    id,
    username: String(data?.username || 'Socio'),
    photoURL: data?.photoURL || null,
    plan: projectPlan(data?.plan),
  };
}
