'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, ShieldCheck, Trash2 } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/lib/store'

/**
 * Derechos del titular en autoservicio (F3-10 / F3-11): autorización de datos
 * sensibles, descarga de datos y supresión de la cuenta.
 */
export function PrivacySection({ onSensitiveChange }: { onSensitiveChange?: (granted: boolean) => void }) {
  const { logout } = useAuthStore()
  const [sensitive, setSensitive] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  const authed = async (input: string, init: RequestInit = {}) => {
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')
    return fetch(input, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${idToken}` } })
  }

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return
      try {
        const res = await authed('/api/me/consents')
        if (res.ok) {
          const data = await res.json()
          setSensitive(!!data.sensitiveConsent)
          onSensitiveChange?.(!!data.sensitiveConsent)
        }
      } catch {
        // Sin estado: el control queda deshabilitado.
      }
    })
    return () => unsub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSensitive = async () => {
    if (sensitive === null) return
    const next = !sensitive
    if (!next && !confirm('Al revocar la autorización se borrarán tu peso y altura guardados. ¿Continuar?')) return
    setBusy(true)
    setMessage('')
    try {
      const res = await authed('/api/me/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensitiveConsent: next }),
      })
      if (!res.ok) throw new Error('No se pudo actualizar la autorización.')
      setSensitive(next)
      onSensitiveChange?.(next)
      setMessage(next ? 'Autorización otorgada.' : 'Autorización revocada y datos de salud eliminados.')
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  const downloadData = async () => {
    setBusy(true)
    setMessage('')
    try {
      const res = await authed('/api/me')
      if (!res.ok) throw new Error('No se pudieron descargar tus datos.')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mis-datos-fitmania.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  const deleteAccount = async () => {
    setBusy(true)
    setMessage('')
    try {
      const res = await authed('/api/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar la cuenta.')
      await signOut(auth).catch(() => {})
      logout()
      window.location.href = '/'
    } catch (err: any) {
      setMessage(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="mt-10 border-t-4 border-black pt-8">
      <h3 className="font-display italic text-2xl text-secondary uppercase mb-4 flex items-center gap-2">
        <ShieldCheck className="w-6 h-6" /> Privacidad y datos
      </h3>

      <label className="flex items-start gap-3 mb-4 cursor-pointer">
        <input type="checkbox" checked={!!sensitive} disabled={sensitive === null || busy} onChange={toggleSensitive} className="mt-1 w-4 h-4 accent-primary" />
        <span className="font-body text-sm text-gray-700">
          Autorizo el tratamiento de mi <strong>peso y altura</strong> (datos sensibles). Si la revoco, se eliminan.
        </span>
      </label>

      <div className="flex flex-wrap gap-3 mb-4">
        <button onClick={downloadData} disabled={busy} className="flex items-center gap-2 font-label text-xs font-black uppercase px-4 py-2 border-2 border-black bg-white hover:bg-gray-100 disabled:opacity-50">
          <Download className="w-4 h-4" /> Descargar mis datos
        </button>
        <button onClick={() => setShowDelete(!showDelete)} disabled={busy} className="flex items-center gap-2 font-label text-xs font-black uppercase px-4 py-2 border-2 border-red-600 text-red-600 bg-white hover:bg-red-50 disabled:opacity-50">
          <Trash2 className="w-4 h-4" /> Eliminar mi cuenta
        </button>
      </div>

      {showDelete && (
        <div className="border-2 border-red-600 bg-red-50 p-4 mb-4">
          <p className="font-body text-sm text-red-800 mb-2">
            Se eliminarán tu perfil, tus publicaciones y comentarios. Tus ingresos y PQRS se conservan sin tu nombre ni
            correo, y las compras se guardan por obligación contable. <strong>No se puede deshacer</strong> y perderás tu plan vigente.
          </p>
          <div className="flex flex-wrap gap-2">
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Escribe ELIMINAR" className="border-2 border-black px-3 py-2 font-bold text-sm" />
            <button onClick={deleteAccount} disabled={busy || confirmText !== 'ELIMINAR'} className="font-label text-xs font-black uppercase px-4 py-2 bg-red-600 text-white border-2 border-black disabled:opacity-50">
              Confirmar eliminación
            </button>
          </div>
        </div>
      )}

      {message && <p className="font-body text-sm font-bold text-gray-700 mb-2">{message}</p>}
      <p className="font-body text-xs text-gray-500">
        Más información en la <Link href="/legal/privacidad" className="underline">política de tratamiento de datos</Link>. Para
        otras solicitudes usa <Link href="/pqrs" className="underline">PQRS</Link> (tipo &quot;Datos personales&quot;).
      </p>
    </div>
  )
}
