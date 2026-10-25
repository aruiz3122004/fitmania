/**
 * Modo sandbox: una copia del sitio para que cualquiera pruebe TODO (socio, recepción y
 * administración) sin tocar la aplicación real.
 *
 * Aislamiento: el sandbox es OTRO despliegue del mismo código, conectado a OTRO proyecto
 * de Firebase (ver docs/sandbox.md). Ni un error en el código puede alcanzar los datos
 * reales, porque ese despliegue no tiene sus credenciales.
 *
 *   Sitio real     → NEXT_PUBLIC_SANDBOX_URL apunta al sandbox (muestra el botón del menú).
 *   Sitio sandbox  → NEXT_PUBLIC_SANDBOX_MODE=true y NEXT_PUBLIC_MAIN_SITE_URL apunta al real.
 *
 * Sin imports del proyecto para poder usarlo en el cliente, el servidor y el proxy.
 */
export const IS_SANDBOX = process.env.NEXT_PUBLIC_SANDBOX_MODE === 'true'

const trimSlash = (v: string | undefined) => (v || '').trim().replace(/\/$/, '')

/** Sitio sandbox (solo lo usa el sitio real para el botón del menú). */
export const SANDBOX_URL = trimSlash(process.env.NEXT_PUBLIC_SANDBOX_URL)
/** Sitio real (el sandbox vuelve aquí al salir). */
export const MAIN_SITE_URL = trimSlash(process.env.NEXT_PUBLIC_MAIN_SITE_URL)

/** Duración de una visita. Al vencer, sus datos se borran en la siguiente limpieza. */
export const SANDBOX_SESSION_MS = 2 * 60 * 60 * 1000
/** Visitas simultáneas como máximo (cada una crea una cuenta temporal). */
export const SANDBOX_MAX_ACTIVE = 40
/** Dominio reservado (RFC 2606): los correos del sandbox nunca salen, se guardan en su buzón. */
export const SANDBOX_EMAIL_DOMAIN = 'sandbox.fitmania.test'

/** Carpeta de Cloudinary del sandbox (se vacía en cada reinicio). */
export const SANDBOX_UPLOAD_ROOT = 'fitmania-sandbox'

/** Adónde lleva el botón "Modo Sandbox" del menú, o null si no está configurado. */
export function sandboxEntryHref(): string | null {
  if (IS_SANDBOX) return '/sandbox'
  return SANDBOX_URL ? `${SANDBOX_URL}/sandbox` : null
}

/** Nombre visible de la cuenta temporal: "Explorador 4F2A". */
export function explorerName(uid: string): string {
  return `Explorador ${uid.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}`
}

export function isSandboxSessionExpired(expiresAt: Date | null | undefined, now: Date = new Date()): boolean {
  return !expiresAt || expiresAt.getTime() <= now.getTime()
}
