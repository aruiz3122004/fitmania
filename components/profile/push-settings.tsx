'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { auth, firebaseApp } from '@/lib/firebase'

/**
 * Notificaciones push del socio (F3-13 / F3-15): activar en este dispositivo y
 * elegir qué recibir. En iPhone solo funcionan con la app instalada en la pantalla
 * de inicio (iOS 16.4+).
 */
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
type Prefs = { entries: boolean; news: boolean; reminders: boolean }

const LABELS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: 'entries', label: 'Ingresos registrados', hint: 'Te avisa cada vez que se registra tu ingreso (útil si alguien usa tu pase).' },
  { key: 'reminders', label: 'Vencimiento de mi plan', hint: '5 días y 1 día antes de que venza.' },
  { key: 'news', label: 'Noticias del gimnasio', hint: 'Solo en horario permitido (L–V 7–19 h, sáb 8–15 h).' },
]

function isIos() {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isStandalone() {
  return typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
}

export function PushSettings() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [token, setToken] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const authed = async (input: string, init: RequestInit = {}) => {
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) throw new Error('Tu sesión expiró.')
    return fetch(input, { ...init, headers: { ...(init.headers || {}), 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` } })
  }

  useEffect(() => {
    const ok = !!VAPID_KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(ok)
    if ('Notification' in window) setPermission(Notification.permission)
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return
      try {
        const saved = localStorage.getItem('fitmania_push_token')
        const res = await authed(`/api/me/push${saved ? `?token=${encodeURIComponent(saved)}` : ''}`)
        if (res.ok) {
          const data = await res.json()
          setPrefs(data.prefs)
          if (saved && data.registered) setToken(saved)
        }
      } catch {
        // Sin preferencias visibles si falla.
      }
    })
    return () => unsub()
  }, [])

  const enable = async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') throw new Error('Permiso denegado. Puedes activarlo desde la configuración del navegador.')
      const { getMessaging, getToken } = await import('firebase/messaging')
      const registration = await navigator.serviceWorker.ready
      const fcmToken = await getToken(getMessaging(firebaseApp), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
      if (!fcmToken) throw new Error('No se pudo obtener el identificador del dispositivo.')
      const res = await authed('/api/me/push', { method: 'POST', body: JSON.stringify({ token: fcmToken }) })
      if (!res.ok) throw new Error('No se pudo registrar el dispositivo.')
      localStorage.setItem('fitmania_push_token', fcmToken)
      setToken(fcmToken)
      setPrefs((await res.json()).prefs)
      setMessage('Notificaciones activadas en este dispositivo.')
    } catch (err: any) {
      setMessage(err?.message || 'No se pudieron activar las notificaciones.')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    if (!token) return
    setBusy(true)
    try {
      await authed('/api/me/push', { method: 'DELETE', body: JSON.stringify({ token }) })
      localStorage.removeItem('fitmania_push_token')
      setToken(null)
      setMessage('Notificaciones desactivadas en este dispositivo.')
    } finally {
      setBusy(false)
    }
  }

  const togglePref = async (key: keyof Prefs) => {
    if (!prefs) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    const res = await authed('/api/me/push', { method: 'PATCH', body: JSON.stringify({ prefs: { [key]: next[key] } }) }).catch(() => null)
    if (!res?.ok) setPrefs(prefs)
  }

  return (
    <div className="mt-10 border-t-4 border-black pt-8">
      <h3 className="font-display italic text-2xl text-secondary uppercase mb-4 flex items-center gap-2">
        <Bell className="w-6 h-6" /> Notificaciones
      </h3>

      {!supported ? (
        <p className="font-body text-sm text-gray-600">
          {isIos() && !isStandalone()
            ? 'En iPhone, instala la app primero: toca Compartir → "Agregar a inicio", ábrela desde el ícono y vuelve aquí.'
            : !VAPID_KEY
              ? 'Las notificaciones aún no están configuradas en el servidor.'
              : 'Este navegador no admite notificaciones push.'}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {token ? (
              <button onClick={disable} disabled={busy} className="flex items-center gap-2 font-label text-xs font-black uppercase px-4 py-2 border-2 border-black bg-white disabled:opacity-50">
                <BellOff className="w-4 h-4" /> Desactivar en este dispositivo
              </button>
            ) : (
              <button onClick={enable} disabled={busy || permission === 'denied'} className="flex items-center gap-2 font-label text-xs font-black uppercase px-4 py-2 border-2 border-black bg-primary text-white disabled:opacity-50">
                <Bell className="w-4 h-4" /> Activar notificaciones
              </button>
            )}
            {permission === 'denied' && <span className="text-xs font-bold text-red-600">Bloqueadas en el navegador.</span>}
          </div>
          {prefs && (
            <div className="space-y-2">
              {LABELS.map(({ key, label, hint }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={prefs[key]} onChange={() => togglePref(key)} className="mt-1 w-4 h-4 accent-primary" />
                  <span className="font-body text-sm text-gray-700"><strong>{label}.</strong> {hint}</span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
      {message && <p className="mt-3 font-body text-sm font-bold text-gray-700">{message}</p>}
    </div>
  )
}
