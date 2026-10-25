import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

/**
 * Pase de acceso firmado (F2-05, bloqueante B6).
 *
 * Antes el QR era el UID fijo del socio: una captura de pantalla compartida daba
 * acceso indefinido. Ahora el QR lleva `FM1.<payload>.<firma>`:
 *   payload = base64url(JSON { v, uid, n (nombre), p (plan), pe (vence plan, ms), iat, exp })
 *   firma   = Ed25519(payload) con la clave privada del servidor.
 * Recepción lo verifica en el servidor o, SIN RED, con la clave pública (F2-06).
 *
 * Claves (generar con `node tools/generate-qr-keys.mjs`):
 *   QR_SIGNING_PRIVATE_KEY      → PKCS8 PEM en base64 (solo servidor)
 *   NEXT_PUBLIC_QR_PUBLIC_KEY   → SPKI DER en base64 (público, para verificar offline)
 *   QR_REQUIRE_SIGNED=true      → rechaza los QR antiguos con UID plano
 */
export const ACCESS_TOKEN_PREFIX = 'FM1.';

export interface AccessTokenPayload {
  v: 1;
  uid: string;
  n: string;
  p: string | null;
  pe: number | null;
  iat: number;
  exp: number;
}

let cachedPrivate: KeyObject | null | undefined;
let cachedPublic: KeyObject | null | undefined;

function privateKey(): KeyObject | null {
  if (cachedPrivate !== undefined) return cachedPrivate;
  const raw = process.env.QR_SIGNING_PRIVATE_KEY;
  cachedPrivate = raw ? createPrivateKey(Buffer.from(raw, 'base64').toString('utf8')) : null;
  return cachedPrivate;
}

function publicKey(): KeyObject | null {
  if (cachedPublic !== undefined) return cachedPublic;
  const raw = process.env.NEXT_PUBLIC_QR_PUBLIC_KEY;
  cachedPublic = raw
    ? createPublicKey({ key: Buffer.from(raw, 'base64'), format: 'der', type: 'spki' })
    : privateKey()
      ? createPublicKey(privateKey()!)
      : null;
  return cachedPublic;
}

export function signedAccessEnabled(): boolean {
  return !!privateKey();
}

export function requireSignedAccess(): boolean {
  return process.env.QR_REQUIRE_SIGNED === 'true' && signedAccessEnabled();
}

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function createAccessToken(data: Omit<AccessTokenPayload, 'v' | 'iat' | 'exp'>, ttlSeconds: number): string | null {
  const key = privateKey();
  if (!key) return null;
  const iat = Date.now();
  const payload: AccessTokenPayload = { v: 1, ...data, iat, exp: iat + ttlSeconds * 1000 };
  const encoded = b64url(Buffer.from(JSON.stringify(payload)));
  const signature = sign(null, Buffer.from(encoded), key);
  return `${ACCESS_TOKEN_PREFIX}${encoded}.${b64url(signature)}`;
}

export type VerifyResult =
  | { ok: true; payload: AccessTokenPayload }
  | { ok: false; reason: 'format' | 'signature' | 'expired' | 'disabled' };

export function verifyAccessToken(code: string): VerifyResult {
  if (!code.startsWith(ACCESS_TOKEN_PREFIX)) return { ok: false, reason: 'format' };
  const key = publicKey();
  if (!key) return { ok: false, reason: 'disabled' };
  const [encoded, signature] = code.slice(ACCESS_TOKEN_PREFIX.length).split('.');
  if (!encoded || !signature) return { ok: false, reason: 'format' };
  try {
    if (!verify(null, Buffer.from(encoded), key, fromB64url(signature))) return { ok: false, reason: 'signature' };
    const payload = JSON.parse(fromB64url(encoded).toString('utf8')) as AccessTokenPayload;
    if (payload.v !== 1 || typeof payload.uid !== 'string') return { ok: false, reason: 'format' };
    if (payload.exp < Date.now()) return { ok: false, reason: 'expired' };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'format' };
  }
}
