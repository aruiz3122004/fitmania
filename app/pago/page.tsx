// 'use client'
 
// import { useState } from 'react'
// import { useRouter, useSearchParams } from 'next/navigation'
// import { Topbar } from '@/components/layout/topbar'
// import { Footer } from '@/components/layout/footer'
// import { useAuthStore } from '@/lib/store'
// import { ShieldCheck, CreditCard, Building2, ChevronDown, Loader2 } from 'lucide-react'
 
// // Bancos disponibles en PSE Colombia
// const BANCOS_PSE = [
//   { codigo: '1007', nombre: 'Bancolombia' },
//   { codigo: '1051', nombre: 'Davivienda' },
//   { codigo: '1013', nombre: 'BBVA Colombia' },
//   { codigo: '1006', nombre: 'Banco de Bogotá' },
//   { codigo: '1002', nombre: 'Banco Popular' },
//   { codigo: '1032', nombre: 'Banco Caja Social' },
//   { codigo: '1019', nombre: 'Scotiabank Colpatria' },
//   { codigo: '1023', nombre: 'Banco de Occidente' },
//   { codigo: '1040', nombre: 'Banco Agrario' },
//   { codigo: '1009', nombre: 'Citibank Colombia' },
//   { codigo: '1062', nombre: 'Banco Falabella' },
//   { codigo: '1069', nombre: 'Banco Finandina' },
//   { codigo: '1058', nombre: 'Banco Procredit' },
//   { codigo: '1060', nombre: 'Banco Pichincha' },
//   { codigo: '1303', nombre: 'Nequi' },
// ]
 
// type TipoCuenta = 'ahorros' | 'corriente'
// type TipoPersona = 'natural' | 'juridica'
 
// export default function PagoPage() {
//   const { user, isAuthenticated } = useAuthStore()
//   const router = useRouter()
//   const searchParams = useSearchParams()
 
//   // Leer parámetros de la URL: /pago?concepto=Plan+Pro&monto=150000
//   const conceptoParam = searchParams.get('concepto') || 'Servicio Fitmania'
//   const montoParam = Number(searchParams.get('monto')) || 0
 
//   const [banco, setBanco] = useState('')
//   const [tipoCuenta, setTipoCuenta] = useState<TipoCuenta>('ahorros')
//   const [tipoPersona, setTipoPersona] = useState<TipoPersona>('natural')
//   const [nombre, setNombre] = useState(user?.username || '')
//   const [email, setEmail] = useState(user?.email || '')
//   const [cedula, setCedula] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState('')
 
//   const montoFormateado = new Intl.NumberFormat('es-CO', {
//     style: 'currency',
//     currency: 'COP',
//     minimumFractionDigits: 0,
//   }).format(montoParam)
 
//   const handlePagar = async () => {
//     setError('')
 
//     if (!banco) return setError('Por favor selecciona un banco.')
//     if (!nombre.trim()) return setError('Por favor ingresa tu nombre completo.')
//     if (!email.trim()) return setError('Por favor ingresa tu correo electrónico.')
//     if (!cedula.trim()) return setError('Por favor ingresa tu número de documento.')
//     if (montoParam <= 0) return setError('El monto del pago no es válido.')
 
//     setLoading(true)
 
//     try {
//       const res = await fetch('/api/stripe/create-payment', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           amount: montoParam,
//           currency: 'cop',
//           concept: conceptoParam,
//           customerEmail: email,
//           customerName: nombre,
//           bank: banco,
//         }),
//       })
 
//       const data = await res.json()
 
//       if (!res.ok) {
//         throw new Error(data.error || 'Error al procesar el pago')
//       }
 
//       // Redirigir al banco
//       if (data.redirectUrl) {
//         window.location.href = data.redirectUrl
//       }
//     } catch (err: any) {
//       setError(err.message || 'Ocurrió un error inesperado. Intenta nuevamente.')
//       setLoading(false)
//     }
//   }
 
//   if (!isAuthenticated) {
//     return (
//       <main>
//         <Topbar />
//         <section className="mt-[72px] min-h-screen bg-muted flex items-center justify-center py-16">
//           <div className="bg-white border-3 border-secondary shadow-comic p-8 text-center max-w-sm">
//             <p className="font-body text-gray-600 mb-4">Debes iniciar sesión para realizar un pago.</p>
//             <a
//               href="/login"
//               className="inline-block font-label font-bold text-sm text-white bg-primary px-6 py-3 border-2 border-secondary shadow-comic-sm hover:bg-red-dark transition-all"
//             >
//               INICIAR SESIÓN
//             </a>
//           </div>
//         </section>
//         <Footer />
//       </main>
//     )
//   }
 
