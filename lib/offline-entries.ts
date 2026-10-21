/**
 * Cola de ingresos registrados SIN conexión en recepción (F2-06 / plan B).
 *
 * Se guarda en el almacenamiento local del equipo de recepción y se sincroniza
 * al volver la red. Cada ingreso lleva un `clientId` único: el servidor lo usa
 * como ID del documento, así un reintento nunca duplica el registro.
 */
const KEY = 'fitmania_offline_entries'
const MEMBERS_KEY = 'fitmania_members_cache'

export interface OfflineEntry {
  clientId: string
  userId: string
  userName: string
  occurredAt: string // ISO
}

function read(): OfflineEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as OfflineEntry[]) : []
  } catch {
    return []
  }
}

function write(list: OfflineEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Almacenamiento lleno o bloqueado: no hay mucho más que hacer en el cliente.
  }
}

export function pendingOfflineEntries(): OfflineEntry[] {
  return read()
}

export function enqueueOfflineEntry(userId: string, userName: string): OfflineEntry {
  const entry: OfflineEntry = {
    clientId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId,
    userName,
    occurredAt: new Date().toISOString(),
  }
  write([...read(), entry])
  return entry
}

/** Envía los ingresos pendientes. Devuelve cuántos se sincronizaron y cuántos quedan. */
export async function syncOfflineEntries(): Promise<{ synced: number; remaining: number }> {
  let synced = 0
  for (const entry of read()) {
    let res: Response
    try {
      res = await fetch('/api/recepcion/entry-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: entry.userId, source: 'offline', occurredAt: entry.occurredAt, clientId: entry.clientId }),
      })
    } catch {
      break // sigue sin red
    }
    if (res.status === 401) break // sesión vencida: se reintenta tras iniciar sesión
    // 200 (registrado), 409 (duplicado/ya sincronizado), 400/404 (descartable): se quita de la cola.
    if (res.ok || res.status === 409 || res.status === 400 || res.status === 404 || res.status === 422) {
      write(read().filter((e) => e.clientId !== entry.clientId))
      if (res.ok) synced++
    } else {
      break // 5xx: reintentar más tarde
    }
  }
  return { synced, remaining: read().length }
}

/** Directorio guardado para buscar socios manualmente sin conexión. */
export function cacheMembers(members: unknown[]) {
  try {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify({ savedAt: Date.now(), members }))
  } catch {
    // Ignorar: la caché es una ayuda, no un requisito.
  }
}

export function cachedMembers<T = any>(): { savedAt: number; members: T[] } | null {
  try {
    const raw = localStorage.getItem(MEMBERS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
