'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Database, Download, Loader2, Play, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { MfaPanel } from '@/components/admin/mfa-panel';
import { SalesPeriodsPanel } from '@/components/admin/sales-periods-panel';

/**
 * Pestaña "Sistema" del admin: salud de dependencias (F2-10), exportes (F2-29)
 * y migraciones de datos versionadas (F2-14).
 */

interface MigrationInfo {
  id: string;
  description: string;
  lastRunAt: string | null;
  lastResult: { examined: number; changed: number } | null;
}

interface HealthInfo {
  status: 'ok' | 'degraded' | 'down';
  checks: Record<string, { ok: boolean; latencyMs?: number }>;
}

const CHECK_LABELS: Record<string, string> = {
  firestore: 'Base de datos',
  rateLimit: 'Rate limiting (Redis)',
  payments: 'Pagos',
  email: 'Correos',
  cron: 'Tareas programadas',
  config: 'Configuración',
};

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function monthStartKey() {
  return `${todayKey().slice(0, 8)}01`;
}

export function SystemTab() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [migrations, setMigrations] = useState<MigrationInfo[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [from, setFrom] = useState(monthStartKey());
  const [to, setTo] = useState(todayKey());

  const load = useCallback(async () => {
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
    fetch('/api/admin/migrations').then((r) => (r.ok ? r.json() : [])).then(setMigrations).catch(() => setMigrations([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const runMigration = async (id: string, dryRun: boolean) => {
    if (!dryRun && !confirm('¿Ejecutar la migración? Modifica datos (es idempotente y queda auditada).')) return;
    setRunning(id + (dryRun ? ':dry' : ''));
    try {
      const res = await fetch('/api/admin/migrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, dryRun }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success(`${dryRun ? 'Simulación' : 'Ejecución'}: ${data.changed} de ${data.examined} documentos ${dryRun ? 'cambiarían' : 'modificados'}.`);
      if (data.details?.length) console.info(`[migración ${id}]`, data.details);
      if (!dryRun) load();
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo ejecutar la migración.');
    } finally {
      setRunning(null);
    }
  };

  const download = (type: 'members' | 'orders' | 'entries') => {
    const params = new URLSearchParams({ type });
    if (type !== 'members') {
      params.set('from', from);
      params.set('to', to);
    }
    // Navegación directa: el navegador descarga el archivo con la cookie de sesión.
    window.location.href = `/api/admin/export?${params.toString()}`;
  };

  const card = 'bg-white border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0_0_rgba(0,0,0,1)]';

  return (
    <div className="space-y-8">
      <MfaPanel />

      <SalesPeriodsPanel />

      <div className={card}>
        <h3 className="font-black uppercase italic text-xl mb-4 flex items-center gap-2"><Activity className="w-5 h-5" /> Salud del sistema</h3>
        {!health ? (
          <p className="text-sm font-bold text-zinc-400">No se pudo consultar el estado.</p>
        ) : (
          <>
            <p className={`inline-block mb-4 px-3 py-1 border-2 border-black rounded-lg font-black uppercase text-xs ${health.status === 'ok' ? 'bg-green-400' : health.status === 'degraded' ? 'bg-yellow-300' : 'bg-red-500 text-white'}`}>
              {health.status === 'ok' ? 'Todo operativo' : health.status === 'degraded' ? 'Degradado' : 'Caído'}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {Object.entries(health.checks).map(([key, c]) => (
                <div key={key} className={`border-2 border-black rounded-xl p-3 ${c.ok ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-[10px] font-black uppercase">{CHECK_LABELS[key] || key}</p>
                  <p className={`font-black ${c.ok ? 'text-green-700' : 'text-red-600'}`}>{c.ok ? 'OK' : 'Falla / sin configurar'}</p>
                  {c.latencyMs !== undefined && <p className="text-[10px] font-bold text-zinc-500">{c.latencyMs} ms</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={card}>
        <h3 className="font-black uppercase italic text-xl mb-4 flex items-center gap-2"><Download className="w-5 h-5" /> Exportar datos (CSV)</h3>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="text-[10px] font-black uppercase">Desde
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="block border-2 border-black rounded-lg px-2 py-1 font-bold" />
          </label>
          <label className="text-[10px] font-black uppercase">Hasta
            <input type="date" value={to} min={from} max={todayKey()} onChange={(e) => setTo(e.target.value)} className="block border-2 border-black rounded-lg px-2 py-1 font-bold" />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => download('members')} className="px-4 py-2 border-4 border-black rounded-xl font-black uppercase text-xs bg-zinc-100 hover:bg-zinc-200">Socios (todos)</button>
          <button onClick={() => download('orders')} className="px-4 py-2 border-4 border-black rounded-xl font-black uppercase text-xs bg-zinc-100 hover:bg-zinc-200">Ventas del rango</button>
          <button onClick={() => download('entries')} className="px-4 py-2 border-4 border-black rounded-xl font-black uppercase text-xs bg-zinc-100 hover:bg-zinc-200">Ingresos del rango (máx. 92 días)</button>
        </div>
        <p className="mt-3 text-[10px] font-bold text-zinc-500">Contienen datos personales: guárdalos en un lugar seguro. Cada descarga queda en auditoría.</p>
      </div>

      <div className={card}>
        <h3 className="font-black uppercase italic text-xl mb-4 flex items-center gap-2"><Database className="w-5 h-5" /> Migraciones de datos</h3>
        <div className="space-y-3">
          {migrations.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 border-2 border-black rounded-xl p-3">
              <div className="flex-1 min-w-[220px]">
                <p className="font-black text-sm">{m.id}</p>
                <p className="text-[11px] font-bold text-zinc-600">{m.description}</p>
                <p className="text-[10px] font-bold text-zinc-400">
                  {m.lastRunAt ? `Última ejecución: ${new Date(m.lastRunAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · ${m.lastResult?.changed ?? 0} cambios` : 'Nunca ejecutada'}
                </p>
              </div>
              <button
                onClick={() => runMigration(m.id, true)}
                disabled={!!running}
                className="flex items-center gap-1 px-3 py-2 border-2 border-black rounded-lg font-black uppercase text-[10px] bg-white disabled:opacity-50"
              >
                {running === `${m.id}:dry` ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />} Simular
              </button>
              <button
                onClick={() => runMigration(m.id, false)}
                disabled={!!running}
                className="flex items-center gap-1 px-3 py-2 border-2 border-black rounded-lg font-black uppercase text-[10px] bg-red-600 text-white disabled:opacity-50"
              >
                {running === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Ejecutar
              </button>
            </div>
          ))}
          {migrations.length === 0 && <p className="text-sm font-bold text-zinc-400">Sin migraciones disponibles.</p>}
        </div>
      </div>
    </div>
  );
}
