'use client';

import { Users, MessageSquare, CreditCard, CheckCircle, AlertTriangle, CalendarDays } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/admin-format';

// F3-21: pestaña "Resumen" extraída de app/fitministration/page.tsx (sin cambios de lógica).
export function OverviewTab({ usersList, ordersList, pqrsList, productsList, setActiveTab, handleUpdateStock }: {
  usersList: any[];
  ordersList: any[];
  pqrsList: any[];
  productsList: any[];
  setActiveTab: (tab: string) => void;
  handleUpdateStock: (id: string, newStock: number) => void;
}) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Acceso a Asistencia también en móvil (la barra lateral solo existe en escritorio). */}
      <button
        onClick={() => setActiveTab('attendance')}
        className="md:hidden w-full flex items-center justify-center gap-2 bg-red-600 text-white border-4 border-black rounded-2xl p-4 font-black uppercase shadow-[6px_6px_0_0_rgba(0,0,0,1)]"
      >
        <CalendarDays className="w-5 h-5" /> Ver asistencia y concurrencia
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Usuarios', val: usersList.length, color: 'bg-blue-500', icon: Users },
          { label: 'Ingresos', val: formatCurrency(ordersList.reduce((acc, o) => acc + (o.total || 0), 0)), color: 'bg-green-500', icon: CreditCard },
          { label: 'PQRS Pend.', val: pqrsList.filter(p => p.estado !== 'resuelto').length, color: 'bg-yellow-400', icon: MessageSquare },
          { label: 'Admins', val: usersList.filter(u => u.admin).length, color: 'bg-purple-500', icon: CheckCircle },
        ].map((card, i) => (
          <div key={i} className="bg-white border-4 border-black p-6 rounded-2xl shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:-translate-x-1 hover:-translate-y-1 transition-all group">
            <div className={`p-3 w-12 h-12 rounded-xl mb-4 border-2 border-black ${card.color} flex items-center justify-center shadow-[3px_3px_0_0_rgba(0,0,0,1)] group-hover:rotate-12 transition-transform`}>
              <card.icon className="w-6 h-6 text-white" />
            </div>
            <h4 className="font-black uppercase text-zinc-400 text-[10px] tracking-widest">{card.label}</h4>
            <span className="text-3xl font-black tracking-tighter italic" style={{ fontFamily: 'var(--font-display)' }}>{card.val}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="bg-white border-4 border-black rounded-[2rem] shadow-[8px_8px_0_0_rgba(0,0,0,1)] overflow-hidden">
          <div className="p-6 border-b-4 border-black bg-zinc-50 flex justify-between items-center">
            <h3 className="font-black italic uppercase italic tracking-tighter">Ventas Recientes</h3>
            <button onClick={() => setActiveTab('orders')} className="text-xs font-black underline hover:text-red-600 transition-colors">VER TODO</button>
          </div>
          <div className="p-4 space-y-4">
            {ordersList.slice(0, 5).map(order => (
              <div key={order.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-4 border-2 border-zinc-100 rounded-xl hover:bg-zinc-50 transition-colors">
                <div>
                  <p className="font-black text-sm">{order.customerName}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">{formatDate(order.fecha)}</p>
                </div>
                <p className="font-black text-green-600 sm:text-right">{formatCurrency(order.total || 0)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-zinc-900 border-4 border-black rounded-[2rem] shadow-[8px_8px_0_0_rgba(0,0,0,0.1)] p-8 text-white">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="text-yellow-400 w-8 h-8" />
            <h3 className="text-2xl font-black italic tracking-tighter text-red-500 uppercase">Alertas Críticas</h3>
          </div>
          <div className="space-y-4">
            {productsList.filter(p => p.stock <= (p.lowStockThreshold ?? 5)).map(p => (
              <div key={p.id} className="bg-zinc-800 p-4 rounded-xl border-l-4 border-yellow-500 flex justify-between items-center animate-shake">
                <div>
                  <p className="font-black text-sm uppercase">{p.nombre}</p>
                  <p className="text-xs text-zinc-500">Solo quedan {p.stock} unidades</p>
                </div>
                <button onClick={() => handleUpdateStock(p.id, p.stock + 20)} className="text-[10px] font-black underline hover:text-yellow-400">SURTIR +20</button>
              </div>
            ))}
            {productsList.filter(p => p.stock <= (p.lowStockThreshold ?? 5)).length === 0 && <p className="text-zinc-600 font-bold italic">No hay alertas de inventario por ahora.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
