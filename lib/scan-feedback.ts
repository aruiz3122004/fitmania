'use client'

import { useEffect, useRef } from 'react'

/**
 * Señales del escaneo en recepción (F2-04).
 * - beep(): tono agudo corto si el plan está vigente; dos tonos graves si no.
 * - useHidScanner(): lectores QR/barras USB que "escriben" el código como teclado y
 *   terminan con Enter. Se distinguen de una persona por la velocidad de tecleo.
 */
let audioCtx: AudioContext | null = null

export function beep(ok: boolean) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)()
    const tones = ok ? [{ f: 1046, t: 0 }] : [{ f: 220, t: 0 }, { f: 196, t: 0.22 }]
    for (const { f, t } of tones) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = ok ? 'sine' : 'square'
      osc.frequency.value = f
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.18)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(audioCtx.currentTime + t)
      osc.stop(audioCtx.currentTime + t + 0.2)
    }
  } catch {
    // Sin audio disponible: la señal visual es suficiente.
  }
}

/** Días completos que faltan para `expiraSeconds` (negativo si ya venció). */
export function daysLeft(expiraSeconds: number | undefined | null): number | null {
  if (!expiraSeconds) return null
  return Math.ceil((expiraSeconds * 1000 - Date.now()) / 86_400_000)
}

export function useHidScanner(enabled: boolean, onCode: (code: string) => void) {
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  useEffect(() => {
    if (!enabled) return
    let buffer = ''
    let last = 0
    const MAX_GAP_MS = 50 // un lector teclea mucho más rápido que una persona

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      // No interferir con la escritura en campos de texto.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const now = Date.now()
      if (now - last > MAX_GAP_MS) buffer = ''
      last = now
      if (e.key === 'Enter') {
        if (buffer.length >= 6) onCodeRef.current(buffer)
        buffer = ''
        return
      }
      if (e.key.length === 1) buffer += e.key
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
