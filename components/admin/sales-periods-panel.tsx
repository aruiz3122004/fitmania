'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';

/** Cierres mensuales de ventas (F2-24): resúmenes inmutables sin tocar las órdenes. */
interface Period {
  month: string;
  orders: number;
  plans: { count: number; total: number };
  web: { count: number; total: number };
  pos: { count: number; total: number; byMethod: Record<string, number> };
  refunds: number;
  gross: number;
  net: number;
  closedAt: string | null;
  closedBy: string | null;
}

const cop = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

function previousMonth() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const [y, m] = today.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function SalesPeriodsPanel() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [month, setMonth] = useState(previousMonth());
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch('/api/admin/sales-periods').then((r) => (r.ok ? r.json() : [])).then(setPeriods).catch(() => setPeriods([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const close = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/sales-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success(`Cierre ${month}: neto ${cop(data.net)}.`);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo calcular el cierre.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
      <h3 className="font-black uppercase italic text-xl mb-4 flex items-center gap-2"><CalendarCheck className="w-5 h-5" /> Cierres mensuales de ventas</h3>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-[10px] font-black uppercase">Mes
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="block border-2 border-black rounded-lg px-2 py-1 font-bold" />
        </label>
        <button onClick={close} disabled={busy || !month} className="px-4 py-2 bg-black text-white border-4 border-black rounded-xl font-black uppercase text-xs disabled:opacity-50">
          {busy ? 'Calculando…' : 'Calcular cierre'}
        </button>
        <p className="text-[10px] font-bold text-zinc-500">No modifica las órdenes; se puede recalcular si llegan reembolsos tardíos.</p>
      </div>
      {periods.length === 0 ? (
        <p className="text-sm font-bold text-zinc-400">Aún no hay cierres.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase text-zinc-500">
                <th className="p-2">Mes</th><th className="p-2">Planes</th><th className="p-2">Tienda web</th><th className="p-2">Mostrador</th><th className="p-2">Reembolsos</th><th className="p-2">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-zinc-100">
              {periods.map((p) => (
                <tr key={p.month} className="font-bold">
                  <td className="p-2 font-black">{p.month}</td>
                  <td className="p-2">{cop(p.plans.total)} <span className="text-zinc-400">({p.plans.count})</span></td>
                  <td className="p-2">{cop(p.web.total)} <span className="text-zinc-400">({p.web.count})</span></td>
                  <td className="p-2" title={`Efectivo ${cop(p.pos.byMethod.efectivo)} · Datáfono ${cop(p.pos.byMethod.datafono)} · Transferencia ${cop(p.pos.byMethod.transferencia)}`}>{cop(p.pos.total)} <span className="text-zinc-400">({p.pos.count})</span></td>
                  <td className="p-2 text-red-600">{cop(p.refunds)}</td>
                  <td className="p-2 font-black text-green-700">{cop(p.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
