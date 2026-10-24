'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X, CreditCard, AlertTriangle } from 'lucide-react';

// F3-21: extraído de app/fitministration/page.tsx (sin cambios de lógica).
export const NotificationBell = ({ notifications, onMarkRead, onNavigate }: any) => {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n: any) => !n.leido).length;

  useEffect(() => {
    const handleScroll = () => {
      if (open) setOpen(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 bg-white border-3 border-black rounded-lg shadow-[3px_3px_0_0_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none transition-all"
      >
        <Bell className="w-6 h-6 text-black" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-black animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 sm:absolute sm:inset-auto sm:right-[-2.5rem] mt-4 w-auto sm:w-[350px] bg-white border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] z-[100] rounded-xl overflow-hidden origin-top-right sm:origin-top-right">
          <div className="bg-zinc-900 p-4 border-b-4 border-black flex justify-between items-center">
            <h3 className="text-white font-black uppercase text-sm tracking-widest">Notificaciones</h3>
            <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-white" /></button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-8 text-center text-zinc-400 font-bold italic">Todo despejado, jefe.</p>
            ) : (
              notifications.map((n: any) => (
                <div
                  key={n.id}
                  className={`p-4 border-b-2 border-zinc-100 cursor-pointer transition-colors ${!n.leido ? 'bg-yellow-50 hover:bg-yellow-100' : 'opacity-60 hover:bg-zinc-50'}`}
                  onClick={() => {
                    onMarkRead(n.id);
                    if (n.tipo === 'low_stock' || n.tipo === 'inventory_count' || n.tipo === 'oversell') onNavigate('inventory');
                    if (n.tipo === 'purchase') onNavigate('orders');
                    if (n.tipo === 'pqrs') onNavigate('pqrs');
                    if (n.tipo === 'payment_alert' || n.tipo === 'refund') onNavigate('payments');
                    setOpen(false);
                  }}
                >
                  <p className="text-[10px] font-black uppercase mb-1 flex items-center gap-1">
                    {n.tipo === 'low_stock' && <AlertTriangle className="w-3 h-3 text-red-600" />}
                    {n.tipo === 'purchase' && <CreditCard className="w-3 h-3 text-green-600" />}
                    {n.tipo === 'low_stock' ? 'Stock Bajo' : n.tipo === 'purchase' ? 'Compra' : n.tipo === 'inventory_count' ? 'Conteo de recepción' : n.tipo === 'oversell' ? 'Sobreventa' : n.tipo === 'payment_alert' ? 'Pago por revisar' : n.tipo === 'refund' ? 'Reembolso' : 'Alerta'}
                  </p>
                  <p className="text-sm font-bold text-zinc-800 leading-tight">{n.mensaje}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
