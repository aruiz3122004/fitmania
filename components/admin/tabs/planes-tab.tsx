'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, CheckCircle, Coffee, Star, Users, Clock } from 'lucide-react';
import { PlanModal } from '@/components/admin/plan-modal';
import { formatCurrency } from '@/lib/admin-format';
import type { SetConfirm } from '@/components/admin/tabs/types';

// F3-21: pestaña "Planes" extraída de app/fitministration/page.tsx (sin cambios de lógica).
// Carga sus planes al abrirse (F2-20: carga diferida por pestaña).
export function PlanesTab({ setConfirmModal }: { setConfirmModal: SetConfirm }) {
  const [planesList, setPlanesList] = useState<any[]>([]);
  // Modal de edición de PLANES (el producto de suscripción)
  const [isPlanEditModalOpen, setIsPlanEditModalOpen] = useState(false);
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<any>(null);

  const loadPlanes = () =>
    fetch('/api/admin/planes')
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setPlanesList(data) : setPlanesList([]))
      .catch((err) => console.error('Error cargando planes:', err));

  useEffect(() => { loadPlanes(); }, []);

  const handleSavePlan = async (data: any) => {
    const isEditing = !!selectedPlanForEdit;
    const res = await fetch('/api/admin/planes', {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEditing ? { id: selectedPlanForEdit.id, ...data } : data)
    });

    if (res.ok) {
      toast.success(isEditing ? "Plan actualizado" : "Plan creado");
      setIsPlanEditModalOpen(false);
      loadPlanes();
    } else {
      toast.error("Error al guardar el plan");
    }
  };

  const handleDeletePlan = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "ELIMINAR PLAN",
      message: "¿Seguro que deseas eliminar este plan? Afectará a los nuevos usuarios que intenten suscribirse.",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/planes?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success("Plan eliminado");
          loadPlanes();
        }
      }
    });
  };

  return (
    <>
      <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 border-4 border-black rounded-2xl shadow-[6px_6px_0_0_rgba(0,0,0,1)] gap-6">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">Suscripciones (Planes)</h2>
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Gestión de precios y beneficios de membresía</p>
          </div>
          <button
            onClick={() => { setSelectedPlanForEdit(null); setIsPlanEditModalOpen(true); }}
            className="bg-black text-white px-8 py-4 rounded-xl font-black uppercase text-xs flex items-center gap-3 hover:bg-zinc-800 transition-all hover:-translate-y-1 shadow-[4px_4px_0_0_rgba(220,38,38,1)]"
          >
            <Plus className="w-5 h-5" /> Nuevo Plan
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {planesList.map(plan => (
            <div key={plan.id} className={`bg-white border-4 border-black overflow-hidden rounded-2xl shadow-[8px_8px_0_0_rgba(0,0,0,1)] flex flex-col ${plan.featured ? 'ring-8 ring-red-600/10' : ''}`}>
              {plan.ribbon && (
                <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-widest py-1 text-center border-b-4 border-black">
                  {plan.ribbon}
                </div>
              )}
              <div className="p-8 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-zinc-100 border-2 border-black rounded-xl flex items-center justify-center">
                     {plan.icon === 'Coffee' && <Coffee className="w-6 h-6" />}
                     {plan.icon === 'Star' && <Star className="w-6 h-6" />}
                     {plan.icon === 'Users' && <Users className="w-6 h-6" />}
                     {plan.icon === 'Clock' && <Clock className="w-6 h-6" />}
                  </div>
                  <div className="text-right">
                     <p className="text-2xl font-black tracking-tighter italic">{formatCurrency(plan.price)}</p>
                     <p className="text-[10px] font-bold text-zinc-400 uppercase">{plan.days} Días</p>
                  </div>
                </div>

                <h3 className="text-xl font-black uppercase italic mb-4">{plan.name}</h3>
                
                <ul className="space-y-2 mb-8">
                  {plan.features?.map((f: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-bold text-zinc-600">
                      <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 bg-zinc-50 border-t-4 border-black flex gap-2">
                <button
                  onClick={() => { setSelectedPlanForEdit(plan); setIsPlanEditModalOpen(true); }}
                  className="flex-1 py-3 bg-zinc-900 text-white font-black text-[10px] uppercase border-b-4 border-zinc-950 hover:bg-black transition-all"
                >
                  Configurar
                </button>
                <button
                  onClick={() => handleDeletePlan(plan.id)}
                  className="p-3 border-2 border-black hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-5 h-5 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <PlanModal
        isOpen={isPlanEditModalOpen}
        onClose={() => setIsPlanEditModalOpen(false)}
        onSave={handleSavePlan}
        plan={selectedPlanForEdit}
      />
    </>
  );
}
