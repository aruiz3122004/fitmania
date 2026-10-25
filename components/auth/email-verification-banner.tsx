'use client'

import { useState } from 'react'
import { sendEmailVerification } from 'firebase/auth'
import { MailWarning } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/app/context/AuthContext'

/**
 * Aviso de correo sin verificar (F1-06). Pagar y publicar en el foro exigen
 * `email_verified`. "Ya lo verifiqué" recarga el usuario y fuerza un ID token
 * nuevo para que el servidor y las reglas vean el cambio sin cerrar sesión.
 */
export function EmailVerificationBanner() {
  const { user } = useAuth()
  const [verified, setVerified] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (!user || user.emailVerified || verified) return null

  const resend = async () => {
    setBusy(true)
    setMessage('')
    try {
      await sendEmailVerification(user)
      setMessage('Te enviamos un enlace de verificación. Revisa tu bandeja (y spam).')
    } catch (err: any) {
      setMessage(
        err?.code === 'auth/too-many-requests'
          ? 'Ya enviamos un enlace hace poco. Espera unos minutos e intenta de nuevo.'
          : 'No se pudo enviar el correo. Intenta más tarde.'
      )
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => {
    setBusy(true)
    setMessage('')
    try {
      await user.reload()
      if (auth.currentUser?.emailVerified) {
        await auth.currentUser.getIdToken(true)
        setVerified(true)
      } else {
        setMessage('Aún no aparece verificado. Abre el enlace del correo y vuelve a intentar.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="status" className="mb-6 border-4 border-yellow-500 bg-yellow-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <MailWarning className="w-6 h-6 text-yellow-600 shrink-0" />
      <div className="flex-1">
        <p className="font-label text-sm font-black text-yellow-800 uppercase">Verifica tu correo</p>
        <p className="font-body text-xs text-yellow-800">
          Necesitas verificar {user.email} para pagar planes y publicar en el foro.
        </p>
        {message && <p className="font-body text-xs text-yellow-900 mt-1 font-bold">{message}</p>}
      </div>
      <div className="flex gap-2">
        <button
          onClick={resend}
          disabled={busy}
          className="font-label text-[11px] font-black uppercase bg-black text-white px-3 py-2 border-2 border-black disabled:opacity-50"
        >
          Reenviar correo
        </button>
        <button
          onClick={refresh}
          disabled={busy}
          className="font-label text-[11px] font-black uppercase bg-white text-black px-3 py-2 border-2 border-black disabled:opacity-50"
        >
          Ya lo verifiqué
        </button>
      </div>
    </div>
  )
}
