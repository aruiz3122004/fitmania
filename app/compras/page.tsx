'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { SectionHeader } from '@/components/ui/section-header'
import { Skeleton } from '@/components/ui/comic-skeleton'
import { auth } from '@/lib/firebase'
import { useAuthStore, useUIStore } from '@/lib/store'
import type { PurchaseEntry, PurchaseStatus, PurchaseSummary } from '@/lib/purchase-history'
import { Receipt, Dumbbell, ShoppingBag, ChevronDown, RefreshCw, LogIn, Wallet, CalendarDays, ArrowLeft } from 'lucide-react'

type Filtro = 'todas' | 'plan' | 'products'
type Estado = 'cargando' | 'sin-sesion' | 'error' | 'listo'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val)

const formatDate = (iso: string | null, withTime = false) => {
  if (!iso) return 'Sin fecha'
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

const STATUS: Record<PurchaseStatus, { label: string; className: string }> = {
  paid: { label: 'Pagado', className: 'bg-green-600 text-white' },
  partially_refunded: { label: 'Reembolso parcial', className: 'bg-accent text-secondary' },
  refunded: { label: 'Reembolsado', className: 'bg-zinc-700 text-white' },
  charged_back: { label: 'Contracargo', className: 'bg-zinc-700 text-white' },
  pending: { label: 'En proceso', className: 'bg-yellow-500 text-secondary' },
  rejected: { label: 'Rechazado', className: 'bg-primary text-white' },
  review: { label: 'En revisión', className: 'bg-orange-500 text-white' },
}

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'plan', label: 'Planes' },
  { id: 'products', label: 'Tienda' },
]

