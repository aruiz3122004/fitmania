'use client'

import { useEffect, useState } from 'react'

/**
 * Registra el service worker desde el bundle de la app (F2-09).
 *
 * Antes se registraba con un `<script>` inline escrito a mano en el layout. Next.js
 * solo aplica el nonce de la CSP a sus propios scripts, así que en producción
 * (`'strict-dynamic'`, sin `'unsafe-inline'`) ese script quedaba bloqueado y el SW
 * nunca se registraba.
 *
 * Cuando hay una versión nueva se muestra un aviso: activarla recarga la página, así
 * que se deja decidir al usuario (no se interrumpe un pago o un escaneo en curso).
 */
export function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let reloading = false
    // En la primera visita no hay controlador: el SW nuevo toma control con
    // `clients.claim()` y dispara `controllerchange`, pero no hay versión vieja que
    // reemplazar. Recargar ahí duplicaba la carga de cada página.
    const hadController = !!navigator.serviceWorker.controller

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting)
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) setWaiting(installing)
          })
        })
      })
      .catch((err) => console.error('No se pudo registrar el service worker:', err))

    const onControllerChange = () => {
      if (reloading || !hadController) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [])

  if (!waiting) return null

  return (
    <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-black text-white border-2 border-white px-4 py-3 shadow-[4px_4px_0_0_rgba(220,38,38,1)]">
      <span className="font-label text-xs font-bold uppercase">Nueva versión disponible</span>
      <button
        onClick={() => waiting.postMessage('SKIP_WAITING')}
        className="font-label text-xs font-black uppercase bg-red-600 px-3 py-1 border-2 border-white"
      >
        Actualizar
      </button>
      <button onClick={() => setWaiting(null)} className="font-label text-xs uppercase underline">Después</button>
    </div>
  )
}
