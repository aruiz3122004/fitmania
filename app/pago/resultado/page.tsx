'use client'
 
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'

type Estado = 'cargando' | 'exitoso' | 'fallido' | 'pendiente'

// ↓ Renombrada de PagoResultadoPage a ResultadoContent para el deploy en vercel
function ResultadoContent() {
  const searchParams = useSearchParams()
  const [estado, setEstado] = useState<Estado>('cargando')
  const [paymentIntentId, setPaymentIntentId] = useState('')
 
  useEffect(() => {
    const redirectStatus = searchParams.get('redirect_status')
    const intentId = searchParams.get('payment_intent') || ''
    setPaymentIntentId(intentId)
 
    if (redirectStatus === 'succeeded') {
      setEstado('exitoso')
    } else if (redirectStatus === 'failed') {
      setEstado('fallido')
    } else if (redirectStatus === 'pending') {
      setEstado('pendiente')
    } else {
      setEstado('fallido')
    }
  }, [searchParams])
 
  const config = {
    exitoso: {
      icon: <CheckCircle2 className="w-20 h-20 text-green-600" />,
      bgBanner: 'bg-green-700',
      titulo: '¡PAGO EXITOSO!',
      mensaje: 'Tu pago fue procesado correctamente. Recibirás un correo de confirmación con el extracto del pago en tu bandeja de entrada.',
      accion: { label: 'IR AL INICIO', href: '/' },
    },
    fallido: {
      icon: <XCircle className="w-20 h-20 text-primary" />,
      bgBanner: 'bg-primary',
      titulo: '¡PAGO RECHAZADO!',
      mensaje: 'No hemos detectado el movimiento mediante tu cuenta bancaria. Si crees que es un error, contáctanos a través de PQRS o visita nuestro punto físico.',
      accion: { label: 'IR A PQRS', href: '/pqrs' },
    },
    pendiente: {
      icon: <Clock className="w-20 h-20 text-yellow-600" />,
      bgBanner: 'bg-yellow-600',
      titulo: 'PAGO EN PROCESO',
      mensaje: 'Tu pago está siendo procesado por el banco. Esto puede tardar unos minutos. Te notificaremos por correo cuando se confirme.',
      accion: { label: 'IR AL INICIO', href: '/' },
    },
    cargando: {
      icon: <Loader2 className="w-20 h-20 text-gray-400 animate-spin" />,
      bgBanner: 'bg-gray-600',
      titulo: 'VERIFICANDO...',
      mensaje: 'Estamos verificando el estado de tu pago, por favor espera.',
      accion: { label: 'IR AL INICIO', href: '/' },
    },
  }
 
  const { icon, bgBanner, titulo, mensaje, accion } = config[estado]
 
  return (
    <main>
      <Topbar />
      <section className="mt-[72px] min-h-screen bg-muted flex items-center justify-center py-16">
        <div className="max-w-[480px] w-full mx-auto px-6">
          <div className="bg-white border-3 border-secondary shadow-comic overflow-hidden">
            <div className="bg-secondary px-8 py-6 text-center">
              <h1 className="font-display text-2xl text-white tracking-wider">
                FIT<span className="text-accent">MANIA</span>
              </h1>
            </div>
            <div className={`${bgBanner} px-8 py-8 text-center`}>
              <div className="flex justify-center mb-4">{icon}</div>
              <h2 className="font-display text-2xl text-white tracking-wider">{titulo}</h2>
            </div>
            <div className="px-8 py-8">
              <p className="font-body text-gray-600 text-base leading-relaxed text-center mb-6">
                {mensaje}
              </p>
              {paymentIntentId && (
                <div className="bg-gray-50 border-2 border-gray-200 px-4 py-3 mb-6">
                  <p className="font-label text-xs text-gray-400 uppercase tracking-wider mb-1">
                    ID de transacción
                  </p>
                  <p className="font-body text-xs text-gray-600 font-mono break-all">
                    {paymentIntentId}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-3">
                <Link
                  href={accion.href}
                  className="block text-center font-label font-bold text-sm text-white bg-primary py-3 border-2 border-secondary shadow-comic-sm transition-all hover:bg-red-dark hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_var(--navy)]"
                >
                  {accion.label}
                </Link>
                {estado === 'fallido' && (
                  <Link
                    href="/pago"
                    className="block text-center font-label font-bold text-sm text-secondary py-3 border-2 border-secondary transition-all hover:bg-gray-50"
                  >
                    INTENTAR NUEVAMENTE
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}

// ↓ Esta es la única función nueva que se agrega al final
export default function PagoResultadoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <p className="font-label text-gray-500">Cargando...</p>
      </div>
    }>
      <ResultadoContent />
    </Suspense>
  )
}
