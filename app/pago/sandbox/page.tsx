'use client'

import { Suspense, useEffect, useState } from 'react'
import { notFound, useSearchParams } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { Building2, CreditCard, FlaskConical, Loader2, Receipt, XCircle } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { IS_SANDBOX } from '@/lib/sandbox'
import { ComicLoader } from '@/components/ui/comic-loader'

/**
 * Pasarela simulada del modo sandbox (reemplaza a Checkout Pro de Mercado Pago). El
 * pago se aplica en el servidor con la misma función que un pago real.
 */
type Method = 'visa' | 'pse' | 'efecty'

const METHODS: { id: Method; label: string; detail: string; icon: typeof CreditCard }[] = [
  { id: 'visa', label: 'Tarjeta de prueba', detail: 'VISA •••• 4242 · 12/30', icon: CreditCard },
  { id: 'pse', label: 'PSE', detail: 'Banco de prueba', icon: Building2 },
  { id: 'efecty', label: 'Efecty', detail: 'Pago en efectivo aprobado al instante', icon: Receipt },
]

const cop = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

function Gateway() {
  const ref = useSearchParams().get('ref') || ''
  const [payment, setPayment] = useState<{ concept: string; amount: number; status: string } | null>(null)
  const [method, setMethod] = useState<Method>('visa')
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return
      const res = await fetch(`/api/payments/status?ref=${encodeURIComponent(ref)}`, {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || 'No encontramos este pago.')
      else setPayment(data)
    })
  }, [ref])

  const pay = async (outcome: 'approved' | 'rejected') => {
    setError('')
    setBusy(outcome)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/sandbox/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ ref, outcome, method }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo procesar el pago.')
      window.location.assign(data.redirect)
    } catch (err: any) {
      setError(err?.message || 'No se pudo procesar el pago.')
      setBusy(null)
    }
  }

  if (!payment && !error) return <ComicLoader label="Abriendo la pasarela" />

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div aria-hidden className="h-2 bg-[repeating-linear-gradient(45deg,#facc15_0_10px,#1e293b_10px_20px)]" />
        <header className="px-6 pt-5 pb-4 border-b border-slate-200">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-lime-700 bg-lime-100 px-2 py-0.5 rounded">
            <FlaskConical className="w-3.5 h-3.5" aria-hidden /> Pasarela simulada · Sandbox
          </p>
          <h1 className="mt-3 text-lg font-semibold text-slate-900">Pagar a FITMANIA</h1>
          {payment && (
            <>
              <p className="text-sm text-slate-500 truncate">{payment.concept}</p>
              <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{cop(payment.amount)}</p>
            </>
          )}
        </header>

        {payment && payment.status === 'pending' ? (
          <div className="px-6 py-5">
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Medio de pago</legend>
              <div className="flex flex-col gap-2">
                {METHODS.map(({ id, label, detail, icon: Icon }) => (
                  <label key={id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${method === id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="method" value={id} checked={method === id} onChange={() => setMethod(id)} className="accent-sky-600" />
                    <Icon className="w-5 h-5 text-slate-600" aria-hidden />
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-slate-900">{label}</span>
                      <span className="block text-xs text-slate-500">{detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={() => pay('approved')}
              disabled={!!busy}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-white font-semibold hover:bg-sky-700 disabled:opacity-60"
            >
              {busy === 'approved' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              Pagar {cop(payment.amount)}
            </button>
            <button
              type="button"
              onClick={() => pay('rejected')}
              disabled={!!busy}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {busy === 'rejected' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <XCircle className="w-4 h-4" aria-hidden />}
              Simular pago rechazado
            </button>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              No se cobra nada. El pago se aplica con la misma lógica que uno real de Mercado Pago:
              activa el plan o descuenta el stock, crea la orden y envía el recibo a tu buzón del sandbox.
            </p>
          </div>
        ) : payment ? (
          <p className="px-6 py-5 text-sm text-slate-600">Este pago ya se procesó.</p>
        ) : null}

        {error && <p role="alert" className="px-6 pb-5 text-sm font-medium text-red-600">{error}</p>}
      </div>
    </main>
  )
}

export default function SandboxGatewayPage() {
  if (!IS_SANDBOX) notFound()
  return (
    <Suspense fallback={<ComicLoader label="Abriendo la pasarela" />}>
      <Gateway />
    </Suspense>
  )
}
