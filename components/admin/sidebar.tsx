'use client';

import React from 'react';
import { Users, Package, MessageSquare, TrendingUp, LogOut, CreditCard, ShoppingBag, Send, Database, CalendarDays, Settings, Wallet } from 'lucide-react';

// F3-21: extraído de app/fitministration/page.tsx (sin cambios de lógica).
export const Sidebar = ({ activeTab, setActiveTab, onLogout }: any) => {
  const menuItems = [
    { id: 'overview', icon: TrendingUp, label: 'Resumen' },
    { id: 'attendance', icon: CalendarDays, label: 'Asistencia' },
    { id: 'users', icon: Users, label: 'Usuarios' },
    { id: 'inventory', icon: Package, label: 'Inventario' },
    { id: 'planes', icon: CreditCard, label: 'Planes' },
    { id: 'pqrs', icon: MessageSquare, label: 'PQRS' },
    { id: 'community', icon: Send, label: 'Comunidad' },
    { id: 'orders', icon: ShoppingBag, label: 'Compras' },
    { id: 'payments', icon: Wallet, label: 'Pagos' },
    { id: 'audit', icon: Database, label: 'Auditoría' },
    { id: 'system', icon: Settings, label: 'Sistema' },
  ];

  return (
    <div className="w-64 bg-zinc-900 h-screen fixed left-0 top-0 border-r-4 border-black flex flex-col p-6 z-40 hidden md:flex shadow-[4px_0_0_0_rgba(0,0,0,0.2)]">
      <div className="mb-12">
        <h1 className="text-3xl font-black text-white italic tracking-tighter" style={{ fontFamily: 'var(--font-display)' }}>
          FIT<span className="text-red-600">MANIA</span>
        </h1>
        <p className="text-[10px] text-zinc-500 font-bold tracking-[3px] uppercase">Admin System</p>
      </div>

      <nav className="flex-1 space-y-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl font-black uppercase text-sm transition-all border-4 ${activeTab === item.id
              ? 'bg-red-600 text-white border-black translate-x-1 -translate-y-1 shadow-[4px_4px_0_0_rgba(255,255,255,1)]'
              : 'text-zinc-400 border-transparent hover:text-white hover:bg-zinc-800'
              }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>

      <button
        onClick={onLogout}
        className="mt-auto flex items-center gap-4 p-4 text-zinc-500 font-bold hover:text-red-500 transition-colors uppercase text-xs"
      >
        <LogOut className="w-4 h-4" />
        Salir del Panel
      </button>
    </div>
  );
};
