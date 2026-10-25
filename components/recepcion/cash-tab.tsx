'use client'

import { useCallback, useEffect, useState } from 'react'
import { Banknote, Loader2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

/** Caja de recepción: ventas en mostrador (F3-23) y cierre de caja diario (F3-24). */

interface PosProduct { id: string; nombre: string; precio: number; stock: number }
interface Summary {
  date: string
  sales: { id: string; total: number; paymentMethod: string; soldBy: string | null; hora: string | null; items: string }[]
  totals: Record<string, number>
  totalSales: number
  entries: number
  closures: { id: string; countedCash: number; expectedCash: number; difference: number; closedBy: string; closedAt: string | null }[]
}

const METHODS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'datafono', label: 'Datáfono' },
  { id: 'transferencia', label: 'Transferencia' },
]

const cop = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export default function CashTab() {
  const [products, setProducts] = useState<PosProduct[]>([])
  const [cart, setCart] = useState<{ id: string; cantidad: number }[]>([])
  const [selected, setSelected] = useState('')
  const [method, setMethod] = useState('efectivo')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [busy, setBusy] = useState(false)
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([fetch('/api/recepcion/pos'), fetch('/api/recepcion/cash-close')])
      if (p.ok) setProducts((await p.json()).products || [])
      if (s.ok) setSummary(await s.json())
    } catch {
      toast.error('No se pudo cargar la caja.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const byId = (id: string) => products.find((p) => p.id === id)
  const cartTotal = cart.reduce((acc, it) => acc + (byId(it.id)?.precio || 0) * it.cantidad, 0)

  const addToCart = () => {
    if (!selected) return
    setCart((prev) => {
      const found = prev.find((it) => it.id === selected)
      return found ? prev.map((it) => (it.id === selected ? { ...it, cantidad: it.cantidad + 1 } : it)) : [...prev, { id: selected, cantidad: 1 }]
    })
  }

  const changeQty = (id: string, delta: number) =>
    setCart((prev) => prev.map((it) => (it.id === id ? { ...it, cantidad: Math.max(1, it.cantidad + delta) } : it)))

  const sell = async () => {
    if (cart.length === 0) return
    setBusy(true)
    try {
      const res = await fetch('/api/recepcion/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, paymentMethod: method }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      toast.success(`Venta registrada: ${cop(data.total)}`)
      setCart([])
      load()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo registrar la venta.')
    } finally {
      setBusy(false)
    }
  }

  const closeCash = async () => {
    if (counted === '') return toast.error('Ingresa el efectivo contado.')
    if (!confirm('¿Registrar el cierre de caja de hoy?')) return
    setBusy(true)
    try {
      const res = await fetch('/api/recepcion/cash-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedCash: Number(counted), notes }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      toast.success(data.difference === 0 ? 'Cierre registrado: la caja cuadra.' : `Cierre registrado con diferencia de ${cop(data.difference)}.`)
      setCounted('')
      setNotes('')
      load()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo registrar el cierre.')
    } finally {
      setBusy(false)
    }
  }

  const box = 'border-4 border-black rounded-2xl p-5 bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)]'

  return (
    <div className="w-full space-y-6">
      <div className={box}>
        <h2 className="font-display italic text-2xl uppercase flex items-center gap-2 mb-4"><ShoppingCart className="w-6 h-6" /> Venta en mostrador</h2>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="flex-1 border-4 border-black rounded-xl px-3 py-2 font-bold">
            <option value="">Selecciona un producto…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id} disabled={p.stock === 0}>
                {p.nombre} — {cop(p.precio)} ({p.stock} disp.)
              </option>
            ))}
          </select>
          <button onClick={addToCart} disabled={!selected} className="px-4 py-2 bg-black text-white border-4 border-black rounded-xl font-black uppercase text-xs disabled:opacity-50">Agregar</button>
        </div>

        {cart.length > 0 && (
          <div className="space-y-2 mb-4">
            {cart.map((it) => {
              const p = byId(it.id)
              return (
                <div key={it.id} className="flex items-center gap-3 border-2 border-black rounded-xl p-2">
                  <span className="flex-1 font-bold text-sm">{p?.nombre}</span>
                  <button onClick={() => changeQty(it.id, -1)} className="p-1 border-2 border-black rounded"><Minus className="w-3 h-3" /></button>
                  <span className="font-black w-6 text-center">{it.cantidad}</span>
                  <button onClick={() => changeQty(it.id, 1)} className="p-1 border-2 border-black rounded"><Plus className="w-3 h-3" /></button>
                  <span className="font-black text-sm w-24 text-right">{cop((p?.precio || 0) * it.cantidad)}</span>
                  <button onClick={() => setCart((prev) => prev.filter((x) => x.id !== it.id))} className="p-1"><Trash2 className="w-4 h-4 text-red-600" /></button>
                </div>
              )
            })}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex gap-2">
                {METHODS.map((m) => (
                  <button key={m.id} onClick={() => setMethod(m.id)} className={`px-3 py-2 border-2 border-black rounded-lg font-black uppercase text-[10px] ${method === m.id ? 'bg-green-600 text-white' : 'bg-white'}`}>{m.label}</button>
                ))}
              </div>
              <span className="ml-auto font-black text-xl">{cop(cartTotal)}</span>
              <button onClick={sell} disabled={busy} className="px-5 py-3 bg-green-600 text-white border-4 border-black rounded-xl font-black uppercase text-sm disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cobrar'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={box}>
        <h2 className="font-display italic text-2xl uppercase flex items-center gap-2 mb-4"><Banknote className="w-6 h-6" /> Cierre de caja — hoy</h2>
        {!summary ? (
          <p className="font-bold text-zinc-400 uppercase text-sm">Cargando…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              {METHODS.map((m) => (
                <div key={m.id} className="border-2 border-black rounded-xl p-3">
                  <p className="text-[10px] font-black uppercase text-zinc-500">{m.label}</p>
                  <p className="font-black">{cop(summary.totals[m.id] || 0)}</p>
                </div>
              ))}
              <div className="border-2 border-black rounded-xl p-3 bg-green-50">
                <p className="text-[10px] font-black uppercase text-zinc-500">Total ventas</p>
                <p className="font-black">{cop(summary.totalSales)}</p>
              </div>
              <div className="border-2 border-black rounded-xl p-3">
                <p className="text-[10px] font-black uppercase text-zinc-500">Ingresos al gym</p>
                <p className="font-black">{summary.entries}</p>
              </div>
            </div>

            {summary.sales.length > 0 && (
              <div className="max-h-48 overflow-y-auto divide-y-2 divide-zinc-100 mb-4 text-sm">
                {summary.sales.map((s) => (
                  <div key={s.id} className="flex flex-wrap gap-3 py-1">
                    <span className="font-black w-14">{s.hora ? new Date(s.hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }) : ''}</span>
                    <span className="flex-1">{s.items}</span>
                    <span className="text-[10px] font-black uppercase">{s.paymentMethod}</span>
                    <span className="font-black">{cop(s.total)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <input type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} placeholder={`Efectivo contado (esperado ${cop(summary.totals.efectivo || 0)})`} className="flex-1 border-4 border-black rounded-xl px-3 py-2 font-bold" />
              <input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones (opcional)" className="flex-1 border-4 border-black rounded-xl px-3 py-2 font-bold" />
              <button onClick={closeCash} disabled={busy} className="px-5 py-2 bg-black text-white border-4 border-black rounded-xl font-black uppercase text-xs disabled:opacity-50">Cerrar caja</button>
            </div>

            {summary.closures.length > 0 && (
              <div className="mt-4 text-xs font-bold text-zinc-600 space-y-1">
                {summary.closures.map((c) => (
                  <p key={c.id}>
                    Cierre {c.closedAt ? new Date(c.closedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }) : ''} por {c.closedBy}: contado {cop(c.countedCash)} · esperado {cop(c.expectedCash)} ·{' '}
                    <span className={c.difference === 0 ? 'text-green-700' : 'text-red-600'}>{c.difference === 0 ? 'cuadra' : `diferencia ${cop(c.difference)}`}</span>
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