//   return (
//     <main>
//       <Topbar />
 
//       <section className="mt-[72px] min-h-screen bg-muted py-16">
//         <div className="max-w-[560px] mx-auto px-6">
 
//           {/* Encabezado */}
//           <div className="text-center mb-8">
//             <span className="inline-block font-label font-bold text-xs text-navy bg-accent px-3 py-1 tracking-wider uppercase border-2 border-navy mb-3">
//               PAGO SEGURO
//             </span>
//             <h1 className="font-display text-3xl text-secondary tracking-wider">
//               PAGAR CON <span className="text-primary">PSE</span>
//             </h1>
//             <p className="font-body text-gray-500 text-sm mt-2">
//               Serás redirigido al portal de tu banco para completar el pago.
//             </p>
//           </div>
 
//           {/* Resumen del pago */}
//           <div className="bg-secondary text-white border-3 border-secondary shadow-comic p-5 mb-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="font-label text-xs text-white/60 uppercase tracking-wider mb-1">Concepto</p>
//                 <p className="font-label font-bold text-base">{conceptoParam}</p>
//               </div>
//               <div className="text-right">
//                 <p className="font-label text-xs text-white/60 uppercase tracking-wider mb-1">Total</p>
//                 <p className="font-display text-2xl text-accent">{montoFormateado}</p>
//               </div>
//             </div>
//           </div>
 
//           {/* Formulario */}
//           <div className="bg-white border-3 border-secondary shadow-comic p-6">
 
//             {/* Selector de banco */}
//             <div className="mb-5">
//               <label className="flex items-center gap-2 font-label font-bold text-xs text-secondary uppercase tracking-wider mb-2">
//                 <Building2 className="w-4 h-4" />
//                 Banco
//               </label>
//               <div className="relative">
//                 <select
//                   value={banco}
//                   onChange={(e) => setBanco(e.target.value)}
//                   className="w-full font-body text-gray-700 px-4 py-3 border-2 border-gray-200 focus:border-primary outline-none appearance-none bg-white pr-10"
//                 >
//                   <option value="">— Selecciona tu banco —</option>
//                   {BANCOS_PSE.map((b) => (
//                     <option key={b.codigo} value={b.codigo}>
//                       {b.nombre}
//                     </option>
//                   ))}
//                 </select>
//                 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
//               </div>
//             </div>
 
//             {/* Tipo de persona */}
//             <div className="mb-5">
//               <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider mb-2 block">
//                 Tipo de persona
//               </label>
//               <div className="flex gap-3">
//                 {(['natural', 'juridica'] as TipoPersona[]).map((tipo) => (
//                   <button
//                     key={tipo}
//                     type="button"
//                     onClick={() => setTipoPersona(tipo)}
//                     className={`flex-1 py-2 font-label text-sm border-2 transition-all ${
//                       tipoPersona === tipo
//                         ? 'bg-primary text-white border-secondary'
//                         : 'bg-white text-gray-500 border-gray-200 hover:border-primary'
//                     }`}
//                   >
//                     {tipo === 'natural' ? 'Natural' : 'Jurídica'}
//                   </button>
//                 ))}
//               </div>
//             </div>
 
//             {/* Tipo de cuenta */}
//             <div className="mb-5">
//               <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider mb-2 block">
//                 Tipo de cuenta
//               </label>
//               <div className="flex gap-3">
//                 {(['ahorros', 'corriente'] as TipoCuenta[]).map((tipo) => (
//                   <button
//                     key={tipo}
//                     type="button"
//                     onClick={() => setTipoCuenta(tipo)}
//                     className={`flex-1 py-2 font-label text-sm border-2 transition-all capitalize ${
//                       tipoCuenta === tipo
//                         ? 'bg-primary text-white border-secondary'
//                         : 'bg-white text-gray-500 border-gray-200 hover:border-primary'
//                     }`}
//                   >
//                     {tipo}
//                   </button>
//                 ))}
//               </div>
//             </div>
 
