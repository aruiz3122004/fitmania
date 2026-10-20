'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Check, X } from 'lucide-react';
import { toast } from 'sonner';

/** Conteos físicos reportados por recepción pendientes de aprobación (F3-07). */
interface PendingCount {
  id: string;
  productName: string;
  counted: number;
  systemStock: number;
  difference: number;
  note: string | null;
  reportedBy: string | null;
  createdAt: string | null;
}

export function InventoryCountsPanel({ onApplied }: { onApplied: () => void }) {
  const [counts, setCounts] = useState<PendingCount[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/inventory-counts');
      if (res.ok) setCounts(await res.json());
    } catch {
      // Panel secundario: sin conteos visibles si falla.
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const review = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/inventory-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success(action === 'approve' ? 'Stock ajustado al conteo.' : 'Conteo descartado.');
      setCounts((prev) => prev.filter((c) => c.id !== id));
      if (action === 'approve') onApplied();
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo procesar el conteo.');
    } finally {
      setBusyId(null);
    }
  };

  if (counts.length === 0) return null;

  return (
    <div className="bg-yellow-50 border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
      <h3 className="font-black uppercase italic text-xl mb-4 flex items-center gap-2">
        <ClipboardCheck className="w-5 h-5" /> Conteos de recepción pendientes ({counts.length})
      </h3>
      <div className="space-y-3">
        {counts.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 bg-white border-2 border-black rounded-xl p-3">
            <div className="flex-1 min-w-[180px]">
              <p className="font-black uppercase text-sm">{c.productName}</p>
              <p className="text-[11px] font-bold text-zinc-600">
                Contado: <b>{c.counted}</b> · Sistema: <b>{c.systemStock}</b> ·{' '}
                <span className={c.difference === 0 ? 'text-zinc-500' : c.difference > 0 ? 'text-green-700' : 'text-red-600'}>
                  {c.difference > 0 ? '+' : ''}{c.difference}
                </span>
              </p>
              <p className="text-[10px] font-bold text-zinc-500">
                {c.reportedBy || 'Recepción'}{c.createdAt ? ` · ${new Date(c.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}` : ''}
                {c.note ? ` · “${c.note}”` : ''}
              </p>
            </div>
            <button
              onClick={() => review(c.id, 'approve')}
              disabled={busyId === c.id}
              className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white border-2 border-black rounded-lg font-black uppercase text-[10px] disabled:opacity-50"
            >
              <Check className="w-3 h-3" /> Aplicar
            </button>
            <button
              onClick={() => review(c.id, 'reject')}
              disabled={busyId === c.id}
              className="flex items-center gap-1 px-3 py-2 bg-white border-2 border-black rounded-lg font-black uppercase text-[10px] disabled:opacity-50"
            >
              <X className="w-3 h-3" /> Descartar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
