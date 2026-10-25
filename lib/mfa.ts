import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Verificación en dos pasos por correo (opcional para cualquier cuenta).
 *
 * Firebase Auth solo ofrece SMS y TOTP como segundo factor, así que el código por
 * correo se implementa aquí: tras la contraseña, el servidor envía un código de 6
 * dígitos y, al validarlo, marca como verificada ESA sesión (el `auth_time` del
 * token, que se conserva al renovar el token y cambia en cada inicio de sesión).
 *
 * Firestore (solo Admin SDK; las reglas lo leen con get()):
 *   mfa_state/{uid}      { enabled, sessions: number[], recoveryHashes: string[] }
 *   mfa_challenges/{uid} { purpose, authTime, salt, codeHash, expiresAt, attempts, sentAt }
 *
 * Sin imports del proyecto para poder probarlo con `node --test`.
 */

export const CODE_TTL_MS = 10 * 60 * 1000; // vigencia de un código
export const RESEND_COOLDOWN_MS = 60 * 1000; // espera entre envíos
export const MAX_ATTEMPTS = 5; // intentos por código
export const MAX_SESSIONS = 10; // sesiones verificadas recordadas (varios dispositivos)
export const RECOVERY_CODES = 8;

export type MfaPurpose = 'login' | 'enable' | 'disable';

export function isMfaPurpose(value: unknown): value is MfaPurpose {
  return value === 'login' || value === 'enable' || value === 'disable';
}

/** Código numérico de 6 dígitos (con ceros a la izquierda). */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function newSalt(): string {
  return randomBytes(16).toString('hex');
}

export function hashCode(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

/** Compara en tiempo constante el código ingresado con el hash guardado. */
export function codeMatches(input: string, salt: string, expectedHash: string): boolean {
  const clean = input.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const a = Buffer.from(hashCode(clean, salt), 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// Sin 0/O/1/I/L para que se puedan copiar a mano sin confusiones.
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Códigos de recuperación de un solo uso, con el formato `XXXXX-XXXXX`. */
export function generateRecoveryCodes(count = RECOVERY_CODES): string[] {
  return Array.from({ length: count }, () => {
    let raw = '';
    for (let i = 0; i < 10; i++) raw += RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)];
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashRecoveryCode(uid: string, code: string): string {
  return createHash('sha256').update(`${uid}:${normalizeRecoveryCode(code)}`).digest('hex');
}

/** Agrega la sesión verificada conservando solo las más recientes. */
export function addSession(sessions: unknown, authTime: number): number[] {
  const list = Array.isArray(sessions) ? sessions.filter((s): s is number => Number.isInteger(s)) : [];
  return [...list.filter((s) => s !== authTime), authTime].slice(-MAX_SESSIONS);
}

export interface MfaStateLike {
  enabled?: boolean;
  sessions?: unknown;
}

/**
 * ¿La sesión cumple la verificación en dos pasos?
 * - Sin verificación activa: sí.
 * - Sesión iniciada con TOTP de Firebase (`secondFactor`): sí.
 * - Con verificación por correo: solo si su `auth_time` fue verificado.
 */
export function sessionSatisfiesMfa(
  state: MfaStateLike | null | undefined,
  authTime: number | undefined,
  secondFactor?: string | null
): boolean {
  if (!state?.enabled) return true;
  if (secondFactor) return true;
  return Number.isInteger(authTime) && Array.isArray(state.sessions) && state.sessions.includes(authTime);
}
