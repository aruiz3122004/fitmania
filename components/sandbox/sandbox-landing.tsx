'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { CreditCard, FlaskConical, Inbox, MessageSquare, QrCode, ShieldCheck, Timer, Trash2 } from 'lucide-react'
import { ComicLoader } from '@/components/ui/comic-loader'
import { startSandbox, useSandboxSession } from '@/lib/sandbox-client'
import { MAIN_SITE_URL } from '@/lib/sandbox'

const FEATURES = [
  { icon: CreditCard, title: 'Compra planes y productos', text: 'Con una pasarela simulada: el plan se activa y la venta aparece en el panel, igual que con Mercado Pago.' },
  { icon: QrCode, title: 'Panel de recepción', text: 'Registra ingresos, revisa el historial y el mapa de horas pico con socios de ejemplo.' },
  { icon: ShieldCheck, title: 'Panel de administración', text: 'Ventas, usuarios, inventario, noticias, PQRS, reportes del foro y auditoría.' },
  { icon: MessageSquare, title: 'Foro de la comunidad', text: 'Publica, comenta y reacciona. Hay un límite de 3 publicaciones seguidas: ¡pruébalo!' },
  { icon: Inbox, title: 'Buzón simulado', text: 'Los correos (recibos, recordatorios, códigos) no salen: los lees dentro del sandbox.' },
  { icon: Trash2, title: 'Sin rastro', text: 'Tu cuenta y todo lo que hagas se borran al salir o a las 2 horas.' },
]

export function SandboxLanding() {
  const session = useSandboxSession()
  const params = useSearchParams()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    setError('')
    setStarting(true)
    try {
      await startSandbox()
      window.location.assign('/')
    } catch (err: any) {
      setError(err?.message || 'No se pudo preparar el sandbox.')
      setStarting(false)
    }
  }

  if (starting) return <ComicLoader label="Preparando tu laboratorio" belowTopbar />

  return (
    <section className="mt-[72px] bg-muted">
      <div className="relative overflow-hidden bg-secondary text-white border-b-4 border-secondary">
        <div aria-hidden className="h-3 bg-[repeating-linear-gradient(45deg,#facc15_0_14px,#1e293b_14px_28px)]" />
        <div className="max-w-[1000px] mx-auto px-6 py-14 text-center">
          <span className="inline-flex items-center gap-2 bg-lime-300 text-secondary font-display text-lg tracking-[2px] px-4 py-1 border-3 border-white -rotate-2 shadow-[3px_3px_0_rgba(0,0,0,0.4)]">
            <FlaskConical className="w-5 h-5" aria-hidden /> MODO SANDBOX
          </span>
          <h1 className="mt-6 font-display text-5xl md:text-7xl tracking-wider leading-none [text-shadow:4px_4px_0_var(--primary)]">
            LABORATORIO <span className="text-lime-300">FITMANIA</span>
          </h1>
          <p className="mt-5 max-w-[62ch] mx-auto font-body text-white/85">
            Recorre el sistema completo como socio, recepcionista y administrador, con datos de ejemplo.
            Nada de lo que hagas toca el gimnasio real.
          </p>

          {params.get('salida') === '1' && !session.active && (
            <p role="status" className="mt-6 inline-block bg-lime-300 text-secondary font-label font-bold text-sm px-4 py-2 border-2 border-white">
              Listo: borramos tu cuenta temporal y todo lo que hiciste. ¡Gracias por probar!
            </p>
          )}

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {session.active ? (
              <Link href="/" className="font-display text-2xl tracking-wider bg-lime-300 text-secondary px-10 py-3 border-3 border-white shadow-[5px_5px_0_rgba(0,0,0,0.45)] hover:-translate-y-0.5 transition-transform">
                YA ESTÁS DENTRO · CONTINUAR
              </Link>
            ) : (
              <button
                type="button"
                onClick={start}
                className="font-display text-2xl tracking-wider bg-lime-300 text-secondary px-10 py-3 border-3 border-white shadow-[5px_5px_0_rgba(0,0,0,0.45)] hover:-translate-y-0.5 transition-transform"
              >
                ENTRAR AL SANDBOX
              </button>
            )}
            {MAIN_SITE_URL && (
              <a href={MAIN_SITE_URL} className="font-label font-bold text-sm uppercase tracking-widest text-white/80 underline">
                Volver al sitio real
              </a>
            )}
          </div>
          {error && <p role="alert" className="mt-4 font-label font-bold text-sm text-accent">{error}</p>}
          <p className="mt-6 inline-flex items-center gap-2 font-body text-xs text-white/70">
            <Timer className="w-4 h-4" aria-hidden /> Sin registro: te damos una cuenta temporal con todos los roles por 2 horas.
          </p>
        </div>
      </div>

      <div className="max-w-[1000px] mx-auto px-6 py-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <article key={title} className="bg-white border-3 border-secondary shadow-comic-sm p-5">
            <span className="inline-grid place-items-center w-10 h-10 bg-lime-300 border-2 border-secondary mb-3" aria-hidden>
              <Icon className="w-5 h-5 text-secondary" />
            </span>
            <h2 className="font-display text-xl tracking-wider text-secondary mb-1">{title.toUpperCase()}</h2>
            <p className="font-body text-sm text-gray-600 leading-relaxed">{text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
