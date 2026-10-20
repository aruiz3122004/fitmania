'use client'

import { useEffect } from 'react'

/**
 * Registra el service worker desde el bundle de la app (F2-09).
 *
 * Antes se registraba con un `<script>` inline escrito a mano en el layout. Next.js
 * solo aplica el nonce de la CSP a sus propios scripts, así que en producción
 * (`'strict-dynamic'`, sin `'unsafe-inline'`) ese script quedaba bloqueado y el SW
 * nunca se registraba.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('No se pudo registrar el service worker:', err)
    })
  }, [])

  return null
}
