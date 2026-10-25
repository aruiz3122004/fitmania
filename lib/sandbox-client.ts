'use client'

import { useEffect, useState } from 'react'
import { onIdTokenChanged, signInWithCustomToken, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/lib/store'
import { IS_SANDBOX, MAIN_SITE_URL } from '@/lib/sandbox'

/** Crea la cuenta temporal en el servidor e inicia sesión con ella. */
export async function startSandbox(): Promise<void> {
  const res = await fetch('/api/sandbox/start', { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo preparar el sandbox.')
  // Si había otra sesión de prueba abierta en este navegador, se cierra primero.
  if (auth.currentUser) await signOut(auth)
  await signInWithCustomToken(auth, data.token)
}

/**
 * Borra la cuenta temporal con todo lo que creó y vuelve al sitio real. Si el borrado
 * falla, la sesión se cierra igual: la limpieza automática la borra al vencer.
 */
export async function exitSandbox(): Promise<void> {
  const user = auth.currentUser
  if (user) {
    const idToken = await user.getIdToken().catch(() => null)
    if (idToken) {
      await fetch('/api/sandbox/end', { method: 'POST', headers: { Authorization: `Bearer ${idToken}` } }).catch(() => undefined)
    }
    await signOut(auth).catch(() => undefined)
  }
  useAuthStore.getState().logout()
  window.location.assign(MAIN_SITE_URL || '/sandbox?salida=1')
}

export interface SandboxSession {
  /** La sesión actual es una cuenta temporal del sandbox. */
  active: boolean
  expiresAt: number | null
  email: string | null
}

/** Lee del token si la sesión es del sandbox y cuándo vence. */
export function useSandboxSession(): SandboxSession {
  const [session, setSession] = useState<SandboxSession>({ active: false, expiresAt: null, email: null })

  useEffect(() => {
    if (!IS_SANDBOX) return
    return onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setSession({ active: false, expiresAt: null, email: null })
        return
      }
      const { claims } = await user.getIdTokenResult().catch(() => ({ claims: {} as Record<string, unknown> }))
      setSession({
        active: claims.sandbox === true,
        expiresAt: typeof claims.sandboxExpires === 'number' ? claims.sandboxExpires : null,
        email: user.email,
      })
    })
  }, [])

  return session
}
