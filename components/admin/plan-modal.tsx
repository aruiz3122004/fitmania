'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Star, Coffee, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  plan?: any;
}

const ICONS = {
  Coffee: Coffee,
  Star: Star,
  Users: Users,
  Clock: Clock
};

export function PlanModal({ isOpen, onClose, onSave, plan }: PlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    days: 30,
    features: '',
    featured: false,
    ribbon: '',
    icon: 'Star'
  });

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name || '',
        price: plan.price || 0,
        days: plan.days || 30,
        features: Array.isArray(plan.features) ? plan.features.join('\n') : '',
        featured: plan.featured || false,
        ribbon: plan.ribbon || '',
        icon: plan.icon || 'Star'
      });
    } else {
      setFormData({
        name: '',
        price: 0,
        days: 30,
        features: '',
        featured: false,
        ribbon: '',
        icon: 'Star'
      });
    }
  }, [plan, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        features: formData.features.split('\n').filter(f => f.trim() !== '')
      };
      await onSave(dataToSave);
      onClose();
    } catch (error) {
      toast.error('Error al guardar el plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white border-8 border-black rounded-[2.5rem] shadow-[20px_20px_0_0_rgba(0,0,0,1)] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="bg-zinc-900 p-8 border-b-8 border-black flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase" style={{ fontFamily: 'var(--font-display)' }}>
              {plan ? 'Editar' : 'Nuevo'} <span className="text-red-600">Plan</span>
            </h2>
            <p className="text-[10px] text-zinc-500 font-bold tracking-[3px] uppercase">Configuración de Membrecía</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white border-4 border-black rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-[4px_4px_0_0_rgba(255,255,255,0.1)]">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Nombre */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Nombre del Plan</label>
              <input
                required
                className="w-full p-4 bg-zinc-50 border-4 border-black rounded-2xl font-bold focus:bg-white outline-none transition-all"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Estandar"
              />
            </div>

            {/* Precio */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Precio (COP)</label>
              <input
                required
                type="number"
                className="w-full p-4 bg-zinc-50 border-4 border-black rounded-2xl font-bold focus:bg-white outline-none transition-all"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
              />
            </div>

            {/* Días */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Duración (Días)</label>
              <input
                required
                type="number"
                className="w-full p-4 bg-zinc-50 border-4 border-black rounded-2xl font-bold focus:bg-white outline-none transition-all"
                value={formData.days}
                onChange={(e) => setFormData({ ...formData, days: Number(e.target.value) })}
              />
            </div>

            {/* Icono */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Icono Visual</label>
              <select
                className="w-full p-4 bg-zinc-50 border-4 border-black rounded-2xl font-bold focus:bg-white outline-none transition-all"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              >
                {Object.keys(ICONS).map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            {/* Ribbon */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Etiqueta (Ribbon)</label>
              <input
                className="w-full p-4 bg-zinc-50 border-4 border-black rounded-2xl font-bold focus:bg-white outline-none transition-all"
                value={formData.ribbon}
                onChange={(e) => setFormData({ ...formData, ribbon: e.target.value })}
                placeholder="Ej: MÁS POPULAR"
              />
            </div>

            {/* Featured */}
            <div className="flex items-center gap-4 pt-6">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, featured: !formData.featured })}
                className={`w-14 h-8 rounded-full border-4 border-black transition-all relative ${formData.featured ? 'bg-red-600' : 'bg-zinc-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white border-2 border-black rounded-full transition-all ${formData.featured ? 'left-7' : 'left-1'}`} />
              </button>
              <span className="text-xs font-black uppercase italic tracking-widest">Plan Destacado</span>
            </div>

            {/* Features */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Beneficios (Uno por línea)</label>
              <textarea
                rows={5}
                className="w-full p-4 bg-zinc-50 border-4 border-black rounded-2xl font-bold focus:bg-white outline-none transition-all resize-none"
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                placeholder="Acceso 24/7&#10;Duchas incluidas..."
              />
            </div>
          </div>

          <div className="flex gap-4 pt-8 pb-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-5 border-4 border-black rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-100 transition-all active:translate-y-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-5 bg-black text-white border-4 border-black rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-[8px_8px_0_0_rgba(220,38,38,1)] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              GUARDAR CAMBIOS
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
