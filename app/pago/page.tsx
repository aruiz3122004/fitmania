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

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { useAuthStore } from '@/lib/store'
import { db } from '@/lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { ShieldCheck, CreditCard, Loader2 } from 'lucide-react'

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

function CheckoutForm({ amount, concept, montoFormateado }: {
  amount: number
  concept: string
  montoFormateado: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const { user, updateUser } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handlePagar = async () => {
    if (!stripe || !elements) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/stripe/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          concept,
          customerEmail: user?.email || '',
          customerName: user?.username || '',
          uid: user?.uid || '',
        }),
      })

      const { clientSecret, error: backendError } = await res.json()
      if (backendError) throw new Error(backendError)

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
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'success',
            to: user?.email || '',
            customerName: user?.username || '',
            amount,
            concept,
            transactionId: paymentIntent.id,
          }),
        })
        setSuccess(true)

        // 3. Actualizar Firestore directamente (para feedback instantáneo y pruebas en localhost)
        if (user?.uid) {
          let dias = 30
          const conceptoLCase = concept.toLowerCase()
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
        <h2 className="font-display text-2xl text-secondary tracking-wider mb-2">¡PAGO EXITOSO!</h2>
        <p className="font-body text-gray-500 mb-6">Recibirás un correo de confirmación.</p>
        <a href="/" className="inline-block font-label font-bold text-sm text-white bg-primary px-6 py-3 border-2 border-secondary">
          IR AL INICIO
        </a>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-secondary text-white border-3 border-secondary p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-label text-xs text-white/60 uppercase tracking-wider mb-1">Concepto</p>
            <p className="font-label font-bold">{concept}</p>
          </div>
          <div className="text-right">
            <p className="font-label text-xs text-white/60 uppercase tracking-wider mb-1">Total</p>
            <p className="font-display text-2xl text-accent">{montoFormateado}</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider mb-2 block">
          Datos de la tarjeta
        </label>
        <div className="border-2 border-gray-200 focus-within:border-primary px-4 py-4 transition-colors">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
        <p className="font-label text-xs text-gray-400 mt-2">
          💡 Daviplata: usa tu tarjeta virtual Mastercard desde la app
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-primary px-4 py-3 mb-5">
          <p className="font-label text-sm text-primary">{error}</p>
        </div>
      )}

      <button
        onClick={handlePagar}
        disabled={loading || !stripe}
        className="w-full flex items-center justify-center gap-3 font-label font-bold text-base text-white bg-primary py-4 border-3 border-secondary shadow-comic transition-all hover:bg-red-dark disabled:opacity-60"
      >
        {loading
          ? <><Loader2 className="w-5 h-5 animate-spin" />PROCESANDO...</>
          : <><CreditCard className="w-5 h-5" />PAGAR {montoFormateado}</>
        }
      </button>

      <div className="flex items-center justify-center gap-2 mt-4">
        <ShieldCheck className="w-4 h-4 text-gray-400" />
        <p className="font-label text-xs text-gray-400">Pago seguro con <strong>Stripe</strong></p>
      </div>
    </div>
  )
}

// ↓ Renombrada a PagoContent (sin export default)
function PagoContent() {
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuthStore()

  const conceptoParam = searchParams.get('concepto') || 'Servicio Fitmania'
  const montoParam = Number(searchParams.get('monto')) || 0
  const montoFormateado = new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(montoParam)

  if (!isAuthenticated) {
    return (
      <main>
        <Topbar />
        <section className="mt-[72px] min-h-screen bg-muted flex items-center justify-center py-16">
          <div className="bg-white border-3 border-secondary shadow-comic p-8 text-center max-w-sm">
            <p className="font-body text-gray-600 mb-4">Debes iniciar sesión para realizar un pago.</p>
            <a href="/login" className="inline-block font-label font-bold text-sm text-white bg-primary px-6 py-3 border-2 border-secondary">
              INICIAR SESIÓN
            </a>
          </div>
        </section>
        <Footer />
      </main>
    )
  }

  return (
    <main>
      <Topbar />
      <section className="mt-[72px] min-h-screen bg-muted py-16">
        <div className="max-w-[520px] mx-auto px-6">
          <div className="text-center mb-8">
            <span className="inline-block font-label font-bold text-xs text-navy bg-accent px-3 py-1 tracking-wider uppercase border-2 border-navy mb-3">
              PAGO SEGURO
            </span>
            <h1 className="font-display text-3xl text-secondary tracking-wider">
              PAGAR CON <span className="text-primary">TARJETA</span>
            </h1>
          </div>
          <div className="bg-white border-3 border-secondary shadow-comic p-6">
            <Elements stripe={stripePromise}>
              <CheckoutForm amount={montoParam} concept={conceptoParam} montoFormateado={montoFormateado} />
            </Elements>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}

// ↓ Export default: solo envuelve PagoContent en Suspense
export default function PagoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <p className="font-label text-gray-500">Cargando...</p>
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