'use client';

import { toast } from 'sonner';
import { ShoppingBag } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/admin-format';
import type { SetConfirm } from '@/components/admin/tabs/types';

// F3-21: pestaña "Compras" extraída de app/fitministration/page.tsx (sin cambios de lógica).
export function OrdersTab({ ordersList, setOrdersList, setConfirmModal }: {
  ordersList: any[];
  setOrdersList: (orders: any[]) => void;
  setConfirmModal: SetConfirm;
}) {
  const handleExportOrdersCSV = () => {
    const headers = ['Cliente,Fecha,Banco,Total,Items'];
    const rows = ordersList.map(o => [
      `"${o.customerName || 'N/A'}"`,
      `"${formatDate(o.fecha)}"`,
      `"${o.banco || (o.channel === 'pos' ? `Mostrador (${o.paymentMethod})` : 'N/A')}"`,
      `"${o.total || 0}"`,
      `"${(o.items || []).map((i:any) => i.nombre).join(' | ')}"`
    ].join(','));

    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "fitmania_ventas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleArchiveSales = async () => {
    setConfirmModal({
      isOpen: true,
      title: "ARCHIVAR CAJA DEL MES",
      message: "¡ALTO! ¿Deseas hacer un corte de caja? Esto enviará todas las ventas visibles al archivo histórico y el contador de ingresos quedará en $0 para iniciar un nuevo mes. Los datos NO se borrarán de Firebase.",
      onConfirm: async () => {
        // La cookie HttpOnly se envía automáticamente — no se necesita el token en el body
        const res = await fetch(`/api/admin/archive-sales`, { method: 'POST' });

        if (res.ok) {
          toast.success("Corte de caja exitoso. Archivo guardado.");
          setOrdersList([]);
        } else {
          toast.error("Error al archivar la caja.");
        }
      }
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-600">
      <div className="bg-white p-6 sm:p-8 border-4 border-black rounded-[2rem] shadow-[6px_6px_0_0_rgba(0,0,0,1)] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex-1">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Historial de Ventas</h2>
          <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Transacciones y pedidos actuales</p>
        </div>

        <div className="flex flex-wrap gap-4 items-center w-full lg:w-auto">
          <button onClick={handleExportOrdersCSV} className="flex-1 sm:flex-none border-2 border-black bg-white hover:bg-zinc-100 text-[10px] font-black tracking-widest uppercase p-3 rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,1)] transition-all active:translate-y-1">
            📊 EXCEL / CSV
          </button>
          <button onClick={handleArchiveSales} className="flex-1 sm:flex-none border-2 border-black bg-red-600 text-white hover:bg-red-700 text-[10px] font-black tracking-widest uppercase p-3 rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,1)] transition-all active:translate-y-1">
            Archivar y Resetear Caja
          </button>

          <div className="bg-zinc-900 border-2 border-black p-4 rounded-xl text-white w-full sm:w-auto text-center sm:text-left mt-2 sm:mt-0">
            <p className="text-[10px] font-bold text-zinc-500 uppercase italic">Recaudado (Total Més)</p>
            <p className="text-2xl font-black text-green-400 truncate max-w-full">{formatCurrency(ordersList.reduce((acc, o) => acc + (o.total || 0), 0))}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {ordersList.map(order => (
          <div key={order.id} className="bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0_0_rgba(0,0,0,1)] overflow-hidden">
            <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-zinc-50 border-b-2 border-zinc-100">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="w-12 h-12 bg-zinc-900 border-2 border-black rounded-xl flex items-center justify-center text-white shrink-0"><ShoppingBag /></div>
                <div className="min-w-0">
                  <p className="font-black uppercase text-sm truncate">{order.customerName}</p>
                  <p className="text-xs text-zinc-400 font-bold font-mono uppercase tracking-tighter truncate">ID: {order.id.slice(0, 12)}...</p>
                </div>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap gap-4 sm:gap-8 items-center text-left sm:text-center w-full sm:w-auto mt-4 sm:mt-0">
                <div className="flex-1 sm:flex-none"><p className="text-[10px] font-black uppercase text-zinc-400">Fecha</p><p className="text-sm font-bold truncate">{formatDate(order.fecha)}</p></div>
                <div className="flex-1 sm:flex-none"><p className="text-[10px] font-black uppercase text-zinc-400">Banco</p><p className="text-sm font-bold truncate">{order.banco}</p></div>
                <div className="w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t-2 sm:border-t-0 border-zinc-200"><p className="text-[10px] font-black uppercase text-zinc-400">Total</p><p className="text-lg sm:text-xl font-black text-red-600 italic tracking-tighter truncate">{formatCurrency(order.total || 0)}</p></div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-[10px] font-black uppercase text-zinc-400 mb-4 tracking-widest">Artículos Comprados:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {order.items?.map((it: any, idx: number) => (
                  <div key={idx} className="bg-zinc-50 border-2 border-black p-3 rounded-lg relative overflow-hidden">
                    <p className="text-xs font-black uppercase mb-1">{it.nombre}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Cantidad: {it.cantidad} | {formatCurrency(it.precio)} c/u</p>
                    <div className="absolute -right-1 -bottom-1 text-2xl opacity-10 font-black">{idx + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {ordersList.length === 0 && <div className="text-center py-20 text-zinc-300 font-black italic uppercase text-2xl opacity-20 border-4 border-black border-dashed rounded-[2rem]">Sin registro de ventas</div>}
      </div>
    </div>
  );
}
