'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { Copy, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { fetchMfaStatus, sendMfaCode, verifyMfaCode, type MfaStatus } from '@/lib/mfa-email-client'

/**
 * Verificación en dos pasos por correo (opcional, cualquier cuenta). Al activarla
 * se muestran una sola vez los códigos de recuperación (si se pierde el correo).
 */
type Step = 'idle' | 'code'

export function TwoFactorSettings() {
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) return setStatus(null)
      fetchMfaStatus().then(setStatus).catch(() => setStatus(null))
    })
  }, [])

  const purpose = status?.enabled ? 'disable' : 'enable'

  const start = async () => {
    setError('')
    setMessage('')
    setBusy(true)
    try {
      const res = await sendMfaCode(purpose)
      setMessage(`Enviamos un código a ${res.email}.`)
      setStep('code')
    } catch (err) {
      const e = err as Error & { status?: number }
      // Código ya enviado hace menos de un minuto: se puede usar ese.
      if (e.status === 429) setStep('code')
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await verifyMfaCode(purpose, code)
      setStep('idle')
      setCode('')
      if (res.recoveryCodes) setRecoveryCodes(res.recoveryCodes)
      setMessage(purpose === 'enable' ? 'Verificación en dos pasos activada.' : 'Verificación en dos pasos desactivada.')
      setStatus(await fetchMfaStatus())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null

  return (
    <div className="mt-10 border-t-4 border-black pt-8">
      <h3 className="font-display italic text-2xl text-secondary uppercase mb-2 flex items-center gap-2">
        <ShieldCheck className="w-6 h-6" /> Verificación en dos pasos
      </h3>
      <p className="font-body text-sm text-gray-600 mb-4">
        {status.enabled
          ? `Activa: cada vez que inicies sesión te enviaremos un código a ${status.email}. Códigos de recuperación disponibles: ${status.recoveryRemaining}.`
          : 'Opcional. Además de tu contraseña, te pediremos un código que llega a tu correo cada vez que inicies sesión.'}
      </p>

      {recoveryCodes && (
        <div className="bg-yellow-50 border-4 border-yellow-500 p-4 mb-4">
          <p className="font-label text-xs font-black uppercase text-yellow-800 mb-2">
            Guarda estos códigos de recuperación: solo se muestran ahora
          </p>
          <p className="font-body text-xs text-yellow-900 mb-3">
            Sirven para entrar si no tienes acceso a tu correo. Cada uno se usa una sola vez.
          </p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm font-bold mb-3">
            {recoveryCodes.map((c) => <li key={c} className="bg-white border-2 border-yellow-400 px-2 py-1 text-center">{c}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(recoveryCodes.join('\n')).then(() => setMessage('Códigos copiados.')).catch(() => {})}
              className="flex items-center gap-2 font-label text-xs font-black uppercase px-4 py-2 border-2 border-black bg-white"
            >
              <Copy className="w-4 h-4" /> Copiar
            </button>
            <button type="button" onClick={() => setRecoveryCodes(null)} className="font-label text-xs font-black uppercase px-4 py-2 border-2 border-black bg-yellow-400">
              Ya los guardé
            </button>
          </div>
        </div>
      )}

      {step === 'idle' ? (
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className={`flex items-center gap-2 font-label text-xs font-black uppercase px-4 py-2 border-2 border-black disabled:opacity-50 ${status.enabled ? 'bg-white' : 'bg-primary text-white'}`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : status.enabled ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          {status.enabled ? 'Desactivar' : 'Activar con mi correo'}
        </button>
      ) : (
        <form onSubmit={confirm} className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            aria-label="Código de verificación"
            className="w-36 text-center font-display text-xl tracking-[6px] border-2 border-secondary px-3 py-2"
          />
          <button type="submit" disabled={busy || code.trim().length !== 6} className="font-label text-xs font-black uppercase px-4 py-2 border-2 border-black bg-primary text-white disabled:opacity-50">
            {busy ? 'Verificando...' : 'Confirmar'}
          </button>
          <button type="button" onClick={() => { setStep('idle'); setCode(''); setError('') }} className="font-label text-xs font-bold uppercase underline text-gray-500">
            Cancelar
          </button>
        </form>
      )}

      {message && <p className="mt-3 font-label text-sm text-gray-600">{message}</p>}
      {error && <p className="mt-3 font-label text-xs font-black text-primary uppercase" role="alert">{error}</p>}
    </div>
  )
}
