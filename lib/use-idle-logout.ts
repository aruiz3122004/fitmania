'use client'

import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'visibilitychange'] as const

/**
 * Ejecuta `onIdle` tras `timeoutMs` sin actividad del usuario (F1-15).
 * Se usa en el panel de recepción: la sesión dura un turno (12 h), así que el
 * cierre por inactividad evita que un equipo desatendido quede abierto.
 */
export function useIdleLogout(enabled: boolean, timeoutMs: number, onIdle: () => void) {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout>

    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => onIdleRef.current(), timeoutMs)
    }

    reset()
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset, { passive: true }))
    return () => {
      clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset))
    }
  }, [enabled, timeoutMs])
}
