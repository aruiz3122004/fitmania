'use client'

import { useState, useEffect, useCallback } from 'react'
import { CalendarDays, Download, FileJson, FileSpreadsheet, ChevronLeft, ChevronRight, Clock, Mail, UserCircle, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { es } from 'date-fns/locale'

interface EntryLog {
  id: string
  userId: string
  userName: string
  userEmail: string
  hasPlanActivo: boolean
  planNombre: string | null
  timestamp: string
  date: string
}

interface EntryHistoryTabProps {
  // No props needed currently
}

export default function EntryHistoryTab({}: EntryHistoryTabProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [entries, setEntries] = useState<EntryLog[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(100) // Cambiado a 100 para paginación dinámica
  const [daysWithEntries, setDaysWithEntries] = useState<string[]>([])
  const [exporting, setExporting] = useState<string | null>(null) // 'json' | 'excel'

  // Formatear fecha a YYYY-MM-DD en zona local
  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Cargar entradas del día seleccionado
  const fetchEntries = useCallback(async (date: Date, page: number) => {
    setLoading(true)
    try {
      const dateStr = formatDate(date)
      const res = await fetch(`/api/recepcion/entry-log?date=${dateStr}&page=${page}&pageSize=${pageSize}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries)
        setTotalPages(data.totalPages)
        setTotalCount(data.totalCount)
        setCurrentPage(data.currentPage)
      }
    } catch (err) {
      console.error('Error fetching entries:', err)
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  // Cargar días con entradas del mes visible
  const fetchDaysWithEntries = useCallback(async (month: Date) => {
    try {
      const year = month.getFullYear()
      const m = String(month.getMonth() + 1).padStart(2, '0')
      const monthStr = `${year}-${m}`

      const res = await fetch(`/api/recepcion/entry-log?action=calendar&month=${monthStr}`)
      if (res.ok) {
        const data = await res.json()
        setDaysWithEntries(data.days || [])
      }
    } catch (err) {
      console.error('Error fetching calendar days:', err)
    }
  }, [])

  useEffect(() => {
    fetchEntries(selectedDate, 1)
  }, [selectedDate, fetchEntries])

  useEffect(() => {
    fetchDaysWithEntries(selectedDate)
  }, [selectedDate, fetchDaysWithEntries])

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      setCurrentPage(1)
    }
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchEntries(selectedDate, newPage)
    }
  }

  const handleExport = async (format: 'json' | 'excel') => {
    setExporting(format)
    try {
      const dateStr = formatDate(selectedDate)
      const res = await fetch(`/api/recepcion/entry-log?date=${dateStr}&format=${format}`)
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'json' ? `entradas_${dateStr}.json` : `entradas_${dateStr}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting:', err)
    } finally {
      setExporting(null)
    }
  }

  // Resaltar días con entradas en el calendario
  const modifiers = {
    hasEntries: daysWithEntries.map(d => {
      const [y, m, day] = d.split('-').map(Number)
      return new Date(y, m - 1, day)
    }),
  }

  const modifiersStyles = {
    hasEntries: {
      backgroundColor: 'rgb(22 163 74 / 0.15)',
      borderRadius: '50%',
      fontWeight: 900,
    },
  }

  return (
    <div className="bg-white p-6 sm:p-10 border-x-4 border-b-4 border-black rounded-b-[2rem] shadow-[12px_12px_0_0_rgba(0,0,0,1)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-8 h-8 text-black" />
          <div>
            <h2 className="font-display text-2xl sm:text-3xl uppercase italic leading-none">Historial de Entradas</h2>
            <p className="font-label text-[10px] uppercase tracking-[3px] text-zinc-400 mt-1">Registro diario de ingresos</p>
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('json')}
            disabled={exporting !== null || totalCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white font-label text-[10px] font-black uppercase tracking-widest rounded-xl border-2 border-black hover:bg-zinc-700 transition-colors disabled:opacity-40 shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
          >
            {exporting === 'json' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5" />}
            JSON
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={exporting !== null || totalCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-700 text-white font-label text-[10px] font-black uppercase tracking-widest rounded-xl border-2 border-black hover:bg-green-600 transition-colors disabled:opacity-40 shadow-[3px_3px_0_0_rgba(22,163,74,1)]"
          >
            {exporting === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12">
        {/* Calendar */}
        <div className="bg-zinc-50 border-4 border-black rounded-2xl p-4 shadow-[6px_6px_0_0_rgba(0,0,0,1)] self-start">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            locale={es}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="!font-sans"
            classNames={{
              day: 'w-10 h-10 flex items-center justify-center text-sm font-bold cursor-pointer rounded-full hover:bg-green-100 transition-colors',
              selected: '!bg-green-600 !text-white !rounded-full !font-black',
              today: 'border-2 border-green-600 rounded-full font-black',
              month_caption: 'font-display text-lg uppercase italic text-center mb-4',
              nav: 'flex justify-between mb-2',
              weekday: 'text-[10px] font-black uppercase text-zinc-400 tracking-wider',
            }}
          />
          {/* Stats mini */}
          <div className="mt-4 pt-4 border-t-4 border-dashed border-zinc-200">
            <div className="flex items-center justify-between">
              <span className="font-label text-[10px] font-black uppercase text-zinc-400 tracking-wider">Entradas del día</span>
              <span className="font-display text-2xl italic text-green-700">{totalCount}</span>
            </div>
          </div>
        </div>

        {/* Table + Pagination */}
        <div>
          {/* Date header */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b-4 border-dashed border-zinc-200">
            <div className="w-10 h-10 bg-green-600 border-2 border-black rounded-xl flex items-center justify-center text-white font-black text-sm shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
              {selectedDate.getDate()}
            </div>
            <div>
              <p className="font-black uppercase text-sm leading-none">
                {selectedDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="font-label text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">{totalCount} registro(s) encontrado(s)</p>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
              <span className="ml-3 font-label text-xs font-black uppercase text-zinc-400 tracking-widest">Cargando registros...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-zinc-100 rounded-2xl border-4 border-dashed border-zinc-300 flex items-center justify-center mb-4">
                <CalendarDays className="w-10 h-10 text-zinc-300" />
              </div>
              <p className="font-black uppercase text-zinc-400 text-sm">Sin registros este día</p>
              <p className="font-label text-[10px] text-zinc-300 uppercase tracking-widest mt-1">Selecciona otra fecha en el calendario</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-4 border-black">
                      <th className="text-left font-label text-[10px] font-black uppercase tracking-widest text-zinc-400 py-3 px-2">Hora</th>
                      <th className="text-left font-label text-[10px] font-black uppercase tracking-widest text-zinc-400 py-3 px-2">Usuario</th>
                      <th className="text-left font-label text-[10px] font-black uppercase tracking-widest text-zinc-400 py-3 px-2">Correo</th>
                      <th className="text-center font-label text-[10px] font-black uppercase tracking-widest text-zinc-400 py-3 px-2">Plan Activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, i) => {
                      const time = entry.timestamp
                        ? new Date(entry.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'N/A'
                      return (
                        <tr
                          key={entry.id}
                          className={`border-b-2 border-zinc-100 hover:bg-green-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}`}
                        >
                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-zinc-400" />
                              <span className="font-bold text-sm text-zinc-700">{time}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-2">
                              <UserCircle className="w-4 h-4 text-zinc-400" />
                              <span className="font-black text-sm uppercase">{entry.userName}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-zinc-400" />
                              <span className="font-bold text-xs text-zinc-500">{entry.userEmail}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 text-center">
                            {entry.hasPlanActivo ? (
                              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 border-2 border-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                <ShieldCheck className="w-3 h-3" /> Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border-2 border-red-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                <ShieldOff className="w-3 h-3" /> Inactivo
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {entries.map((entry) => {
                  const time = entry.timestamp
                    ? new Date(entry.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                    : 'N/A'
                  return (
                    <div key={entry.id} className="p-4 border-3 border-black rounded-xl shadow-[4px_4px_0_0_rgba(0,0,0,1)] bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-sm uppercase">{entry.userName}</span>
                        {entry.hasPlanActivo ? (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 border border-green-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">
                            <ShieldCheck className="w-2.5 h-2.5" /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">
                            <ShieldOff className="w-2.5 h-2.5" /> Inactivo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{time}</span>
                        <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{entry.userEmail}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t-4 border-dashed border-zinc-200">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="flex items-center gap-1 px-4 py-2.5 font-label text-xs font-black uppercase tracking-wider bg-zinc-100 border-2 border-black rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="font-label text-[10px] font-black uppercase text-zinc-400 tracking-widest">Página</span>
                    <span className="font-display text-xl italic text-green-700">{currentPage}</span>
                    <span className="font-label text-[10px] font-black uppercase text-zinc-400 tracking-widest">de {totalPages}</span>
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="flex items-center gap-1 px-4 py-2.5 font-label text-xs font-black uppercase tracking-wider bg-green-600 text-white border-2 border-black rounded-xl hover:bg-green-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
                  >
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
