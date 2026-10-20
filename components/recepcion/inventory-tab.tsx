'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ClipboardCheck, Loader2, Package, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Inventario de solo lectura para recepción (F3-06) con reporte de conteo físico
 * (F3-07). El conteo NO cambia el stock: avisa al admin, que decide el ajuste.
 */
interface InventoryItem {
  id: string
  nombre: string
  categoria: string
  stock: number
  lowStockThreshold: number
  low: boolean
}

export default function InventoryTab() {
  const [products, setProducts] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [countingId, setCountingId] = useState<string | null>(null)
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/recepcion/inventory')
      if (!res.ok) throw new Error('inventory')
      const data = await res.json()
      setProducts(Array.isArray(data.products) ? data.products : [])
    } catch {
      toast.error('No se pudo cargar el inventario.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const submitCount = async (productId: string) => {
    const value = Number(counted)
    if (!Number.isInteger(value) || value < 0) {
      toast.error('Ingresa un número entero válido.')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/recepcion/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, counted: value, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      toast.success(
        data.difference === 0
          ? 'Conteo enviado: coincide con el sistema.'
          : `Conteo enviado al administrador (diferencia ${data.difference > 0 ? '+' : ''}${data.difference}).`
      )
      setCountingId(null)
      setCounted('')
      setNote('')
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo enviar el conteo.')
    } finally {
      setSending(false)
    }
  }

  const lowCount = products.filter((p) => p.low).length

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="font-display italic text-3xl uppercase flex items-center gap-2"><Package className="w-7 h-7" /> Inventario</h2>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 border-4 border-black rounded-xl font-black uppercase text-xs bg-white hover:bg-zinc-100">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {lowCount > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-red-50 border-4 border-red-600 rounded-2xl p-4 font-black uppercase text-red-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {lowCount} producto{lowCount === 1 ? '' : 's'} en stock bajo (el administrador recibe alertas automáticas)
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400 font-black uppercase"><Loader2 className="w-5 h-5 animate-spin" /> Cargando…</div>
      ) : products.length === 0 ? (
        <p className="font-bold text-zinc-400 uppercase">No hay productos registrados.</p>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className={`border-4 border-black rounded-2xl p-4 bg-white ${p.low ? 'shadow-[6px_6px_0_0_rgba(220,38,38,1)]' : 'shadow-[6px_6px_0_0_rgba(0,0,0,1)]'}`}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[160px]">
                  <p className="font-black uppercase">{p.nombre}</p>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{p.categoria} · alerta en {p.lowStockThreshold}</p>
                </div>
                <p className={`text-2xl font-black ${p.low ? 'text-red-600' : 'text-zinc-900'}`}>{p.stock} <span className="text-xs">UDS</span></p>
                <button
                  onClick={() => { setCountingId(countingId === p.id ? null : p.id); setCounted(''); setNote('') }}
                  className="flex items-center gap-1 px-3 py-2 border-2 border-black rounded-xl font-black uppercase text-[10px] bg-zinc-100 hover:bg-zinc-200"
                >
                  <ClipboardCheck className="w-4 h-4" /> Reportar conteo
                </button>
              </div>

              {countingId === p.id && (
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={counted}
                    onChange={(e) => setCounted(e.target.value)}
                    placeholder="Unidades contadas"
                    className="border-4 border-black rounded-xl px-3 py-2 font-bold sm:w-44"
                  />
                  <input
                    value={note}
                    maxLength={300}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Nota (opcional): vencidos, dañados…"
                    className="flex-1 border-4 border-black rounded-xl px-3 py-2 font-bold"
                  />
                  <button
                    onClick={() => submitCount(p.id)}
                    disabled={sending || counted === ''}
                    className="px-4 py-2 bg-green-600 text-white border-4 border-black rounded-xl font-black uppercase text-xs disabled:opacity-50"
                  >
                    {sending ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 text-[10px] font-bold text-zinc-500 uppercase">Vista de solo lectura. Los ajustes de stock los aprueba el administrador.</p>
    </div>
  )
}
