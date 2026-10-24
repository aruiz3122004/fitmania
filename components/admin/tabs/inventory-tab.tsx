'use client';

import { useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { ProductModal } from '@/components/admin/product-modal';
import { InventoryCountsPanel } from '@/components/admin/inventory-counts-panel';
import { ProductImport } from '@/components/admin/product-import';
import { formatCurrency } from '@/lib/admin-format';
import type { SetConfirm } from '@/components/admin/tabs/types';

// F3-21: pestaña "Inventario" extraída de app/fitministration/page.tsx (sin cambios de lógica).
export function InventoryTab({ productsList, setProductsList, refreshAllData, setConfirmModal, handleUpdateStock }: {
  productsList: any[];
  setProductsList: (products: any[]) => void;
  refreshAllData: () => void;
  setConfirmModal: SetConfirm;
  handleUpdateStock: (id: string, newStock: number) => void;
}) {
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const handleSaveProduct = async (data: any) => {
    const isEditing = !!selectedProduct;

    const res = await fetch('/api/admin/products', {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEditing ? { id: selectedProduct.id, ...data } : data)
    });

    if (res.ok) {
      toast.success(isEditing ? "Producto actualizado" : "Producto creado");
      setIsProductModalOpen(false);
      refreshAllData();
    } else {
      toast.error("Error al guardar producto");
    }
  };

  const handleDeleteProduct = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "BORRAR PRODUCTO",
      message: "¿Seguro que quieres eliminar este artículo? Desaparecerá de la tienda inmediatamente.",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success("Producto eliminado");
          setProductsList(productsList.filter(p => p.id !== id));
        }
      }
    });
  };

  return (
    <>
      <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
        <InventoryCountsPanel onApplied={refreshAllData} />
        <ProductImport onImported={refreshAllData} />
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 border-4 border-black rounded-2xl shadow-[6px_6px_0_0_rgba(0,0,0,1)] gap-6">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">Suministros y Stock</h2>
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Inventario Global de la sede</p>
          </div>
          <button
            onClick={() => { setSelectedProduct(null); setIsProductModalOpen(true); }}
            className="bg-black text-white px-8 py-4 rounded-xl font-black uppercase text-xs flex items-center gap-3 hover:bg-zinc-800 transition-all hover:-translate-y-1 shadow-[4px_4px_0_0_rgba(220,38,38,1)]"
          >
            <Plus className="w-5 h-5" /> Reg. Nuevo Producto
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {productsList.map(p => (
            <div key={p.id} className="bg-white border-4 border-black overflow-hidden rounded-2xl shadow-[8px_8px_0_0_rgba(0,0,0,1)] group hover:-translate-y-2 transition-all duration-300">
              <div className="relative h-56 bg-zinc-100 border-b-4 border-black">
                {p.imagen_url ? (
                  <Image src={p.imagen_url} alt={p.nombre} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="flex items-center justify-center h-full text-6xl opacity-10 font-black">BOX</div>
                )}
                <div className="absolute top-4 right-4 bg-white border-2 border-black px-3 py-1 font-black text-xs shadow-[3px_3px_0_0_rgba(0,0,0,1)]">
                  {formatCurrency(p.precio)}
                </div>
              </div>
              <div className="p-6 bg-white">
                <h4 className="font-black text-lg uppercase leading-tight mb-2 truncate">{p.nombre}</h4>
                <p className="text-[10px] font-black text-zinc-400 uppercase mb-6 tracking-widest italic">{p.categoria}</p>

                <div className="flex items-center gap-4 bg-zinc-50 p-3 border-2 border-black rounded-xl mb-6">
                  <div className="flex-1">
                    <p className="text-[8px] font-black uppercase text-zinc-500">Cant. Disponible</p>
                    <p className={`text-xl font-black ${p.stock <= (p.lowStockThreshold ?? 5) ? 'text-red-600 animate-shake' : 'text-zinc-900'}`}>{p.stock} UDS</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => handleUpdateStock(p.id, p.stock + 1)} className="bg-white border-2 border-black p-1 hover:bg-zinc-200"><Plus className="w-3 h-3" /></button>
                    <button onClick={() => handleUpdateStock(p.id, Math.max(0, p.stock - 1))} className="bg-white border-2 border-black p-1 hover:bg-zinc-200"><RotateCcw className="w-3 h-3" /></button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedProduct(p); setIsProductModalOpen(true); }}
                    className="flex-1 py-3 bg-zinc-900 text-white font-black text-[10px] uppercase border-b-4 border-zinc-950 hover:bg-black transition-all"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="p-3 border-2 border-black hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        product={selectedProduct}
      />
    </>
  );
}
