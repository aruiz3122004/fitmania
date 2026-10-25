'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, Flame, Loader2, RefreshCw, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Asistencia (F3-02 mapa de concurrencia, F3-03 medias, F3-04 diario).
 * Lee los agregados `daily_stats` vía /api/admin/attendance: una lectura por día
 * del periodo, sin recorrer `entry_logs`.
 */

interface DailyStats {
  date: string;
  visits: number;
  uniqueMembers: number;
  withPlan: number;
  withoutPlan: number;
  byHour: Record<string, number>;
}

interface DiaryEntry {
  id: string;
  userName: string;
  hasPlanActivo: boolean;
  planNombre: string | null;
  hora: string;
  authorizedBy: string | null;
}

const TIME_ZONE = 'America/Bogota';
const HOURS = Array.from({ length: 18 }, (_, i) => String(i + 5).padStart(2, '0')); // 05–22
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PERIODS = [
  { weeks: 4, label: '4 semanas' },
  { weeks: 12, label: '12 semanas' },
  { weeks: 52, label: '52 semanas' },
];

/** YYYY-MM-DD en la zona del gimnasio. */
function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

function addDays(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** 0 = lunes … 6 = domingo. */
function weekdayIndex(dateKey: string): number {
  return (new Date(`${dateKey}T12:00:00Z`).getUTCDay() + 6) % 7;
}

function sum(days: DailyStats[], key: 'visits' | 'uniqueMembers') {
  return days.reduce((acc, d) => acc + d[key], 0);
}

function formatNumber(n: number, decimals = 1) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: decimals }).format(n);
}

function Delta({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return null;
  if (previous === 0) return <span className="text-[10px] font-black text-zinc-400">sin datos previos</span>;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{formatNumber(pct)}% vs periodo anterior
    </span>
  );
}

