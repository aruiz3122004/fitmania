'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
export const dynamic = 'force-dynamic'

import { Topbar } from '@/components/layout/topbar'
import { ComicLoader } from '@/components/ui/comic-loader'
import { Footer } from '@/components/layout/footer'
import { useAuthStore, useCartStore } from '@/lib/store'
import { auth, db } from '@/lib/firebase'
import { ShieldCheck, Loader2, AlertTriangle } from 'lucide-react'
import { EmailVerificationBanner } from '@/components/auth/email-verification-banner'
import { IS_SANDBOX } from '@/lib/sandbox'

/**
 * F1-18: pago con Mercado Pago (Checkout Pro: tarjeta, PSE, Efecty). El servidor
 * calcula el monto y devuelve la URL del checkout; el resultado se confirma por
 * webhook y al volver a /pago/resultado.
 */
function MercadoPagoCheckout({ planId, cartItems }: { planId?: string; cartItems: any[] }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePagar = async () => {
    setError('')
    setLoading(true)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión para pagar.')

      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          planId,
          items: !planId && cartItems.length > 0
            ? cartItems.map((item) => ({ id: item.id, cantidad: item.cantidad }))
            : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error || 'No se pudo iniciar el pago.')

      // Se sale del sitio hacia Mercado Pago; `loading` queda activo hasta la navegación.
      window.location.assign(data.url)
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar el pago.')
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="bg-red-light border-3 border-primary p-4 mb-4 flex items-center gap-4">
          <AlertTriangle className="w-6 h-6 text-primary shrink-0" />
          <p className="font-label text-[11px] font-black text-primary uppercase leading-tight tracking-wider">{error}</p>
        </div>
      )}
      <button
        onClick={handlePagar}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 font-display italic text-2xl tracking-[2px] text-white bg-primary py-5 border-4 border-secondary shadow-comic transition-all hover:bg-red-dark hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0_var(--navy)] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
      >
        {loading
          ? <><Loader2 className="w-8 h-8 animate-spin" />REDIRIGIENDO...</>
          : <><ShieldCheck className="w-8 h-8" />{IS_SANDBOX ? 'PAGAR (PASARELA SIMULADA)' : 'PAGAR CON MERCADO PAGO'}</>
        }
      </button>
      <p className="font-label text-[10px] text-gray-400 mt-3 font-bold uppercase tracking-widest text-center">
        {IS_SANDBOX ? 'Modo sandbox: no se cobra nada' : 'Tarjeta débito o crédito · PSE · Efecty'}
      </p>
    </div>
  )
}

function PagoContent() {
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuthStore()
  const { items } = useCartStore()
  const [planData, setPlanData] = useState<{name: string, price: number} | null>(null)
  const [loading, setLoading] = useState(true)

  const planId = searchParams.get('planId')

  useEffect(() => {
    async function loadPlan() {
      if (planId) {
        try {
          const { doc, getDoc } = await import('firebase/firestore')
          const planDoc = await getDoc(doc(db, 'planes', planId))
          if (planDoc.exists()) {
            const data = planDoc.data()
            setPlanData({ name: data.name, price: data.price })
          }
        } catch (err) {
          console.error("Error cargando plan:", err)
        }
      } else if (items.length > 0) {
        const total = items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0)
        setPlanData({ name: "Compra de Productos", price: total })
      }
      setLoading(false)
    }
    loadPlan()
  }, [planId, items])

  const montoFormateado = new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(planData?.price || 0)

  if (!isAuthenticated) {
    return (
      <main>
        <Topbar />
        <section className="mt-[72px] min-h-screen bg-muted flex items-center justify-center py-16">
          <div className="bg-white border-3 border-secondary shadow-comic p-8 text-center max-w-sm">
            <p className="font-body text-gray-600 mb-4 font-bold">Debes iniciar sesión para realizar un pago seguro.</p>
            <a href="/login" className="inline-block font-label font-bold text-sm text-white bg-primary px-8 py-4 border-4 border-secondary shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 transition-all">
              INICIAR SESIÓN
            </a>
          </div>
        </section>
        <Footer />
      </main>
    )
  }

  if (loading) {
     return (
       <main>
         <Topbar />
         <ComicLoader label="Preparando tu pago" belowTopbar />
       </main>
     )
  }

  return (
    <main>
      <Topbar />
      <section className="mt-[72px] min-h-screen bg-muted py-16">
        <div className="max-w-[520px] mx-auto px-6">
          <div className="text-center mb-8">
            <span className="inline-block font-label font-bold text-[10px] text-navy bg-accent px-4 py-1.5 tracking-[4px] uppercase border-4 border-navy mb-4 shadow-comic-sm">
              PROTECTED CHECKOUT
            </span>
            <h1 className="font-display text-4xl text-secondary tracking-[2px] uppercase italic">
              FINALIZAR <span className="text-primary">PAGO</span>
            </h1>
          </div>
          {/* F1-06: pagar exige correo verificado; el aviso permite reenviar el enlace aquí mismo. */}
          <EmailVerificationBanner />
          <div className="bg-white border-4 border-secondary shadow-[12px_12px_0_0_var(--red-primary)] p-8 mb-8">
            <div className="bg-secondary text-white border-3 border-secondary p-5 mb-6 shadow-comic-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-label text-xs text-white/60 uppercase tracking-wider mb-1">Concepto</p>
                  <p className="font-label font-bold text-base">{planData?.name || ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-label text-xs text-white/60 uppercase tracking-wider mb-1">Total</p>
                  <p className="font-display text-2xl text-accent">{montoFormateado}</p>
                </div>
              </div>
            </div>
            <MercadoPagoCheckout planId={planId || undefined} cartItems={items} />
          </div>

        </div>
      </section>
      <Footer />
    </main>
  )
}

export default function PagoPage() {
  return (
    <Suspense fallback={
       <div className="min-h-screen bg-[#F0F0F0] flex items-center justify-center">
         <div className="flex flex-col items-center">
           <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
           <p className="font-display text-xl text-gray-500 uppercase tracking-widest italic animate-pulse">Protegiendo tu sesión...</p>
         </div>
       </div>
    }>
      <PagoContent />
    </Suspense>
  )
}

