/**
 * Límite de publicaciones en el foro: hasta 3 seguidas y luego una pausa de 5 minutos
 * desde la última. Las reglas de Firestore aplican lo mismo sobre `forum_rate/{uid}`
 * (el cliente solo lo usa para mostrar la cuenta regresiva y no subir archivos en vano).
 */
export const FORUM_BURST = 3
export const FORUM_COOLDOWN_MS = 5 * 60 * 1000

export interface ForumRate {
  count: number
  last: Date | null
}

export type ForumRateCheck =
  | { allowed: true; nextCount: number }
  | { allowed: false; retryAt: Date }

export function checkForumRate(rate: ForumRate | null, now: Date = new Date()): ForumRateCheck {
  if (!rate?.last || now.getTime() > rate.last.getTime() + FORUM_COOLDOWN_MS) {
    return { allowed: true, nextCount: 1 }
  }
  if (rate.count < FORUM_BURST) return { allowed: true, nextCount: rate.count + 1 }
  return { allowed: false, retryAt: new Date(rate.last.getTime() + FORUM_COOLDOWN_MS) }
}

/** Publicaciones que le quedan antes de la pausa. */
export function remainingForumPosts(rate: ForumRate | null, now: Date = new Date()): number {
  const check = checkForumRate(rate, now)
  return check.allowed ? FORUM_BURST - check.nextCount + 1 : 0
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