/** Socios con plan activo que no vienen hace N días (F3-26). */
function RetentionPanel() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<{ activeMembers: number; atRisk: { uid: string; username: string; email: string; plan: string; daysAbsent: number | null; expira: string | null }[] } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/retention?days=${days}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [days]);

  return (
    <div className="border-4 border-black rounded-2xl p-5 bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-black uppercase italic text-xl flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-600" /> Socios en riesgo de abandono</h3>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border-4 border-black rounded-xl px-3 py-2 font-bold text-sm">
          {[7, 14, 21, 30].map((d) => <option key={d} value={d}>{d} días sin venir</option>)}
        </select>
      </div>
      {!data ? (
        <p className="text-sm font-bold text-zinc-400">Cargando…</p>
      ) : data.atRisk.length === 0 ? (
        <p className="text-sm font-bold text-green-700 uppercase">Todos los socios activos ({data.activeMembers}) vinieron en los últimos {days} días.</p>
      ) : (
        <>
          <p className="text-xs font-bold text-zinc-600 mb-3">{data.atRisk.length} de {data.activeMembers} socios activos. Contáctalos para motivar su regreso.</p>
          <div className="divide-y-2 divide-zinc-100 max-h-80 overflow-y-auto">
            {data.atRisk.map((m) => (
              <div key={m.uid} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-bold flex-1 min-w-[140px]">{m.username}</span>
                <span className="text-[11px] font-bold text-zinc-500">{m.email}</span>
                <span className="text-[10px] font-black uppercase px-2 py-1 rounded border-2 border-red-600 text-red-700 bg-red-50">
                  {m.daysAbsent === null ? 'Nunca ha venido' : `${m.daysAbsent} días`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AttendanceTab() {
  const [weeks, setWeeks] = useState(4);
  const [days, setDays] = useState<DailyStats[]>([]);
  const [previousDays, setPreviousDays] = useState<DailyStats[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);

  const [diaryDate, setDiaryDate] = useState(todayKey());
  const [diary, setDiary] = useState<{ entries: DiaryEntry[]; totalPages: number; currentPage: number; totalCount: number } | null>(null);
  const [diaryLoading, setDiaryLoading] = useState(false);

  const loadStats = useCallback(async (periodWeeks: number) => {
    setLoading(true);
    try {
      const to = todayKey();
      const periodDays = periodWeeks * 7;
      // Para comparar se pide el doble del periodo cuando cabe en el máximo del API (366 días).
      const withPrevious = periodDays * 2 <= 366;
      const from = addDays(to, -(withPrevious ? periodDays * 2 : periodDays) + 1);
      const res = await fetch(`/api/admin/attendance?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('attendance');
      const data = await res.json();
      const all: DailyStats[] = data.days || [];
      setDays(all.slice(-periodDays));
      setPreviousDays(withPrevious ? all.slice(0, all.length - periodDays) : null);
    } catch {
      toast.error('No se pudieron cargar las estadísticas de asistencia.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDiary = useCallback(async (date: string, page = 1) => {
    setDiaryLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance?entries=1&date=${date}&page=${page}`);
      if (!res.ok) throw new Error('diary');
      setDiary(await res.json());
    } catch {
      toast.error('No se pudo cargar el diario.');
    } finally {
      setDiaryLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(weeks); }, [weeks, loadStats]);
  useEffect(() => { loadDiary(diaryDate); }, [diaryDate, loadDiary]);

  const today = days[days.length - 1];

  const summary = useMemo(() => {
    const totalVisits = sum(days, 'visits');
    const n = Math.max(1, days.length);
    const prevVisits = previousDays ? sum(previousDays, 'visits') : null;
    return {
      totalVisits,
      dailyAvg: totalVisits / n,
      weeklyAvg: totalVisits / (n / 7),
      monthlyAvg: totalVisits / (n / 30.44),
      uniqueAvg: sum(days, 'uniqueMembers') / n,
      prevDailyAvg: prevVisits !== null && previousDays ? prevVisits / Math.max(1, previousDays.length) : null,
    };
  }, [days, previousDays]);

  // Mapa de concurrencia: media de ingresos por (día de la semana, hora).
  const heatmap = useMemo(() => {
    const totals = WEEKDAYS.map(() => HOURS.map(() => 0));
    const weekdayCount = WEEKDAYS.map(() => 0);
    for (const day of days) {
      const w = weekdayIndex(day.date);
      weekdayCount[w]++;
      HOURS.forEach((h, i) => { totals[w][i] += day.byHour[h] || 0; });
    }
    const avg = totals.map((row, w) => row.map((v) => (weekdayCount[w] ? v / weekdayCount[w] : 0)));
    let max = 0;
    let peak = { w: -1, h: -1 };
    avg.forEach((row, w) => row.forEach((v, h) => { if (v > max) { max = v; peak = { w, h }; } }));
    return { avg, max, peak };
  }, [days]);

  const diaryStats = days.find((d) => d.date === diaryDate) || null;
  const lastWeekSameDay = days.find((d) => d.date === addDays(diaryDate, -7)) || null;
  const diaryPeakHour = diaryStats
    ? Object.entries(diaryStats.byHour).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const to = todayKey();
      const res = await fetch('/api/admin/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: addDays(to, -91), to }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success(`Recalculados ${data.days} días (${data.entries} ingresos).`);
      loadStats(weeks);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo recalcular.');
    } finally {
      setRebuilding(false);
    }
  };

  const cell = 'border-4 border-black rounded-2xl p-5 bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)]';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        {PERIODS.map((p) => (
          <button
            key={p.weeks}
            onClick={() => setWeeks(p.weeks)}
            className={`px-4 py-2 border-4 border-black rounded-xl font-black uppercase text-xs ${weeks === p.weeks ? 'bg-red-600 text-white' : 'bg-white hover:bg-zinc-100'}`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={handleRebuild}
          disabled={rebuilding}
          title="Recalcula los agregados de los últimos 92 días desde el registro de ingresos"
          className="ml-auto flex items-center gap-2 px-4 py-2 border-4 border-black rounded-xl font-black uppercase text-xs bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${rebuilding ? 'animate-spin' : ''}`} /> Recalcular
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 font-black uppercase text-zinc-400"><Loader2 className="w-6 h-6 animate-spin" /> Cargando asistencia…</div>
      ) : (
        <>
          {/* Indicadores */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={cell}>
              <p className="text-[10px] font-black uppercase text-zinc-500 flex items-center gap-1"><Activity className="w-3 h-3" /> Hoy</p>
              <p className="text-4xl font-black">{today?.visits ?? 0}</p>
              <p className="text-[10px] font-bold text-zinc-500">{today?.uniqueMembers ?? 0} socios distintos</p>
            </div>
            <div className={cell}>
              <p className="text-[10px] font-black uppercase text-zinc-500">Media diaria</p>
              <p className="text-4xl font-black">{formatNumber(summary.dailyAvg)}</p>
              <Delta current={summary.dailyAvg} previous={summary.prevDailyAvg} />
            </div>
            <div className={cell}>
              <p className="text-[10px] font-black uppercase text-zinc-500">Media semanal</p>
              <p className="text-4xl font-black">{formatNumber(summary.weeklyAvg, 0)}</p>
              <p className="text-[10px] font-bold text-zinc-500">Mensual ≈ {formatNumber(summary.monthlyAvg, 0)}</p>
            </div>
            <div className={cell}>
              <p className="text-[10px] font-black uppercase text-zinc-500 flex items-center gap-1"><Users className="w-3 h-3" /> Únicos / día</p>
              <p className="text-4xl font-black">{formatNumber(summary.uniqueAvg)}</p>
              <p className="text-[10px] font-bold text-zinc-500">{formatNumber(summary.totalVisits, 0)} ingresos en el periodo</p>
            </div>
          </div>

          {/* Mapa de concurrencia */}
          <div className={cell}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="font-black uppercase italic text-xl flex items-center gap-2"><Flame className="w-5 h-5 text-red-600" /> Mapa de concurrencia</h3>
              {heatmap.max > 0 && (
                <p className="text-xs font-bold text-zinc-600">
                  Pico: <span className="font-black text-red-600">{WEEKDAYS[heatmap.peak.w]} {HOURS[heatmap.peak.h]}:00</span> · {formatNumber(heatmap.max)} ingresos promedio
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-1 text-[10px]">
                <thead>
                  <tr>
                    <th />
                    {HOURS.map((h) => <th key={h} className="font-black text-zinc-500 w-8">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAYS.map((label, w) => (
                    <tr key={label}>
                      <th className="font-black text-left pr-2">{label}</th>
                      {HOURS.map((h, i) => {
                        const v = heatmap.avg[w][i];
                        const intensity = heatmap.max ? v / heatmap.max : 0;
                        const isPeak = heatmap.peak.w === w && heatmap.peak.h === i;
                        return (
                          <td
                            key={h}
                            title={`${label} ${h}:00 — ${formatNumber(v)} ingresos promedio`}
                            className={`w-8 h-8 rounded text-center font-black ${isPeak ? 'ring-4 ring-black' : ''}`}
                            style={{ backgroundColor: v ? `rgba(220, 38, 38, ${0.12 + intensity * 0.88})` : '#f4f4f5', color: intensity > 0.55 ? 'white' : '#18181b' }}
                          >
                            {v ? formatNumber(v, 0) : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[10px] font-bold text-zinc-500">Promedio de ingresos por franja horaria en el periodo seleccionado (hora de Colombia).</p>
          </div>

          {/* Hoy por hora */}
          <div className={cell}>
            <h3 className="font-black uppercase italic text-xl mb-4">Hoy por hora</h3>
            <div className="flex items-end gap-1 h-32">
              {HOURS.map((h) => {
                const v = today?.byHour[h] || 0;
                const max = Math.max(1, ...HOURS.map((x) => today?.byHour[x] || 0));
                return (
                  <div key={h} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}:00 — ${v}`}>
                    <span className="text-[9px] font-black">{v || ''}</span>
                    <div className="w-full bg-red-600 border-2 border-black rounded-t" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 4 : 0 }} />
                    <span className="text-[9px] font-bold text-zinc-500">{h}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Diario */}
      <div className={cell}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-black uppercase italic text-xl flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Diario de asistencia</h3>
          <input
            type="date"
            value={diaryDate}
            max={todayKey()}
            onChange={(e) => e.target.value && setDiaryDate(e.target.value)}
            className="border-4 border-black rounded-xl px-3 py-2 font-bold"
          />
        </div>

        {diaryStats && (
          <div className="flex flex-wrap gap-4 mb-4 text-xs font-bold">
            <span>Ingresos: <b className="font-black">{diaryStats.visits}</b></span>
            <span>Socios distintos: <b className="font-black">{diaryStats.uniqueMembers}</b></span>
            <span>Sin plan activo: <b className="font-black text-red-600">{diaryStats.withoutPlan}</b></span>
            {diaryPeakHour && <span>Hora pico: <b className="font-black">{diaryPeakHour}:00</b></span>}
            {lastWeekSameDay && (
              <span>Mismo día semana anterior: <b className="font-black">{lastWeekSameDay.visits}</b></span>
            )}
          </div>
        )}

        {diaryLoading ? (
          <div className="flex items-center gap-2 text-zinc-400 font-black uppercase text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
        ) : diary && diary.entries.length > 0 ? (
          <>
            <div className="divide-y-2 divide-zinc-100">
              {diary.entries.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="font-black w-14">{e.hora}</span>
                  <span className="font-bold flex-1 min-w-[140px]">{e.userName}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border-2 ${e.hasPlanActivo ? 'border-green-600 text-green-700 bg-green-50' : 'border-red-600 text-red-700 bg-red-50'}`}>
                    {e.hasPlanActivo ? (e.planNombre || 'Plan activo') : 'Sin plan'}
                  </span>
                  {e.authorizedBy && <span className="text-[10px] font-bold text-zinc-500">por {e.authorizedBy}</span>}
                </div>
              ))}
            </div>
            {diary.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  disabled={diary.currentPage <= 1}
                  onClick={() => loadDiary(diaryDate, diary.currentPage - 1)}
                  className="px-3 py-1 border-2 border-black rounded font-black text-xs disabled:opacity-40"
                >Anterior</button>
                <span className="text-xs font-bold">Página {diary.currentPage} de {diary.totalPages}</span>
                <button
                  disabled={diary.currentPage >= diary.totalPages}
                  onClick={() => loadDiary(diaryDate, diary.currentPage + 1)}
                  className="px-3 py-1 border-2 border-black rounded font-black text-xs disabled:opacity-40"
                >Siguiente</button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm font-bold text-zinc-400 uppercase">Sin ingresos registrados este día.</p>
        )}
      </div>

      <RetentionPanel />
    </div>
  );
}
