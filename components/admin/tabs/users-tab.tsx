'use client';

import { useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Users, Search, Edit3, Trash2, RotateCcw } from 'lucide-react';
import { UserPlanModal } from '@/components/admin/user-plan-modal';
import { formatDate } from '@/lib/admin-format';
import type { SetConfirm } from '@/components/admin/tabs/types';

const PAGE_SIZE = 50;

// Las fechas llegan serializadas por la API como { _seconds } (o { seconds } / ISO).
const toMillis = (v: any): number | null => {
  if (!v) return null;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

// Comillas escapadas y sin fórmulas (=, +, -, @) que Excel ejecutaría al abrir el archivo.
const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
};

// F3-21: pestaña "Usuarios" extraída de app/fitministration/page.tsx (sin cambios de lógica).
export function UsersTab({ usersList, setUsersList, refreshAllData, setConfirmModal }: {
  usersList: any[];
  setUsersList: (users: any[]) => void;
  refreshAllData: () => void;
  setConfirmModal: SetConfirm;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  // Modal de edición de MEMBRESÍA de usuario (vigencia)
  const [isUserPlanModalOpen, setIsUserPlanModalOpen] = useState(false);
  const [selectedUserForPlan, setSelectedUserForPlan] = useState<any>(null);

  const handleUpdateUserPlan = async (uid: string, plan: any) => {
    try {
      // La cookie HttpOnly se envía automáticamente
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, plan })
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Membresía actualizada');
      refreshAllData();
    } catch (err) {
      toast.error('Error al actualizar plan');
    }
  };

  const handleDeleteUser = (uid: string) => {
    setConfirmModal({
      isOpen: true,
      title: "BORRAR SOCIO",
      message: "¿¡ESTÁS SEGURO!? Este socio será eliminado permanentemente de la base de datos de Fitmania. Esta acción no se puede deshacer.",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/users?uid=${uid}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success("Usuario borrado satisfactoriamente");
          setUsersList(usersList.filter(u => u.uid !== uid));
        }
      }
    });
  };

  // F3-25: congelar / reactivar el plan conservando los días a favor.
  const handleToggleFreeze = async (u: any) => {
    const frozen = !!u.plan?.frozen;
    let reason = '';
    if (!frozen) {
      reason = window.prompt('Motivo del congelamiento (incapacidad, viaje…):') || '';
      if (!reason.trim()) return;
    } else if (!window.confirm('¿Reactivar el plan sumando los días congelados?')) {
      return;
    }
    const res = await fetch('/api/admin/users/freeze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: u.uid, action: frozen ? 'unfreeze' : 'freeze', reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'No se pudo actualizar el plan.');
      return;
    }
    toast.success(frozen ? 'Plan reactivado.' : `Plan congelado (${data.remainingDays} días a favor).`);
    refreshAllData();
  };

  const handleRemovePlan = (uid: string) => {
    setConfirmModal({
      isOpen: true,
      title: "REMOVER PLAN",
      message: "¿Deseas quitarle el plan activo a este usuario? Ya no tendrá acceso a los beneficios de socio.",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/users`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, plan: null })
        });
        if (res.ok) {
          toast.success("Plan removido");
          setUsersList(usersList.map(u => u.uid === uid ? { ...u, plan: null } : u));
        }
      }
    });
  };

  const handleExportUsersCSV = () => {
    const headers = ['Nombre,Email,Rol,Plan,Status,Registro'];
    const rows = usersList.map(u => {
      const expira = toMillis(u.plan?.expira);
      const creado = toMillis(u.createdAt) ?? toMillis(u.creationTime);
      return [
        csvCell(u.username || u.displayName || 'Desconocido'),
        csvCell(u.email || 'N/A'),
        csvCell(u.admin ? 'Admin' : u.receptionist ? 'Recepción' : 'Socio'),
        csvCell(u.plan?.nombre || 'Sin Plan'),
        csvCell(u.plan?.frozen ? 'Congelado' : expira && expira > Date.now() ? 'Activo' : u.plan ? 'Vencido' : 'Sin plan'),
        csvCell(creado ? new Date(creado).toLocaleDateString('es-CO') : 'N/A'),
      ].join(',');
    });

    // BOM para que Excel abra bien las tildes.
    const csvContent = String.fromCharCode(0xfeff) + headers.concat(rows).join('\n');
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "fitmania_usuarios.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleExportUsersJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(usersList, null, 2))
    const downloadNode = document.createElement('a')
    downloadNode.setAttribute("href", dataStr)
    downloadNode.setAttribute("download", "fitmania_directorio.json")
    document.body.appendChild(downloadNode)
    downloadNode.click()
    downloadNode.remove()
  }

  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? usersList.filter(u => [u.email, u.displayName, u.username, u.uid].some(f => typeof f === 'string' && f.toLowerCase().includes(query)))
    : usersList;

  return (
    <>
      <div className="bg-white border-4 border-black rounded-[2rem] shadow-[10px_10px_0_0_rgba(0,0,0,1)] overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b-4 border-black bg-zinc-50 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">Base de Usuarios</h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={handleExportUsersJSON} className="flex-1 sm:flex-none border-2 border-black bg-white hover:bg-zinc-100 text-[10px] font-black tracking-widest uppercase p-2 rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,1)] transition-transform active:translate-y-1">↓ JSON</button>
              <button onClick={handleExportUsersCSV} className="flex-1 sm:flex-none border-2 border-black bg-black text-white hover:bg-zinc-900 text-[10px] font-black tracking-widest uppercase p-2 rounded-xl shadow-[3px_3px_0_0_rgba(220,38,38,1)] transition-transform active:translate-y-1">📊 CSV / EXCEL</button>
            </div>
          </div>
          <div className="relative w-full md:w-auto">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-10 pr-4 py-3 bg-white border-2 border-black rounded-xl outline-none focus:ring-4 focus:ring-red-500/10 transition-all font-bold text-sm w-full md:w-72"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setVisible(PAGE_SIZE); }}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-900 text-white">
              <tr>
                <th className="p-6 font-black uppercase text-[10px] tracking-widest">Socio</th>
                <th className="p-6 font-black uppercase text-[10px] tracking-widest">Membresía</th>
                <th className="p-6 font-black uppercase text-[10px] tracking-widest">Rol</th>
                <th className="p-6 font-black uppercase text-[10px] tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-zinc-100">
              {filtered.slice(0, visible).map(u => (
                <tr key={u.uid} className="hover:bg-zinc-50 transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-200 border-3 border-black overflow-hidden relative shadow-[3px_3px_0_0_rgba(0,0,0,1)]">
                        {u.photoURL ? <Image src={u.photoURL} alt="Avatar" fill className="object-cover" /> : <Users className="p-3 text-zinc-400 w-full h-full" />}
                      </div>
                      <div>
                        <p className="font-black text-sm uppercase">{u.displayName}</p>
                        <p className="text-xs text-zinc-400 italic">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    {u.plan ? (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="bg-yellow-400 text-black border-2 border-black px-3 py-1 rounded-lg text-[10px] font-black uppercase italic shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                            {u.plan.nombre}
                          </span>
                          {u.plan.frozen ? (
                            <span className="text-[10px] font-black text-blue-600 mt-1 uppercase">Congelado · {Math.ceil((u.plan.frozen.remainingMs || 0) / 86400000)} días a favor</span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-500 mt-1 uppercase">Vence: {formatDate(u.plan.expira)}</span>
                          )}
                        </div>
                        <button onClick={() => handleToggleFreeze(u)} className="opacity-0 group-hover:opacity-100 px-2 py-1 border-2 border-black rounded text-[9px] font-black uppercase bg-white hover:bg-blue-50 transition-all" title={u.plan.frozen ? 'Reactivar plan' : 'Congelar plan'}>
                          {u.plan.frozen ? 'Reactivar' : 'Congelar'}
                        </button>
                        <button onClick={() => handleRemovePlan(u.uid)} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-red-500 transition-all" title="Remover Membresía"><RotateCcw className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <span className="bg-zinc-100 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Sin Membresía</span>
                    )}
                  </td>
                  <td className="p-6">
                    {u.admin ? <span className="text-red-600 font-black italic tracking-tighter text-sm uppercase">ADMIN</span> : <span className="text-zinc-300 font-bold text-sm uppercase">SOCIO</span>}
                  </td>
                  <td className="p-6 text-right space-x-2">
                    {u.plan && (
                      <button onClick={() => { setSelectedUserForPlan(u); setIsUserPlanModalOpen(true); }} className="p-2 border-2 border-transparent hover:border-black hover:bg-zinc-100 rounded-lg transition-all" title="Editar Vigencia"><Edit3 className="w-5 h-5" /></button>
                    )}
                    <button onClick={() => handleDeleteUser(u.uid)} className="p-2 border-2 border-transparent hover:border-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-5 h-5 text-red-600" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t-4 border-black bg-zinc-50 flex flex-wrap items-center justify-between gap-3 text-xs font-black uppercase tracking-widest">
          <span>{Math.min(visible, filtered.length)} de {filtered.length} {query ? 'resultados' : 'socios'}</span>
          {filtered.length > visible && (
            <button onClick={() => setVisible(v => v + PAGE_SIZE)} className="border-2 border-black bg-white hover:bg-zinc-100 px-4 py-2 rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,1)]">
              Mostrar {Math.min(PAGE_SIZE, filtered.length - visible)} más
            </button>
          )}
        </div>
      </div>
      <UserPlanModal
        isOpen={isUserPlanModalOpen}
        onClose={() => setIsUserPlanModalOpen(false)}
        user={selectedUserForPlan}
        onSave={handleUpdateUserPlan}
      />
    </>
  );
}