//             {/* Nombre */}
//             <div className="mb-5">
//               <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider mb-2 block">
//                 Nombre completo
//               </label>
//               <input
//                 type="text"
//                 value={nombre}
//                 onChange={(e) => setNombre(e.target.value)}
//                 placeholder="Ej: Leandro Loaiza"
//                 className="w-full font-body text-gray-700 px-4 py-3 border-2 border-gray-200 focus:border-primary outline-none"
//               />
//             </div>
 
//             {/* Email */}
//             <div className="mb-5">
//               <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider mb-2 block">
//                 Correo electrónico
//               </label>
//               <input
//                 type="email"
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 placeholder="correo@ejemplo.com"
//                 className="w-full font-body text-gray-700 px-4 py-3 border-2 border-gray-200 focus:border-primary outline-none"
//               />
//             </div>
 
//             {/* Cédula / NIT */}
//             <div className="mb-6">
//               <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider mb-2 block">
//                 {tipoPersona === 'natural' ? 'Número de cédula' : 'NIT'}
//               </label>
//               <input
//                 type="text"
//                 value={cedula}
//                 onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
//                 placeholder={tipoPersona === 'natural' ? 'Ej: 1234567890' : 'Ej: 900123456'}
//                 className="w-full font-body text-gray-700 px-4 py-3 border-2 border-gray-200 focus:border-primary outline-none"
//                 maxLength={11}
//               />
//             </div>
 
//             {/* Error */}
//             {error && (
//               <div className="bg-red-50 border-2 border-primary px-4 py-3 mb-5">
//                 <p className="font-label text-sm text-primary">{error}</p>
//               </div>
//             )}
 
//             {/* Botón de pago */}
//             <button
//               onClick={handlePagar}
//               disabled={loading}
//               className="w-full flex items-center justify-center gap-3 font-label font-bold text-base text-white bg-primary py-4 border-3 border-secondary shadow-comic transition-all hover:bg-red-dark hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--navy)] disabled:opacity-60 disabled:cursor-not-allowed"
//             >
//               {loading ? (
//                 <>
//                   <Loader2 className="w-5 h-5 animate-spin" />
//                   PROCESANDO...
//                 </>
//               ) : (
//                 <>
//                   <CreditCard className="w-5 h-5" />
//                   PAGAR {montoFormateado}
//                 </>
//               )}
//             </button>
 
//             {/* Seguridad */}
//             <div className="flex items-center justify-center gap-2 mt-4">
//               <ShieldCheck className="w-4 h-4 text-gray-400" />
//               <p className="font-label text-xs text-gray-400">
//                 Pago seguro procesado por <strong>Stripe + PSE</strong>
//               </p>
//             </div>
//           </div>
 
//         </div>
//       </section>
 
//       <Footer />
//     </main>
//   )
// }

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { useAuthStore, useCartStore } from '@/lib/store'
import { db } from '@/lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { ShieldCheck, CreditCard, Loader2, AlertTriangle, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getRateLimitStatus, consumeRateLimitAttempt, clearRateLimit, formatTimeLeft } from '@/lib/rate-limit-client'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!)

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      fontFamily: 'inherit',
      color: '#374151',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#DC2626' },
  },
}

