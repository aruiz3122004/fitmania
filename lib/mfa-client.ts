'use client'

import {
  getMultiFactorResolver,
  multiFactor,
  signInWithEmailAndPassword,
  TotpMultiFactorGenerator,
  type TotpSecret,
  type User,
  type UserCredential,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

/**
 * Verificación en dos pasos con TOTP (F1-13). Requiere habilitar TOTP en
 * Firebase / Identity Platform. Una cuenta inscrita debe dar el código de 6 dígitos
 * en cada inicio de sesión (en el sitio y en los paneles).
 */

/** Inicia sesión; si la cuenta tiene TOTP, pide el código con `askCode`. */
export async function signInWithOptionalTotp(
  email: string,
  password: string,
  askCode: () => Promise<string | null>
): Promise<UserCredential> {
  try {
    return await signInWithEmailAndPassword(auth, email, password)
  } catch (err: any) {
    if (err?.code !== 'auth/multi-factor-auth-required') throw err
    const resolver = getMultiFactorResolver(auth, err)
    const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID)
    if (!hint) throw new Error('La cuenta requiere un segundo factor no soportado en este formulario.')
    const code = (await askCode())?.trim()
    if (!code) throw new Error('Se requiere el código de verificación de 6 dígitos.')
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code)
    return resolver.resolveSignIn(assertion)
  }
}

/** Pide el código con un diálogo simple del navegador. */
export const promptTotpCode = async () =>
  window.prompt('Verificación en dos pasos: ingresa el código de 6 dígitos de tu app autenticadora.')

export function hasTotp(user: User | null): boolean {
  return !!user && multiFactor(user).enrolledFactors.some((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID)
}

/** Paso 1 de la inscripción: genera el secreto y la URL para el código QR. */
export async function startTotpEnrollment(user: User): Promise<{ secret: TotpSecret; qrUrl: string; key: string }> {
  const session = await multiFactor(user).getSession()
  const secret = await TotpMultiFactorGenerator.generateSecret(session)
  return { secret, qrUrl: secret.generateQrCodeUrl(user.email || 'admin', 'FITMANIA'), key: secret.secretKey }
}

/** Paso 2: confirma con el primer código generado por la app autenticadora. */
export async function finishTotpEnrollment(user: User, secret: TotpSecret, code: string) {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim())
  await multiFactor(user).enroll(assertion, 'App autenticadora')
}
