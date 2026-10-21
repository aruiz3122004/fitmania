'use client'

import { useEffect, useState } from 'react'
import { FileText, Printer } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Carga de ingresos anotados en la planilla en papel (F2-07, plan B).
 * Se registran con su hora real (`source: 'manual'`, hasta 7 días atrás) y un
 * `clientId` único, así que un doble envío no duplica el ingreso.
 */
interface MemberOption { id: string; username: string }

function localDateTimeNow() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function ManualEntryForm({ members }: { members: MemberOption[] }) {
  const [userId, setUserId] = useState('')
  const [when, setWhen] = useState(localDateTimeNow())
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => { setWhen(localDateTimeNow()) }, [])

  const filtered = filter
    ? members.filter((m) => m.username.toLowerCase().includes(filter.toLowerCase())).slice(0, 50)
    : members.slice(0, 50)

  const submit = async () => {
    if (!userId || !when) return
    setSending(true)
    try {
      const res = await fetch('/api/recepcion/entry-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          source: 'manual',
          occurredAt: new Date(when).toISOString(),
          clientId: crypto.randomUUID(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        toast.warning(data.error || 'Ese ingreso ya estaba registrado.')
      } else if (!res.ok) {
        throw new Error(data.error)
      } else {
        toast.success(data.hasPlanActivo ? 'Ingreso de planilla registrado.' : 'Registrado (el socio no tiene plan activo).')
        setUserId('')
      }
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo registrar el ingreso.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="w-full mb-8 border-4 border-black rounded-2xl p-5 bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-black uppercase italic text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Cargar planilla en papel</h3>
        <a href="/planilla-ingresos" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-2 border-2 border-black rounded-lg font-black uppercase text-[10px] bg-zinc-100">
          <Printer className="w-3 h-3" /> Imprimir planilla
        </a>
      </div>
      <p className="text-[11px] font-bold text-zinc-500 mb-3">Si el sistema no estuvo disponible, registra aquí cada ingreso anotado con su hora real (máximo 7 días atrás).</p>
      <div className="flex flex-col md:flex-row gap-3">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar socio…" className="md:w-48 border-2 border-black rounded-xl px-3 py-2 font-bold text-sm" />
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="flex-1 border-2 border-black rounded-xl px-3 py-2 font-bold text-sm">
          <option value="">Selecciona el socio…</option>
          {filtered.map((m) => <option key={m.id} value={m.id}>{m.username}</option>)}
        </select>
        <input type="datetime-local" value={when} max={localDateTimeNow()} onChange={(e) => setWhen(e.target.value)} className="border-2 border-black rounded-xl px-3 py-2 font-bold text-sm" />
        <button onClick={submit} disabled={sending || !userId} className="px-4 py-2 bg-black text-white border-2 border-black rounded-xl font-black uppercase text-xs disabled:opacity-50">
          {sending ? 'Guardando…' : 'Registrar'}
        </button>
      </div>
    </div>
  )
}
