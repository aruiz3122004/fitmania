'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/admin-format';

/**
 * Pestaña "Pagos" del admin: pagos de Mercado Pago que no llegaron a orden
 * (pendientes, rechazados, monto alterado, vencidos) y reembolsos. Permite
 * conciliar uno a mano con Mercado Pago (F1-22).
 */

interface PaymentRow {
  id: string;
  status: string;
  type: 'plan' | 'products';
  concept: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  method: string | null;
  mpPaymentId: number | null;
  mpStatus: string | null;
  items: { id: string; nombre: string; cantidad: number }[];
  createdAt: string | null;
}

const FILTERS: { id: string; label: string; statuses: string }[] = [
  { id: 'open', label: 'Por revisar', statuses: 'pending,rejected,amount_mismatch' },
  { id: 'pending', label: 'Pendientes', statuses: 'pending' },
  { id: 'rejected', label: 'Rechazados', statuses: 'rejected' },
  { id: 'amount_mismatch', label: 'Monto alterado', statuses: 'amount_mismatch' },
  { id: 'expired', label: 'Vencidos', statuses: 'expired' },
  { id: 'refunded', label: 'Reembolsos', statuses: 'refunded,charged_back' },
];

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-yellow-300' },
  rejected: { label: 'Rechazado', className: 'bg-zinc-300' },
  amount_mismatch: { label: 'Monto alterado', className: 'bg-red-600 text-white' },
  expired: { label: 'Vencido', className: 'bg-zinc-200' },
  refunded: { label: 'Reembolsado', className: 'bg-blue-300' },
  charged_back: { label: 'Contracargo', className: 'bg-red-400' },
  approved: { label: 'Aprobado', className: 'bg-green-400' },
};

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }) : 'N/A';

export function PaymentsTab() {
  const [filter, setFilter] = useState(FILTERS[0]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payments?status=${filter.statuses}`);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error);
      setPayments(data);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudieron cargar los pagos.');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const reconcile = async (ref: string) => {
    setReconciling(ref);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      const label = STATUS_STYLE[data.status]?.label || data.status;
      toast.success(data.results?.length ? `Consultado en Mercado Pago: ${label}.` : `Mercado Pago no tiene pagos para esta referencia (${label}).`);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo conciliar el pago.');
    } finally {
      setReconciling(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-600">
      <div className="bg-white p-6 sm:p-8 border-4 border-black rounded-[2rem] shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-6">
          <div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Pagos Mercado Pago</h2>
            <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Lo que no llegó a orden: pendientes, rechazados y alertas</p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 border-2 border-black bg-white hover:bg-zinc-100 text-[10px] font-black tracking-widest uppercase p-3 rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,1)] transition-all active:translate-y-1"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 border-2 border-black rounded-lg font-black uppercase text-[10px] ${filter.id === f.id ? 'bg-red-600 text-white' : 'bg-white hover:bg-zinc-100'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-red-600" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {payments.map((p) => {
            const style = STATUS_STYLE[p.status] || { label: p.status, className: 'bg-zinc-200' };
            return (
              <div key={p.id} className="bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0_0_rgba(0,0,0,1)] p-5 flex flex-col lg:flex-row gap-4 lg:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 border-2 border-black rounded-md font-black uppercase text-[10px] ${style.className}`}>{style.label}</span>
                    <span className="text-[10px] font-black uppercase text-zinc-400">{p.type === 'plan' ? 'Plan' : 'Productos'}</span>
                  </div>
                  <p className="font-black uppercase text-sm truncate">{p.customerName} · <span className="normal-case font-bold text-zinc-500">{p.customerEmail}</span></p>
                  <p className="text-xs font-bold text-zinc-600 truncate">
                    {p.type === 'plan' ? p.concept : p.items.map((it) => `${it.cantidad}× ${it.nombre}`).join(', ')}
                  </p>
                  <p className="text-[10px] font-bold font-mono text-zinc-400 break-all">
                    {p.id}{p.mpPaymentId ? ` · MP ${p.mpPaymentId} (${p.mpStatus})` : ''}{p.method ? ` · ${p.method}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div><p className="text-[10px] font-black uppercase text-zinc-400">Creado</p><p className="text-sm font-bold">{formatDateTime(p.createdAt)}</p></div>
                  <div><p className="text-[10px] font-black uppercase text-zinc-400">Monto</p><p className="text-lg font-black text-red-600 italic">{formatCurrency(p.amount || 0)}</p></div>
                  {(p.status === 'pending' || p.status === 'rejected' || p.status === 'expired') && (
                    <button
                      onClick={() => reconcile(p.id)}
                      disabled={!!reconciling}
                      title="Consultar el estado en Mercado Pago y aplicarlo"
                      className="flex items-center gap-1 px-3 py-2 border-2 border-black rounded-lg font-black uppercase text-[10px] bg-white hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {reconciling === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} Conciliar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {payments.length === 0 && (
            <div className="text-center py-20 text-zinc-300 font-black italic uppercase text-2xl opacity-20 border-4 border-black border-dashed rounded-[2rem]">Sin pagos en este estado</div>
          )}
        </div>
      )}
    </div>
  );
}
