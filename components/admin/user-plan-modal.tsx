'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

// F3-21: extraído de app/fitministration/page.tsx (sin cambios de lógica).
export const UserPlanModal = ({ isOpen, onClose, user, onSave }: any) => {
  const [inicio, setInicio] = useState('');
  const [expira, setExpira] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.plan) {
      // Formatear fechas para input type="date" (YYYY-MM-DD)
      const formatDateForInput = (dateVal: any) => {
        if (!dateVal) return '';
        let d: Date;
        if (dateVal.seconds) d = new Date(dateVal.seconds * 1000);
        else d = new Date(dateVal);
        const month = '' + (d.getMonth() + 1);
        const day = '' + d.getDate();
        const year = d.getFullYear();
        return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
      };
      setInicio(formatDateForInput(user.plan.inicio));
      setExpira(formatDateForInput(user.plan.expira));
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave(user.uid, {
      ...user.plan,
      inicio: new Date(inicio + 'T00:00:00'),
      expira: new Date(expira + 'T00:00:00'),
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white border-4 border-black rounded-[2rem] shadow-[12px_12px_0_0_rgba(0,0,0,1)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-zinc-900 p-6 border-b-4 border-black flex justify-between items-center">
          <div>
            <h3 className="text-white text-xl font-black uppercase italic italic tracking-tighter">Editar Membresía</h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{user.displayName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2 tracking-widest">Fecha de Inicio</label>
              <input
                type="date"
                required
                className="w-full p-4 bg-zinc-50 border-3 border-black rounded-xl font-bold focus:bg-white outline-none"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2 tracking-widest">Fecha de Expiración</label>
              <input
                type="date"
                required
                className="w-full p-4 bg-zinc-50 border-3 border-black rounded-xl font-bold focus:bg-white outline-none"
                value={expira}
                onChange={(e) => setExpira(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 font-black uppercase text-xs border-3 border-black rounded-xl hover:bg-zinc-100 transition-all">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-4 bg-black text-white font-black uppercase text-xs border-b-4 border-zinc-950 rounded-xl hover:-translate-y-1 transition-all disabled:opacity-50">
              {loading ? 'Guardando...' : 'Actualizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- MAIN PAGE ---
