'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, Circle, Dumbbell, FlaskConical, Inbox, Loader2, LogOut, QrCode, ShieldCheck } from 'lucide-react'
import { IS_SANDBOX } from '@/lib/sandbox'
import { exitSandbox, useSandboxSession } from '@/lib/sandbox-client'
import { enterPanel } from '@/lib/panel-access'
import { useAuthStore } from '@/lib/store'
import { SandboxMailbox, useSandboxMail } from './sandbox-mailbox'

const COLLAPSED_KEY = 'fitmania_sandbox_bar_collapsed'

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

/**
 * Barra flotante del modo sandbox: insignia, tiempo restante, cambio de rol (socio,
 * recepción, administración), buzón de correos simulados, misiones y salida.
 * Solo existe en el despliegue del sandbox.
 */
export function SandboxBar() {
  if (!IS_SANDBOX) return null
  return <SandboxBarInner />
}

function SandboxBarInner() {
  const pathname = usePathname()
  const session = useSandboxSession()
  const { user } = useAuthStore()
  const mails = useSandboxMail(session.active ? session.email : null)
  const [now, setNow] = useState(() => Date.now())
  const [collapsed, setCollapsed] = useState(true)
  const [mailOpen, setMailOpen] = useState(false)
  const [busy, setBusy] = useState<'admin' | 'recepcion' | 'exit' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // Cerrada por defecto para no tapar los paneles; abierta solo la primera vez en el
    // inicio de un computador, para que se descubra. Luego manda lo que elija el visitante.
    const firstLook = window.location.pathname === '/' && window.innerWidth >= 1024
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY)
      setCollapsed(saved ? saved === '1' : !firstLook)
    } catch {
      setCollapsed(!firstLook)
    }
  }, [])

  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1') } catch { /* sin almacenamiento */ }
      return !c
    })
  }

  const remaining = session.expiresAt ? session.expiresAt - now : null

  const leave = useCallback(async () => {
    setBusy('exit')
    await exitSandbox()
  }, [])

  useEffect(() => {
    if (!session.active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [session.active])

  // Al vencer la visita se borra todo y se vuelve al sitio real.
  useEffect(() => {
    if (session.active && remaining !== null && remaining <= 0 && busy !== 'exit') void leave()
  }, [session.active, remaining, busy, leave])

  const openPanel = async (role: 'admin' | 'recepcion') => {
    setError('')
    setBusy(role)
    try {
      await enterPanel(role)
    } catch (err: any) {
      setError(err?.message || 'No se pudo abrir el panel.')
      setBusy(null)
    }
  }

  if (!session.active) {
    if (pathname === '/sandbox') return null
    return (
      <Link
        href="/sandbox"
        className="fixed bottom-4 left-4 z-[60] inline-flex items-center gap-2 bg-lime-300 text-secondary font-display text-lg tracking-wider px-4 py-2 border-3 border-secondary shadow-comic-sm hover:-translate-y-0.5 transition-transform"
      >
        <FlaskConical className="w-5 h-5" aria-hidden /> MODO SANDBOX · ENTRAR
      </Link>
    )
  }

  const planActive = !!(user?.plan && new Date(user.plan.expira) > new Date())
  const missions = [
    { done: planActive, label: 'Compra un plan con la pasarela simulada', href: '/planes' },
    { done: mails.length > 0, label: 'Lee el recibo en tu buzón', onClick: () => setMailOpen(true) },
    { done: false, label: 'Publica en el foro (y prueba el límite de 3)', href: '/foro' },
    { done: false, label: 'Registra un ingreso desde recepción', onClick: () => openPanel('recepcion') },
    { done: false, label: 'Mira tu venta en el panel de administración', onClick: () => openPanel('admin') },
  ]

  return (
    <>
      <div
        role="region"
        aria-label="Modo sandbox"
        className="fixed bottom-4 left-4 z-[60] w-[calc(100vw-2rem)] max-w-[340px] border-3 border-secondary shadow-comic bg-white"
      >
        {/* Franja de advertencia, la insignia del laboratorio. */}
        <div aria-hidden className="h-2 bg-[repeating-linear-gradient(45deg,#facc15_0_10px,#1e293b_10px_20px)]" />
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="w-full flex items-center gap-2 bg-lime-300 px-3 py-2 text-left"
        >
          <FlaskConical className="w-5 h-5 text-secondary shrink-0" aria-hidden />
          <span className="font-display text-xl tracking-wider text-secondary">SANDBOX</span>
          <span className="ml-auto font-label font-bold text-sm text-secondary tabular-nums" aria-label="Tiempo restante">
            {remaining !== null ? formatRemaining(remaining) : '--:--'}
          </span>
          {mails.length > 0 && (
            <span className="bg-primary text-white font-label font-bold text-[0.65rem] min-w-[20px] h-5 px-1 rounded-full grid place-items-center border-2 border-secondary">
              {mails.length}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-secondary transition-transform ${collapsed ? 'rotate-180' : ''}`} aria-hidden />
        </button>

        {!collapsed && (
          <div className="p-3 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            <p className="font-body text-xs text-gray-600 leading-snug">
              Eres <strong className="text-secondary">{user?.username || 'Explorador'}</strong>, con todos los roles. Nada de lo que hagas afecta al gimnasio real
              y tus datos se borran al salir.
            </p>

            <div className="grid grid-cols-3 gap-2">
              <Link href="/" className="flex flex-col items-center gap-1 bg-white border-2 border-secondary py-2 font-label font-bold text-[0.7rem] uppercase text-secondary hover:bg-gray-50">
                <Dumbbell className="w-4 h-4" aria-hidden /> Socio
              </Link>
              <button type="button" onClick={() => openPanel('recepcion')} disabled={!!busy} className="flex flex-col items-center gap-1 bg-green-600 text-white border-2 border-secondary py-2 font-label font-bold text-[0.7rem] uppercase hover:bg-green-700 disabled:opacity-60">
                {busy === 'recepcion' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <QrCode className="w-4 h-4" aria-hidden />} Recepción
              </button>
              <button type="button" onClick={() => openPanel('admin')} disabled={!!busy} className="flex flex-col items-center gap-1 bg-primary text-white border-2 border-secondary py-2 font-label font-bold text-[0.7rem] uppercase hover:bg-red-dark disabled:opacity-60">
                {busy === 'admin' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <ShieldCheck className="w-4 h-4" aria-hidden />} Admin
              </button>
            </div>
            {error && <p role="alert" className="font-label text-xs font-bold text-primary">{error}</p>}

            <button type="button" onClick={() => setMailOpen(true)} className="flex items-center gap-2 bg-lime-50 border-2 border-lime-600 px-3 py-2 font-label font-bold text-xs uppercase text-secondary hover:bg-lime-100">
              <Inbox className="w-4 h-4" aria-hidden /> Buzón simulado
              <span className="ml-auto">{mails.length} {mails.length === 1 ? 'correo' : 'correos'}</span>
            </button>

            <div>
              <p className="font-display text-lg tracking-wider text-secondary mb-1">MISIONES</p>
              <ul className="flex flex-col gap-1">
                {missions.map((m) => {
                  const Icon = m.done ? CheckCircle2 : Circle
                  const content = (
                    <>
                      <Icon className={`w-4 h-4 shrink-0 ${m.done ? 'text-lime-600' : 'text-gray-400'}`} aria-hidden />
                      <span className={m.done ? 'line-through text-gray-400' : ''}>{m.label}</span>
                    </>
                  )
                  const cls = 'flex items-center gap-2 w-full text-left font-body text-xs text-gray-700 hover:text-primary'
                  return (
                    <li key={m.label}>
                      {m.href ? <Link href={m.href} className={cls}>{content}</Link> : <button type="button" onClick={m.onClick} className={cls}>{content}</button>}
                    </li>
                  )
                })}
              </ul>
            </div>

            <button
              type="button"
              disabled={busy === 'exit'}
              onClick={() => { if (window.confirm('¿Salir del sandbox? Se borran tu cuenta temporal y todo lo que hiciste.')) void leave() }}
              className="flex items-center justify-center gap-2 bg-secondary text-white border-2 border-secondary py-2 font-label font-bold text-xs uppercase tracking-widest hover:bg-black disabled:opacity-60"
            >
              {busy === 'exit' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <LogOut className="w-4 h-4" aria-hidden />}
              {busy === 'exit' ? 'Borrando tus datos…' : 'Salir y borrar mis datos'}
            </button>
          </div>
        )}
      </div>
      {mailOpen && <SandboxMailbox mails={mails} onClose={() => setMailOpen(false)} />}
    </>
  )
}
