'use client'

import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { auth } from '@/lib/firebase'
import {
  fetchMfaStatus,
  redeemRecoveryCode,
  sendMfaCode,
  useMfaGate,
  verifyMfaCode,
} from '@/lib/mfa-email-client'

/**
 * Ventana de verificación en dos pasos (código por correo). Va en el layout raíz:
 * se abre sola cuando hay una sesión sin verificar (p. ej. al recargar la página
 * después de poner la contraseña) o cuando un login llama a `ensureMfaVerified()`.
 * No se puede cerrar sin verificar: la alternativa es cerrar la sesión.
 */
export function MfaGate() {
  const { open, email, show, finish } = useMfaGate()
  const [code, setCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const sentForOpen = useRef(false)

  // Sesión restaurada sin verificar (recarga, otra pestaña): se pide el código.
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (useMfaGate.getState().open) useMfaGate.getState().finish(false)
        return
      }
      try {
        const status = await fetchMfaStatus()
        if (status.enabled && !status.verified) show(status.email)
      } catch {
        // Si no se puede consultar, las APIs y las reglas siguen exigiéndola.
      }
    })
  }, [show])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const requestCode = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await sendMfaCode('login')
      setMessage(`Enviamos un código de 6 dígitos a ${res.email}. Revisa también la carpeta de spam.`)
      setCooldown(60)
    } catch (err) {
      const e = err as Error & { status?: number; secondsLeft?: number }
      if (e.status === 429 && e.secondsLeft) {
        setMessage(`Ya te enviamos un código a ${email}. Revisa tu bandeja (y spam).`)
        setCooldown(e.secondsLeft)
      } else {
        setError(e.message)
      }
    } finally {
      setBusy(false)
    }
  }

  // Un envío automático por cada vez que se abre la ventana.
  useEffect(() => {
    if (!open) {
      sentForOpen.current = false
      setCode('')
      setUseRecovery(false)
      setMessage('')
      setError('')
      return
    }
    if (sentForOpen.current) return
    sentForOpen.current = true
    requestCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setError('')
    setBusy(true)
    try {
      if (useRecovery) await redeemRecoveryCode(code)
      else await verifyMfaCode('login', code)
      finish(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    finish(false)
    await signOut(auth).catch(() => {})
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="mfa-title">
      <form onSubmit={submit} className="w-full max-w-md bg-white border-4 border-black shadow-[8px_8px_0_0_rgba(220,38,38,1)]">
        <div className="bg-zinc-900 p-5 border-b-4 border-black flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-accent shrink-0" />
          <div>
            <h2 id="mfa-title" className="font-display italic text-2xl text-white uppercase leading-none">Verificación en dos pasos</h2>
            <p className="font-label text-[11px] text-white/70 uppercase tracking-wider mt-1">Protege tu cuenta</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="font-body text-sm text-gray-700 flex gap-2">
            {useRecovery ? <KeyRound className="w-5 h-5 shrink-0 text-secondary" /> : <Mail className="w-5 h-5 shrink-0 text-secondary" />}
            <span>
              {useRecovery
                ? 'Ingresa uno de los códigos de recuperación que guardaste al activar la verificación. Cada código sirve una sola vez.'
                : message || 'Enviando el código a tu correo...'}
            </span>
          </p>

          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode={useRecovery ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            maxLength={useRecovery ? 11 : 6}
            placeholder={useRecovery ? 'XXXXX-XXXXX' : '000000'}
            aria-label={useRecovery ? 'Código de recuperación' : 'Código de verificación'}
            className="w-full text-center font-display text-3xl tracking-[8px] border-4 border-secondary px-4 py-3 uppercase focus:outline-none focus:border-primary"
          />

          {error && <p className="font-label text-xs font-black text-primary uppercase" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="w-full flex items-center justify-center gap-2 font-display italic text-xl text-white bg-primary py-3 border-4 border-secondary shadow-comic disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
            VERIFICAR
          </button>

          <div className="flex flex-wrap justify-between gap-2 text-xs font-label font-bold uppercase">
            {!useRecovery && (
              <button type="button" onClick={requestCode} disabled={busy || cooldown > 0} className="text-secondary underline disabled:opacity-50 disabled:no-underline">
                {cooldown > 0 ? `Reenviar en ${cooldown} s` : 'Reenviar código'}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setUseRecovery((v) => !v); setCode(''); setError('') }}
              className="text-secondary underline"
            >
              {useRecovery ? 'Usar código del correo' : 'No tengo acceso al correo'}
            </button>
          </div>

          <button type="button" onClick={cancel} className="w-full font-label text-xs font-bold uppercase text-gray-500 underline">
            Cancelar y cerrar sesión
          </button>
        </div>
      </form>
    </div>
  )
}
