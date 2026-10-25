import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * Catálogo público renderizado en el servidor (F2-21 / F3-18).
 *
 * Antes el home abría un listener de Firestore por visitante y el HTML inicial no
 * traía planes ni productos (malo para SEO). Ahora el servidor los lee con caché en
 * memoria de 60 s por instancia y los entrega ya serializados a los componentes.
 */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; data: unknown }>();

/** Convierte Timestamps y Dates a texto ISO para poder pasarlos a componentes cliente. */
function plain(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  try {
    const data = await load();
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (error) {
    console.error(`[catalog] No se pudo cargar ${key}:`, error);
    // Si falla, se sirve lo último conocido; sin datos, el componente carga en el cliente.
    return (hit?.data as T) ?? null;
  }
}

export function getPublicPlanes() {
  return cached('planes', async () => {
    const snap = await getAdminFirestore().collection('planes').orderBy('price', 'asc').get();
    return snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
  });
}

export function getPublicProducts() {
  return cached('products', async () => {
    const snap = await getAdminFirestore().collection('products').orderBy('nombre', 'asc').get();
    return snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
  });
}
