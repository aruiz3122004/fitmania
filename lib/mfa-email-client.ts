'use client'

import { create } from 'zustand'
import { auth } from '@/lib/firebase'

/**
 * Cliente de la verificación en dos pasos por correo (ver lib/mfa.ts y /api/auth/mfa).
 *
 * `ensureMfaVerified()` se llama después de iniciar sesión con contraseña: si la
 * cuenta tiene la verificación activa y esta sesión no la ha completado, abre la
 * ventana global (components/auth/mfa-gate.tsx) y espera a que el usuario ingrese
 * el código. Si la cancela, se cierra la sesión.
 */

export type MfaPurpose = 'login' | 'enable' | 'disable'

export interface MfaStatus {
  enabled: boolean
  verified: boolean
  email: string
  recoveryRemaining: number
}

/** Evento para que el resto de la app recargue lo que se le negó antes de verificar. */
export const MFA_VERIFIED_EVENT = 'fitmania:mfa-verified'

async function call<T>(init: RequestInit = {}): Promise<T> {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')
  const res = await fetch('/api/auth/mfa', {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'No se pudo completar la verificación.') as Error & { status?: number; secondsLeft?: number }
    err.status = res.status
    err.secondsLeft = data.secondsLeft
    throw err
  }
  return data as T
}

export const fetchMfaStatus = () => call<MfaStatus>()

export const sendMfaCode = (purpose: MfaPurpose) =>
  call<{ sent: true; email: string }>({ method: 'POST', body: JSON.stringify({ action: 'send', purpose }) })

export const verifyMfaCode = (purpose: MfaPurpose, code: string) =>
  call<{ verified: true; recoveryCodes?: string[] }>({ method: 'POST', body: JSON.stringify({ action: 'verify', purpose, code }) })

export const redeemRecoveryCode = (code: string) =>
  call<{ verified: true; recoveryRemaining: number }>({ method: 'POST', body: JSON.stringify({ action: 'recover', code }) })

type Waiter = { resolve: () => void; reject: (err: Error) => void }

interface GateState {
  open: boolean
  email: string
  waiters: Waiter[]
  show: (email: string, waiter?: Waiter) => void
  finish: (ok: boolean) => void
}

export const useMfaGate = create<GateState>((set, get) => ({
  open: false,
  email: '',
  waiters: [],
  show: (email, waiter) =>
    set((s) => ({ open: true, email: email || s.email, waiters: waiter ? [...s.waiters, waiter] : s.waiters })),
  finish: (ok) => {
    const { waiters } = get()
    set({ open: false, waiters: [] })
    for (const w of waiters) {
      if (ok) w.resolve()
      else w.reject(new Error('Verificación en dos pasos cancelada.'))
    }
    if (ok && typeof window !== 'undefined') window.dispatchEvent(new Event(MFA_VERIFIED_EVENT))
  },
}))

/** Resuelve cuando la sesión actual ya cumple la verificación (o no la necesita). */
export async function ensureMfaVerified(): Promise<void> {
  if (!auth.currentUser) return
  const status = await fetchMfaStatus()
  if (!status.enabled || status.verified) return
  await new Promise<void>((resolve, reject) => useMfaGate.getState().show(status.email, { resolve, reject }))
}