function CheckoutForm({ amount, concept, planId, cartItems, montoFormateado }: {
  amount: number
  concept: string
  planId?: string
  cartItems: any[]
  montoFormateado: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const { user, updateUser } = useAuthStore()
  const { clearCart } = useCartStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Rate Limit States
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [isBlocked, setIsBlocked] = useState(false)

  // Countdown effect
  useEffect(() => {
    if (secondsLeft <= 0) {
      if (isBlocked) setIsBlocked(false)
      return
    }
    const timer = setInterval(() => setSecondsLeft(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [secondsLeft, isBlocked])

  // Initial check
  useEffect(() => {
    const checkStatus = async () => {
      const status = await getRateLimitStatus()
      setRemainingAttempts(status.remaining)
      if (!status.success) {
        setIsBlocked(true)
        setSecondsLeft(status.secondsLeft)
        setError(status.message || 'Límite de intentos de pago excedido')
      }
    }
    checkStatus()
  }, [])

  const handlePagar = async () => {
    if (!stripe || !elements || isBlocked) return
    setError('')
    setLoading(true)

    try {
      // 1. Consumimos un intento al presionar COMPRAR
      const status = await consumeRateLimitAttempt()
      setRemainingAttempts(status.remaining)

      if (!status.success) {
        setIsBlocked(true)
        setSecondsLeft(status.secondsLeft)
        setError(status.message || 'Demasiados intentos de pago.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/stripe/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          items: cartItems.length > 0 ? cartItems : undefined,
          customerEmail: user?.email || '',
          customerName: user?.username || '',
          uid: user?.uid || '',
        }),
      })

      // Update remaining from headers
      const remaining = res.headers.get('X-RateLimit-Remaining')
      if (remaining) setRemainingAttempts(parseInt(remaining))

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 429) {
          setIsBlocked(true)
          const reset = parseInt(res.headers.get('X-RateLimit-Reset') || '0')
          const wait = Math.max(0, Math.ceil((reset - Date.now()) / 1000))
          setSecondsLeft(wait)
          throw new Error(data.error || 'Seguridad: Demasiados intentos de pago.')
        }
        throw new Error(data.error || 'Error al procesar el pago')
      }

      const { clientSecret } = await res.json()

      const cardElement = elements.getElement(CardElement)!
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: user?.username || '',
            email: user?.email || '',
          },
        },
      })

      if (stripeError) throw new Error(stripeError.message)

      if (paymentIntent?.status === 'succeeded') {
        // Enviar email con los datos finales calculados por el server
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'success',
            to: user?.email || '',
            customerName: user?.username || '',
            amount, // Para el UI/Email usamos lo que cargamos inicialmente, pero el cobro real ya pasó
            concept,
            transactionId: paymentIntent.id,
            items: cartItems.length > 0 ? cartItems : undefined,
          }),
        })
        setSuccess(true)
        
        // EXITO: Limpiar historial de rate limit
        await clearRateLimit()

        if (cartItems && cartItems.length > 0) {
           clearCart() // Vaciamos el carrito tras compra exitosa
        }

        // 3. Actualizar Firestore directamente (para registrar el plan solo si aplica)
        if (user?.uid) {
          const conceptoLCase = concept.toLowerCase()
          
          if (conceptoLCase.includes('plan') || conceptoLCase.includes('mensualidad') || conceptoLCase.includes('parejas') || conceptoLCase.includes('dos en uno')) {
             let dias = 30
             if (conceptoLCase.includes('parejas')) dias = 40
             else if (conceptoLCase.includes('dos en uno')) dias = 60
             
             const ahora = new Date()
             const expira = new Date()
             expira.setDate(ahora.getDate() + dias)

             const planData = {
                nombre: concept,
                precio: amount,
                dias_total: dias,
                inicio: ahora,
                expira: expira,
             }

             try {
                await updateDoc(doc(db, 'users', user.uid), { plan: planData })
                updateUser({ plan: planData })
             } catch (err) {
                console.error("Error al actualizar plan localmente:", err)
             }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <p className="text-5xl mb-4">✅</p>
        <h2 className="font-display text-2xl text-secondary tracking-wider mb-2 uppercase italic">¡PAGO EXITOSO!</h2>
        <p className="font-body text-gray-500 mb-6 font-bold">Recibirás un correo de confirmación en unos minutos.</p>
        <a href="/" className="inline-block font-label font-bold text-sm text-white bg-green-600 px-8 py-4 border-4 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 transition-all">
          IR AL INICIO
        </a>
      </div>
    )
  }

  return (
    <div>
      <style jsx global>{`
        @keyframes comicShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: comicShake 0.1s ease-in-out 4;
        }
      `}</style>

      {/* Attempts Remaining */}
      {!isBlocked && remainingAttempts !== null && (
        <div className="flex items-center justify-between mb-4 px-2">
          <span className="font-label text-[10px] uppercase font-black text-gray-400 tracking-widest">Seguridad del Pago</span>
          <div className="flex gap-1">
             {[...Array(5)].map((_, i) => (
                <div key={i} className={cn(
                  "w-2.5 h-2.5 rounded-full border-2 border-secondary",
                  i < remainingAttempts ? "bg-primary" : "bg-red-100"
                )} />
             ))}
          </div>
        </div>
      )}

      <div className="bg-secondary text-white border-3 border-secondary p-5 mb-6 shadow-comic-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-label text-xs text-white/60 uppercase tracking-wider mb-1">Concepto</p>
            <p className="font-label font-bold text-base">{concept}</p>
          </div>
          <div className="text-right">
            <p className="font-label text-xs text-white/60 uppercase tracking-wider mb-1">Total</p>
            <p className="font-display text-2xl text-accent">{montoFormateado}</p>
          </div>
        </div>
      </div>

      <div className={cn("mb-6 transition-all duration-300", (isBlocked || error) && "animate-shake")}>
        <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider mb-2 block px-1">
          Datos de la tarjeta (Visa/Mastercard)
        </label>
        <div className={cn(
          "border-4 border-secondary px-4 py-5 transition-all shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]",
          isBlocked ? "bg-gray-100 opacity-50 grayscale" : "bg-white"
        )}>
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
        <p className="font-label text-[10px] text-gray-400 mt-3 font-bold uppercase tracking-widest">
          💡 Daviplata: usa tu tarjeta virtual Mastercard
        </p>
      </div>

      {isBlocked ? (
        <div className="bg-primary text-white p-6 mb-6 rounded-xl border-4 border-navy-dark flex flex-col items-center shadow-comic">
          <AlertTriangle className="w-12 h-12 mb-2 animate-bounce" />
          <div className="bg-navy-dark px-4 py-1 rounded-full text-xl font-black flex items-center gap-2 mb-3">
            <Timer className="w-5 h-5" />
            {formatTimeLeft(secondsLeft)}
          </div>
          <p className="font-label text-xs text-center uppercase tracking-widest font-black leading-tight">
            Pasarela Bloqueada <br />Demasiados intentos de pago
          </p>
        </div>
      ) : error ? (
        <div className="bg-red-light border-3 border-primary p-4 mb-6 flex items-center gap-4 animate-in slide-in-from-top">
          <AlertTriangle className="w-6 h-6 text-primary shrink-0" />
          <p className="font-label text-[11px] font-black text-primary uppercase leading-tight tracking-wider">{error}</p>
        </div>
      ) : null}

      <button
        onClick={handlePagar}
        disabled={loading || !stripe || isBlocked}
        className="w-full flex items-center justify-center gap-3 font-display italic text-2xl tracking-[2px] text-white bg-primary py-5 border-4 border-secondary shadow-comic transition-all hover:bg-red-dark hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0_var(--navy)] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
      >
        {loading
          ? <><Loader2 className="w-8 h-8 animate-spin" />PROCESANDO...</>
          : <><CreditCard className="w-8 h-8" />COMPRAR AHORA</>
        }
      </button>

      <div className="flex items-center justify-center gap-2 mt-6">
        <ShieldCheck className="w-5 h-5 text-gray-500" />
        <p className="font-label text-[10px] text-gray-400 font-bold uppercase tracking-widest">Pago 100% Seguro con <strong>Stripe Encryption</strong></p>
      </div>
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
  const conceptoLegacy = searchParams.get('concepto')
  const montoLegacy = Number(searchParams.get('monto')) || 0

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
        const total = items.reduce((acc, item) => acc + (item.price * item.cantidad), 0)
        setPlanData({ name: "Compra de Productos", price: total })
      } else if (conceptoLegacy && montoLegacy) {
        setPlanData({ name: conceptoLegacy, price: montoLegacy })
      }
      setLoading(false)
    }
    loadPlan()
  }, [planId, items, conceptoLegacy, montoLegacy])

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
       <main className="min-h-screen bg-muted flex items-center justify-center">
         <Loader2 className="w-12 h-12 text-primary animate-spin" />
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
              PAGAR CON <span className="text-primary">TARJETA</span>
            </h1>
          </div>
          <div className="bg-white border-4 border-secondary shadow-[12px_12px_0_0_var(--red-primary)] p-8">
            <Elements stripe={stripePromise}>
              <CheckoutForm 
                amount={planData?.price || 0} 
                concept={planData?.name || ''} 
                planId={planId || undefined}
                montoFormateado={montoFormateado} 
                cartItems={items} 
              />
            </Elements>
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




// ## Para probar con Daviplata:
// 1. Abre Daviplata → **Tarjeta virtual** → copia el número Mastercard
// 2. Úsala en el formulario con la fecha y CVV que te da la app

// Para pruebas sin Daviplata:
// ```
// Número: 4242 4242 4242 4242
// Fecha:  12/34
// CVC:    123