export default function ComprasPage() {
  const uid = useAuthStore((s) => s.user?.uid)
  const setUserDropdownOpen = useUIStore((s) => s.setUserDropdownOpen)
  const [estado, setEstado] = useState<Estado>('cargando')
  const [error, setError] = useState('')
  const [purchases, setPurchases] = useState<PurchaseEntry[]>([])
  const [summary, setSummary] = useState<PurchaseSummary | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [abierta, setAbierta] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setEstado('cargando')
    setError('')
    try {
      await auth.authStateReady()
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) {
        setEstado('sin-sesion')
        return
      }
      const res = await fetch('/api/me/purchases', { headers: { Authorization: `Bearer ${idToken}` } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'No se pudo cargar tu historial.')
        setEstado('error')
        return
      }
      setPurchases(data.purchases || [])
      setSummary(data.summary || null)
      setEstado('listo')
    } catch {
      setError('No se pudo cargar tu historial. Revisa tu conexión.')
      setEstado('error')
    }
  }, [])

  // Se recarga al iniciar o cerrar sesión.
  useEffect(() => {
    cargar()
  }, [cargar, uid])

  // "Volver" abre el menú de cuenta de la barra superior (arriba, para que se vea).
  const volverAlMenu = () => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    requestAnimationFrame(() => setUserDropdownOpen(true))
  }

  const visibles = filtro === 'todas' ? purchases : purchases.filter((p) => p.tipo === filtro)
  const conteo = (f: Filtro) => (f === 'todas' ? purchases.length : purchases.filter((p) => p.tipo === f).length)

  return (
    <main>
      <Topbar />
      <section className="mt-[72px] min-h-screen bg-muted py-16">
        <div className="max-w-[900px] mx-auto px-4 sm:px-8">
          <button
            onClick={volverAlMenu}
            className="inline-flex items-center gap-2 mb-6 font-label text-xs font-black uppercase tracking-widest bg-white text-black px-4 py-2 border-2 border-black rounded shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>

          <SectionHeader label="TU CUENTA" title="HISTORIAL DE" titleAccent="COMPRAS" />

          {estado === 'cargando' && (
            <div className="space-y-4" aria-busy="true" aria-label="Cargando historial">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-white border-3 border-secondary shadow-comic p-5 flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          )}

          {estado === 'sin-sesion' && (
            <div className="bg-white border-3 border-secondary shadow-comic p-10 text-center">
              <LogIn className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="font-display italic text-2xl text-secondary uppercase mb-2">Inicia sesión</h3>
              <p className="font-body text-gray-600 mb-6">Ingresa a tu cuenta para ver tus planes y compras.</p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 font-label font-bold text-sm text-white bg-primary px-6 py-3 border-2 border-secondary shadow-comic-sm hover:bg-red-dark transition-all"
              >
                <LogIn className="w-4 h-4" />
                Iniciar sesión
              </Link>
            </div>
          )}

          {estado === 'error' && (
            <div className="bg-white border-3 border-secondary shadow-comic p-10 text-center">
              <p className="font-label text-sm text-primary font-bold mb-6">{error}</p>
              <button
                onClick={cargar}
                className="inline-flex items-center gap-2 font-label font-bold text-sm text-white bg-primary px-6 py-3 border-2 border-secondary shadow-comic-sm hover:bg-red-dark transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
            </div>
          )}

          {estado === 'listo' && (
            <>
              {/* Resumen */}
              <div className="grid sm:grid-cols-3 gap-4 mb-10">
                <div className="bg-white border-3 border-secondary shadow-comic p-5">
                  <p className="font-label text-[10px] font-black uppercase tracking-[3px] text-gray-500">Compras</p>
                  <p className="font-display text-4xl text-secondary mt-1">{summary?.compras ?? 0}</p>
                </div>
                <div className="bg-zinc-900 border-3 border-black shadow-[6px_6px_0_0_rgba(220,38,38,1)] p-5">
                  <p className="font-label text-[10px] font-black uppercase tracking-[3px] text-zinc-400 flex items-center gap-2">
                    <Wallet className="w-3.5 h-3.5 text-primary" />
                    Total invertido
                  </p>
                  <p className="font-display text-3xl text-white mt-1 break-all">{formatCurrency(summary?.totalPagado ?? 0)}</p>
                </div>
                <div className="bg-white border-3 border-secondary shadow-comic p-5">
                  <p className="font-label text-[10px] font-black uppercase tracking-[3px] text-gray-500 flex items-center gap-2">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Última compra
                  </p>
                  <p className="font-display italic text-xl text-secondary uppercase mt-2">{summary?.ultimaCompra ? formatDate(summary.ultimaCompra) : '—'}</p>
                </div>
              </div>

              {purchases.length === 0 ? (
                <div className="bg-white border-3 border-dashed border-secondary p-10 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary rounded-2xl border-4 border-black flex items-center justify-center shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                    <Receipt className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-display italic text-2xl text-secondary uppercase mb-2">Aún no tienes compras</h3>
                  <p className="font-body text-gray-600 mb-6">Cuando compres un plan o un producto, lo verás aquí con su recibo.</p>
                  <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <Link
                      href="/planes"
                      className="inline-flex justify-center items-center gap-2 font-label font-bold text-sm text-white bg-primary px-6 py-3 border-2 border-secondary shadow-comic-sm hover:bg-red-dark transition-all"
                    >
                      <Dumbbell className="w-4 h-4" />
                      Ver planes
                    </Link>
                    <Link
                      href="/tienda"
                      className="inline-flex justify-center items-center gap-2 font-label font-bold text-sm text-secondary bg-white px-6 py-3 border-2 border-secondary hover:bg-gray-50 transition-all"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Ir a la tienda
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {/* Filtros */}
                  <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filtrar compras">
                    {FILTROS.map((f) => (
                      <button
                        key={f.id}
                        aria-pressed={filtro === f.id}
                        onClick={() => setFiltro(f.id)}
                        className={`font-label text-xs font-bold uppercase tracking-widest px-4 py-2 border-2 rounded-xl transition-all ${
                          filtro === f.id
                            ? 'bg-primary border-primary text-white shadow-[3px_3px_0_0_rgba(0,0,0,1)] -translate-y-0.5'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-primary'
                        }`}
                      >
                        {f.label} <span className="opacity-70">({conteo(f.id)})</span>
                      </button>
                    ))}
                  </div>

                  {visibles.length === 0 ? (
                    <p className="font-label text-sm text-gray-500 text-center py-10">
                      No hay compras en esta categoría.
                    </p>
                  ) : (
                    <ul className="space-y-4">
                      {visibles.map((p) => (
                        <PurchaseCard
                          key={p.id}
                          purchase={p}
                          open={abierta === p.id}
                          onToggle={() => setAbierta(abierta === p.id ? null : p.id)}
                        />
                      ))}
                    </ul>
                  )}
                </>
              )}

              <p className="mt-10 text-[10px] font-bold text-gray-500 uppercase italic text-center">
                * ¿Algo no cuadra con un pago? Escríbenos por <Link href="/pqrs" className="text-primary underline">PQRS</Link> con el número de transacción.
              </p>
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}

function PurchaseCard({ purchase: p, open, onToggle }: { purchase: PurchaseEntry; open: boolean; onToggle: () => void }) {
  const status = STATUS[p.estado]
  const detailsId = `compra-${p.id}`
  const Icon = p.tipo === 'plan' ? Dumbbell : ShoppingBag
  const unidades = p.items.reduce((acc, it) => acc + it.cantidad, 0)

  return (
    <li className="bg-white border-3 border-secondary shadow-comic">
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={detailsId}
        className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border-3 border-black flex items-center justify-center shrink-0 shadow-[3px_3px_0_0_rgba(0,0,0,1)] ${
            p.tipo === 'plan' ? 'bg-primary' : 'bg-secondary'
          }`}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-display italic text-base sm:text-xl leading-tight text-secondary uppercase line-clamp-2 sm:truncate">{p.concepto}</h3>
          <p className="font-label text-xs text-gray-500 sm:truncate mt-0.5">
            {formatDate(p.fecha)}
            {p.tipo === 'products' && unidades > 0 && ` · ${unidades} ${unidades === 1 ? 'producto' : 'productos'}`}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`font-display text-lg sm:text-xl ${p.estado === 'rejected' ? 'text-gray-400 line-through' : 'text-secondary'}`}>
            {formatCurrency(p.total)}
          </span>
          <span className={`font-label text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border-2 border-black ${status.className}`}>
            {status.label}
          </span>
        </div>

        <ChevronDown className={`hidden sm:block w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div id={detailsId} className="border-t-2 border-dashed border-gray-200 px-4 sm:px-5 py-5 animate-in slide-in-from-top-2 duration-200">
          {p.tipo === 'products' && p.items.length > 0 && (
            <div className="mb-5">
              <p className="font-label text-[10px] font-black uppercase tracking-[3px] text-gray-500 mb-2">Productos</p>
              <ul className="divide-y-2 divide-gray-100 border-2 border-gray-200">
                {p.items.map((it, i) => (
                  <li key={`${it.nombre}-${i}`} className="flex items-center justify-between gap-4 px-3 py-2">
                    <span className="font-body text-sm text-secondary min-w-0 truncate">
                      {it.nombre} <span className="text-gray-400">× {it.cantidad}</span>
                    </span>
                    <span className="font-label text-sm font-bold text-secondary shrink-0">{formatCurrency(it.precio * it.cantidad)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="grid sm:grid-cols-2 gap-4">
            <Detail label="Fecha" value={formatDate(p.fecha, true)} />
            <Detail label="Medio de pago" value={p.metodo || 'Mercado Pago'} />
            {p.dias && <Detail label="Duración del plan" value={`${p.dias} días`} />}
            {p.reembolsado > 0 && <Detail label="Reembolsado" value={formatCurrency(p.reembolsado)} highlight />}
            {p.transaccion && <Detail label="ID de transacción" value={p.transaccion} mono />}
          </dl>

          <StatusNote purchase={p} />
        </div>
      )}
    </li>
  )
}

function Detail({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="bg-gray-50 border-2 border-gray-200 px-4 py-3 min-w-0">
      <dt className="font-label text-[10px] text-gray-400 uppercase tracking-wider mb-1">{label}</dt>
      <dd className={`text-sm break-all ${mono ? 'font-mono text-xs text-gray-600' : 'font-body font-bold'} ${highlight ? 'text-primary' : 'text-secondary'}`}>
        {value}
      </dd>
    </div>
  )
}

function StatusNote({ purchase: p }: { purchase: PurchaseEntry }) {
  const note = (() => {
    switch (p.estado) {
      case 'pending':
        return { text: 'Tu pago está en proceso. Con PSE puede tardar unos minutos; con Efecty se confirma cuando pagues en el punto.' }
      case 'rejected':
        return {
          text: 'El pago fue rechazado y no se hizo ningún cobro.',
          link: p.tipo === 'plan' ? { href: '/planes', label: 'Intentar de nuevo' } : { href: '/tienda', label: 'Volver a la tienda' },
        }
      case 'review':
        return { text: 'Estamos revisando este pago. Si tienes dudas, escríbenos por PQRS.', link: { href: '/pqrs', label: 'Ir a PQRS' } }
      case 'partially_refunded':
        return { text: `Te devolvimos ${formatCurrency(p.reembolsado)} porque algunos productos se agotaron. El resto de tu compra sigue vigente.` }
      case 'refunded':
        return { text: `Se devolvió ${formatCurrency(p.reembolsado)} a tu medio de pago.` }
      case 'charged_back':
        return { text: 'Este pago fue desconocido ante tu banco (contracargo).' }
      default:
        return null
    }
  })()
  if (!note) return null

  return (
    <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 bg-muted border-2 border-secondary px-4 py-3">
      <p className="flex-1 font-body text-sm text-gray-700">{note.text}</p>
      {note.link && (
        <Link
          href={note.link.href}
          className="text-center font-label font-bold text-xs text-white bg-primary px-4 py-2 border-2 border-secondary shadow-comic-sm hover:bg-red-dark transition-all uppercase tracking-wider shrink-0"
        >
          {note.link.label}
        </Link>
      )}
    </div>
  )
}
