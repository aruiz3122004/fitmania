import type { Firestore } from 'firebase-admin/firestore';

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

const HISTORY_LIMIT = 5;

/**
 * Ficha del socio para recepción: datos mínimos + últimas órdenes y check-ins.
 * Devuelve null si el socio no existe.
 */
export async function getMemberDetail(db: Firestore, uid: string) {
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) return null;
  const data = userSnap.data() || {};

  // Sin orderBy para no exigir índices compuestos; se ordena en memoria (pocos docs por socio).
  const [ordersSnap, checkInsSnap] = await Promise.all([
    db.collection('orders').where('uid', '==', uid).get(),
    db.collection('checkIns').where('userId', '==', uid).get(),
  ]);

  const byDateDesc = (a: Date | null, b: Date | null) => (b?.getTime() || 0) - (a?.getTime() || 0);

  const orders = ordersSnap.docs
    .map((d) => ({ id: d.id, raw: d.data() }))
    .sort((a, b) => byDateDesc(toDateValue(a.raw.fecha), toDateValue(b.raw.fecha)))
    .slice(0, HISTORY_LIMIT)
    .map(({ id, raw }) => ({
      id,
      fecha: toSeconds(raw.fecha),
      total: Number(raw.total) || 0,
      concepto: raw.concepto || null,
      items: Array.isArray(raw.items) ? raw.items.map((it: any) => ({ nombre: it.nombre, cantidad: it.cantidad })) : [],
    }));

  const checkIns = checkInsSnap.docs
    .map((d) => ({ id: d.id, raw: d.data() }))
    .sort((a, b) => byDateDesc(toDateValue(a.raw.timestamp), toDateValue(b.raw.timestamp)))
    .slice(0, HISTORY_LIMIT)
    .map(({ id, raw }) => ({ id, timestamp: toSeconds(raw.timestamp) }));

  return {
    member: {
      ...projectMemberSummary(uid, data),
      email: maskEmail(data.email),
      createdAt: toSeconds(data.createdAt),
    },
    orders,
    checkIns,
  };
}
