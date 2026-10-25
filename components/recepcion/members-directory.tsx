'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Search, Users } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Directorio de socios de recepción (F3-05): filtros por estado, búsqueda por nombre
 * y paginación desde el servidor. "Ver ficha" abre al socio como si se escaneara.
 */

type Filter = 'active' | 'expiring' | 'expired' | 'none'

interface Member {
  id: string
  username: string
  status: 'active' | 'expiring' | 'expired' | 'none'
  daysLeft: number | null
  plan: { nombre: string; expira: { seconds: number }; acompanante: { nombre: string; rutinaDias: string[] } | null } | null
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'active', label: 'Activos' },
  { id: 'expiring', label: 'Por vencer' },
  { id: 'expired', label: 'Vencidos' },
  { id: 'none', label: 'Sin plan' },
]

const BADGE: Record<Member['status'], { label: (d: number | null) => string; className: string }> = {
  active: { label: (d) => `Vigente · ${d} días`, className: 'bg-green-100 text-green-800 border-green-600' },
  expiring: { label: (d) => `Vence en ${d} ${d === 1 ? 'día' : 'días'}`, className: 'bg-yellow-100 text-yellow-800 border-yellow-600' },
  expired: { label: (d) => `Vencido hace ${Math.abs(d ?? 0)} días`, className: 'bg-red-100 text-red-700 border-red-600' },
  none: { label: () => 'Sin plan', className: 'bg-zinc-100 text-zinc-500 border-zinc-300' },
}

export function MembersDirectory({ onSelectAction }: { onSelectAction: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('active')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Búsqueda con espera corta para no consultar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim().length >= 2 ? query.trim() : ''), 400)
    return () => clearTimeout(t)
  }, [query])

  const load = useCallback(async (after: string | null) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ status: filter, limit: '50' })
      if (search) qs.set('q', search)
      if (after) qs.set('cursor', after)
      const res = await fetch(`/api/recepcion/members?${qs}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      setMembers((prev) => (after ? [...prev, ...data.members] : data.members))
      setCursor(data.nextCursor)
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo cargar el directorio.')
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => { load(null) }, [load])

  return (
    <div className="bg-white p-6 sm:p-12 border-x-4 border-b-4 border-black rounded-b-[2rem] shadow-[12px_12px_0_0_rgba(0,0,0,1)]">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-black" />
        <h2 className="font-display text-3xl uppercase italic">Directorio de Socios</h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-2 border-2 border-black rounded-lg font-black uppercase text-[10px] ${filter === f.id ? 'bg-green-600 text-white' : 'bg-white hover:bg-zinc-100'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre…"
            className="w-full pl-9 pr-3 py-2 border-2 border-black rounded-lg font-bold text-sm outline-none focus:border-green-600"
          />
        </div>
      </div>

      <div className="space-y-4">
        {members.map((user) => {
          const badge = BADGE[user.status]
          return (
            <div key={user.id} className="p-5 border-4 border-black rounded-2xl shadow-[6px_6px_0_0_rgba(0,0,0,1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-black uppercase text-xl truncate">{user.username}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {user.plan && <p className="font-label text-xs text-zinc-500 font-bold tracking-widest">{user.plan.nombre}</p>}
                  <span className={`text-[10px] font-black uppercase border-2 px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label(user.daysLeft)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {user.plan?.acompanante && (
                  <div className="bg-blue-50 border-2 border-blue-600 p-3 rounded-lg flex-1 sm:flex-none">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Acompañante</p>
                    <p className="font-bold text-sm">{user.plan.acompanante.nombre}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">Días: {user.plan.acompanante.rutinaDias?.join(', ')}</p>
                  </div>
                )}
                <button
                  onClick={() => onSelectAction(user.id)}
                  className="px-4 py-2 border-2 border-black rounded-lg font-black uppercase text-[10px] bg-black text-white hover:bg-zinc-800 whitespace-nowrap"
                >
                  Ver ficha
                </button>
              </div>
            </div>
          )
        })}

        {loading && <div className="flex justify-center py-6"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>}
        {!loading && members.length === 0 && (
          <p className="text-center font-bold text-zinc-400 py-12">No hay socios en este filtro.</p>
        )}
        {!loading && cursor && (
          <button onClick={() => load(cursor)} className="w-full py-3 border-2 border-black rounded-xl font-black uppercase text-xs bg-zinc-50 hover:bg-zinc-100">
            Cargar más
          </button>
        )}
      </div>
    </div>
  )
}
