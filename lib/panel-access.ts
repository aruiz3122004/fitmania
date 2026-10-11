'use client'

import { useEffect, useState } from 'react'
import { onIdTokenChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { clearRateLimit } from '@/lib/rate-limit-client'

export type PanelRole = 'admin' | 'recepcion' | null

const PANEL_BY_ROLE: Record<Exclude<PanelRole, null>, { path: string; label: string }> = {
  admin: { path: '/fitministration', label: 'Panel de Administración' },
  recepcion: { path: '/fitception', label: 'Panel de Recepción' },
}

/**
 * Lee los custom claims del usuario actual (Firebase) y determina a qué panel
 * interno tiene acceso. Solo devolverá rol si el token trae el claim `admin`
 * o `receptionist`. La verificación real la hace el servidor en cada request.
 */
export function usePanelAccess() {
  const [role, setRole] = useState<PanelRole>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setRole(null)
        setLoading(false)
        return
      }
      try {
        const result = await user.getIdTokenResult()
        if (result.claims.admin === true) setRole('admin')
        else if (result.claims.receptionist === true) setRole('recepcion')
        else setRole(null)
      } catch {
        setRole(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const info = role ? PANEL_BY_ROLE[role] : null
  return { role, loading, path: info?.path ?? '', label: info?.label ?? '' }
}

/**
 * Abre el panel interno que corresponde al rol del usuario actual.
 *
 * Reutiliza la sesión de Firebase ya activa: pide un ID token fresco (con los
 * claims) y lo intercambia en el endpoint de login del panel por la cookie de
 * sesión HttpOnly. Así se evita la llave `?key=` y el re-login manual.
 * El servidor vuelve a validar el claim y el correo autorizado.
 */
export async function enterPanel(role: Exclude<PanelRole, null>): Promise<void> {
  const user = auth.currentUser
  if (!user) {
    throw new Error('No hay una sesión activa. Inicia sesión de nuevo.')
  }

  const idToken = await user.getIdToken(true)
  const endpoint = role === 'admin' ? '/api/admin/login' : '/api/recepcion/login'

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'No autorizado para acceder a este panel.')
  }

  // Limpiar el histórico de intentos del rate limit (acceso legítimo).
  await clearRateLimit()

  // Navegación completa para que el middleware evalúe la nueva cookie de sesión.
  window.location.href = PANEL_BY_ROLE[role].path
}
