'use client'

import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import { QrCode, WifiOff } from 'lucide-react'
import { auth } from '@/lib/firebase'

/**
 * Pase de acceso del socio (F2-05 / F2-06).
 * - Con red: QR firmado de 5 minutos que se renueva solo cada 4 minutos (una captura
 *   compartida deja de servir rápido).
 * - Sin red: muestra el pase de 24 h guardado en el dispositivo.
 * - Si el servidor aún no tiene claves configuradas: QR con el UID (comportamiento anterior).
 */
const DAY_KEY = 'fitmania_access_pass_day'
const REFRESH_MS = 4 * 60 * 1000

interface StoredPass { uid: string; token: string; expiresAt: number }

function readStored(uid: string): StoredPass | null {
  try {
    const raw = localStorage.getItem(DAY_KEY)
    const pass = raw ? (JSON.parse(raw) as StoredPass) : null
    return pass && pass.uid === uid && pass.expiresAt > Date.now() ? pass : null
  } catch {
    return null
  }
}

export function AccessPass({ uid }: { uid: string | undefined }) {
  const [code, setCode] = useState<string | null>(null)
  const [mode, setMode] = useState<'live' | 'offline' | 'legacy' | 'loading'>('loading')
  const [validUntil, setValidUntil] = useState<number | null>(null)

  useEffect(() => {
    if (!uid) return
    let cancelled = false

    const fetchPass = async (ttl: 'short' | 'day') => {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('sin sesión')
      const res = await fetch(`/api/me/access-token?ttl=${ttl}`, { headers: { Authorization: `Bearer ${idToken}` } })
      if (!res.ok) throw new Error('pase')
      return res.json() as Promise<{ enabled: boolean; token?: string; expiresAt?: number }>
    }

    const refresh = async () => {
      try {
        const live = await fetchPass('short')
        if (cancelled) return
        if (!live.enabled || !live.token) {
          setCode(uid)
          setMode('legacy')
          return
        }
        setCode(live.token)
        setValidUntil(live.expiresAt ?? null)
        setMode('live')
        // Respaldo de 24 h para mostrar sin conexión (se renueva si le quedan < 12 h).
        const stored = readStored(uid)
        if (!stored || stored.expiresAt - Date.now() < 12 * 60 * 60 * 1000) {
          const day = await fetchPass('day')
          if (day.token && day.expiresAt) {
            localStorage.setItem(DAY_KEY, JSON.stringify({ uid, token: day.token, expiresAt: day.expiresAt }))
          }
        }
      } catch {
        if (cancelled) return
        const stored = readStored(uid)
        if (stored) {
          setCode(stored.token)
          setValidUntil(stored.expiresAt)
          setMode('offline')
        } else {
          setCode(uid)
          setMode('legacy')
        }
      }
    }

    const unsub = auth.onAuthStateChanged((u) => { if (u) refresh() })
    const timer = setInterval(refresh, REFRESH_MS)
    window.addEventListener('online', refresh)
    return () => {
      cancelled = true
      unsub()
      clearInterval(timer)
      window.removeEventListener('online', refresh)
    }
  }, [uid])

  return (
    <div className="shrink-0 p-4 bg-white border-4 border-black rounded-3xl shadow-[6px_6px_0_0_rgba(22,163,74,1)] flex flex-col items-center">
      {code ? <QRCode value={code} size={mode === 'legacy' ? 100 : 140} /> : <div className="w-[100px] h-[100px] bg-zinc-100 animate-pulse" />}
      <div className="mt-2 flex items-center gap-1">
        {mode === 'offline' ? <WifiOff className="w-3 h-3 text-yellow-600" /> : <QrCode className="w-3 h-3 text-green-600" />}
        <span className="text-[9px] font-black text-black uppercase tracking-widest">Access Pass</span>
      </div>
      {mode === 'live' && <span className="text-[8px] font-bold text-zinc-500 uppercase">Se renueva automáticamente</span>}
      {mode === 'offline' && validUntil && (
        <span className="text-[8px] font-bold text-yellow-700 uppercase text-center">
          Sin conexión · válido hasta {new Date(validUntil).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  )
}
