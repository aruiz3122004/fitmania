'use client';

import React, { useState, useEffect } from 'react';
import { ComicModal } from '@/components/ui/comic-modal';
import { 
  Dumbbell, 
  Flame, 
  Heart, 
  Zap, 
  Award, 
  Pill, 
  Cookie, 
  Shirt,
  Plus,
  Trash2,
  Image as ImageIcon,
  Save,
  PlusCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: any) => void;
  product?: any; // Si existe, es edición. Si no, es nuevo.
}

const CATEGORY_ICONS: any = {
  suplementos: Pill,
  snacks: Cookie,
  ropa: Shirt,
  entrenamiento: Dumbbell,
  ofertas: Flame,
  salud: Heart,
  energia: Zap,
  premiun: Award
};

export function ProductModal({ isOpen, onClose, onSave, product }: ProductModalProps) {
  const [formData, setFormData] = useState<any>({
    nombre: '',
    precio: 0,
    categoria: 'suplementos',
    stock: 0,
    imagen_url: '',
    badge: '',
    colores: [],
    tallas: []
  });

  const [newColor, setNewColor] = useState('#000000');
  const [newTalla, setNewTalla] = useState('');

  useEffect(() => {
    if (product) {
      setFormData({
        ...product,
        colores: product.colores || [],
        tallas: product.tallas || []
      });
    } else {
      setFormData({
        nombre: '',
        precio: 0,
        categoria: 'suplementos',
        stock: 0,
        imagen_url: '',
        badge: '',
        colores: [],
        tallas: []
      });
    }
  }, [product, isOpen]);

  const addColor = () => {
    if (!formData.colores.includes(newColor)) {
      setFormData({ ...formData, colores: [...formData.colores, newColor] });
    }
  };

  const removeColor = (color: string) => {
    setFormData({ ...formData, colores: formData.colores.filter((c: string) => c !== color) });
  };

  const addTalla = () => {
    if (newTalla && !formData.tallas.includes(newTalla.toUpperCase())) {
      setFormData({ ...formData, tallas: [...formData.tallas, newTalla.toUpperCase()] });
      setNewTalla('');
    }
  };

  const removeTalla = (talla: string) => {
    setFormData({ ...formData, tallas: formData.tallas.filter((t: string) => t !== talla) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <ComicModal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'EDITAR PRODUCTO' : 'REGISTRAR PRODUCTO'}
      description={product ? `Editando ID: ${product.id}` : 'Agrega un nuevo artículo a la Battle Shop'}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nombre y Precio */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Nombre del Producto</label>
              <input 
                type="text" 
                required
                className="w-full bg-zinc-50 border-2 border-black p-3 rounded-xl font-bold focus:ring-4 focus:ring-red-500/10 outline-none transition-all"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Precio (COP)</label>
              <input 
                type="number" 
                required
                className="w-full bg-zinc-50 border-2 border-black p-3 rounded-xl font-bold focus:ring-4 focus:ring-red-500/10 outline-none transition-all"
                value={formData.precio}
                onChange={(e) => setFormData({ ...formData, precio: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Stock Inicial</label>
              <input 
                type="number" 
                required
                className="w-full bg-zinc-50 border-2 border-black p-3 rounded-xl font-bold focus:ring-4 focus:ring-red-500/10 outline-none transition-all"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
              />
            </div>
          </div>

          {/* Imagen URL Preview */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Imagen del Producto (URL)</label>
            <div className="relative h-48 bg-zinc-100 border-4 border-black border-dashed rounded-2xl overflow-hidden group">
              {formData.imagen_url ? (
                <Image src={formData.imagen_url} alt="Preview" fill className="object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-300">
                  <ImageIcon className="w-12 h-12 mb-2" />
                  <span className="text-[10px] font-black uppercase italic">Sin Vista Previa</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                <input 
                  type="text" 
                  placeholder="Pegar URL aquí..."
                  className="w-full bg-white border-2 border-black p-2 text-xs font-bold rounded-lg"
                  value={formData.imagen_url}
                  onChange={(e) => setFormData({ ...formData, imagen_url: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Categoría con Iconos */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Categoría y Estilo</label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {Object.keys(CATEGORY_ICONS).map((cat) => {
              const Icon = CATEGORY_ICONS[cat];
              const isSelected = formData.categoria === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFormData({ ...formData, categoria: cat })}
                  className={cn(
                    "p-3 border-2 border-black rounded-xl transition-all flex flex-col items-center gap-1",
                    isSelected ? "bg-red-600 text-white shadow-[3px_3px_0_0_rgba(0,0,0,1)] -translate-y-1" : "bg-white hover:bg-zinc-100"
                  )}
                  title={cat}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[7px] font-black uppercase">{cat.slice(0, 5)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sección Ropa (Colores y Tallas) */}
        {formData.categoria === 'ropa' && (
          <div className="bg-zinc-50 p-6 border-4 border-black rounded-[2rem] space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <h4 className="text-xs font-black italic uppercase text-red-600 tracking-widest border-b-2 border-black pb-2 flex items-center gap-2">
              <Shirt className="w-4 h-4" /> Configuración de Ropa
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Colores */}
              <div>
                <label className="block text-[9px] font-black uppercase text-zinc-400 mb-2">Gama de Colores</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.colores.map((c: string) => (
                    <div key={c} className="group relative">
                      <div className="w-8 h-8 rounded-full border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)]" style={{ backgroundColor: c }} />
                      <button 
                        type="button"
                        onClick={() => removeColor(c)}
                        className="absolute -top-1 -right-1 bg-white border-2 border-black rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-2 h-2 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="color" className="w-10 h-10 p-0 border-2 border-black cursor-pointer" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
                  <button type="button" onClick={addColor} className="bg-black text-white px-3 py-1 text-[10px] font-black uppercase hover:bg-zinc-800 transition-all">Agregar</button>
                </div>
              </div>

              {/* Tallas */}
              <div>
                <label className="block text-[9px] font-black uppercase text-zinc-400 mb-2">Tallas Disponibles</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.tallas.map((t: string) => (
                    <div key={t} className="px-3 py-1 bg-white border-2 border-black font-black text-xs relative group shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                      {t}
                      <button 
                         type="button"
                         onClick={() => removeTalla(t)}
                         className="absolute -top-1 -right-1 bg-white border-2 border-black rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-2 h-2 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Ej: XL" 
                    className="w-20 bg-white border-2 border-black p-2 text-xs font-black uppercase"
                    value={newTalla}
                    onChange={(e) => setNewTalla(e.target.value)}
                  />
                  <button type="button" onClick={addTalla} className="bg-black text-white px-3 py-1 text-[10px] font-black uppercase hover:bg-zinc-800 transition-all">Agregar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-6 flex justify-end gap-4 border-t-2 border-black border-dashed">
            <button 
              type="button" 
              onClick={onClose}
              className="px-8 py-3 font-black uppercase text-xs text-zinc-400 hover:text-black transition-colors"
            >
              Cancelar
            </button>
            <button 
               type="submit"
               className="bg-black text-white px-10 py-3 rounded-xl border-b-4 border-zinc-700 font-black uppercase text-xs flex items-center gap-2 hover:-translate-y-1 hover:bg-zinc-800 transition-all shadow-[6px_6px_0_0_rgba(220,38,38,1)] active:shadow-none active:translate-y-0"
            >
              <Save className="w-4 h-4" />
              {product ? 'Guardar Cambios' : 'Registrar Ahora'}
            </button>
        </div>
      </form>
    </ComicModal>
  );
}
