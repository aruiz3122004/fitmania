/**
 * Verificación del pase de acceso EN EL NAVEGADOR, sin red (F2-06).
 * Usa la clave pública Ed25519 (`NEXT_PUBLIC_QR_PUBLIC_KEY`) con Web Crypto.
 * El servidor sigue siendo la verificación principal cuando hay conexión.
 */
export const ACCESS_TOKEN_PREFIX = 'FM1.'

export interface OfflinePassPayload {
  v: 1
  uid: string
  n: string
  p: string | null
  pe: number | null
  iat: number
  exp: number
}

const PUBLIC_KEY_B64 = process.env.NEXT_PUBLIC_QR_PUBLIC_KEY

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

let keyPromise: Promise<CryptoKey | null> | null = null
function getKey(): Promise<CryptoKey | null> {
  if (!PUBLIC_KEY_B64 || typeof crypto === 'undefined' || !crypto.subtle) return Promise.resolve(null)
  if (!keyPromise) {
    const der = fromB64url(PUBLIC_KEY_B64.replace(/=+$/, ''))
    keyPromise = crypto.subtle
      .importKey('spki', der as BufferSource, { name: 'Ed25519' }, false, ['verify'])
      .catch(() => null)
  }
  return keyPromise
}

export type OfflineVerifyResult =
  | { ok: true; payload: OfflinePassPayload }
  | { ok: false; reason: string }

export async function verifyPassOffline(code: string): Promise<OfflineVerifyResult> {
  if (!code.startsWith(ACCESS_TOKEN_PREFIX)) return { ok: false, reason: 'QR antiguo: sin conexión solo se aceptan pases firmados o socios del directorio guardado.' }
  const key = await getKey()
  if (!key) return { ok: false, reason: 'Este navegador no puede verificar pases sin conexión.' }
  const [encoded, signature] = code.slice(ACCESS_TOKEN_PREFIX.length).split('.')
  if (!encoded || !signature) return { ok: false, reason: 'Código QR no reconocido.' }
  try {
    const valid = await crypto.subtle.verify('Ed25519', key, fromB64url(signature) as BufferSource, new TextEncoder().encode(encoded))
    if (!valid) return { ok: false, reason: 'Pase inválido (firma incorrecta).' }
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(encoded))) as OfflinePassPayload
    if (payload.exp < Date.now()) return { ok: false, reason: 'El pase expiró. El socio debe abrir la app con conexión.' }
    return { ok: true, payload }
  } catch {
    return { ok: false, reason: 'Código QR no reconocido.' }
  }
}
