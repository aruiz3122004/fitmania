'use client';

import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  UserCog, 
  Search, 
  Clock, 
  RefreshCw,
  XCircle,
  Database,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AuditLog {
  id: string;
  action: string;
  category: 'AUTH_SUCCESS' | 'AUTH_FAILURE' | 'ADMIN_ACTION' | 'SECURITY_BLOCK';
  details: string;
  adminEmail: string;
  ip: string;
  timestamp: string;
}

export function AuditLogsTab({ logs, loading, onRefreshAction }: { logs: AuditLog[], loading: boolean, onRefreshAction: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.adminEmail.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory === 'ALL' || log.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  const getCategoryTheme = (category: string) => {
    switch(category) {
      case 'AUTH_SUCCESS': return { bg: 'bg-green-100', text: 'text-green-700', icon: ShieldCheck, border: 'border-green-600' };
      case 'AUTH_FAILURE': return { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: ShieldAlert, border: 'border-yellow-600' };
      case 'SECURITY_BLOCK': return { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, border: 'border-red-600' };
      case 'ADMIN_ACTION': 
      default: return { bg: 'bg-blue-100', text: 'text-blue-700', icon: UserCog, border: 'border-blue-600' };
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 border-4 border-black rounded-[2rem] shadow-[6px_6px_0_0_rgba(0,0,0,1)] gap-6">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-black flex items-center gap-3">
             <Database className="w-8 h-8 text-red-600" />
             Auditoría Global
          </h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Registros Inmutables de Seguridad y Acciones</p>
        </div>
        <button
          onClick={onRefreshAction}
          disabled={loading}
          className="bg-black text-white px-6 py-3 rounded-xl font-black uppercase text-xs flex items-center gap-3 hover:-translate-y-1 hover:bg-zinc-800 transition-all shadow-[4px_4px_0_0_rgba(220,38,38,1)] disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Actualizar Registros
        </button>
      </div>

      <div className="bg-white border-4 border-black rounded-[2rem] shadow-[10px_10px_0_0_rgba(0,0,0,1)] overflow-hidden">
        {/* Filtros */}
        <div className="p-6 border-b-4 border-black bg-zinc-50 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por correo, acción o detalle..."
              className="pl-12 pr-4 py-3 bg-white border-3 border-black rounded-xl outline-none focus:translate-x-1 focus:translate-y-1 focus:shadow-none shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all font-bold text-sm w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex bg-white border-3 border-black rounded-xl overflow-hidden shadow-[2px_2px_0_0_rgba(0,0,0,1)] text-[10px] uppercase font-black tracking-widest w-full md:w-auto overflow-x-auto">
            {['ALL', 'AUTH_SUCCESS', 'AUTH_FAILURE', 'SECURITY_BLOCK', 'ADMIN_ACTION'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  "px-4 py-3 border-r-3 border-black last:border-r-0 transition-colors whitespace-nowrap",
                  filterCategory === cat ? "bg-black text-white" : "hover:bg-zinc-100 text-zinc-600"
                )}
              >
                {cat === 'ALL' ? 'TODOS' : cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto max-h-[60vh]">
          {filteredLogs.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-zinc-400">
               <Activity className="w-16 h-16 mb-4 opacity-50" />
               <p className="font-black italic text-xl uppercase tracking-widest">No hay registros</p>
               <p className="text-xs font-bold font-label uppercase">Intenta buscar algo diferente o refrescar</p>
            </div>
          ) : (
            <table className="w-full text-left relative">
              <thead className="bg-zinc-900 text-white sticky top-0 z-10">
                <tr>
                  <th className="p-6 font-black uppercase text-[10px] tracking-widest">Fecha y Hora</th>
                  <th className="p-6 font-black uppercase text-[10px] tracking-widest">Clasificación</th>
                  <th className="p-6 font-black uppercase text-[10px] tracking-widest">Autor / IP</th>
                  <th className="p-6 font-black uppercase text-[10px] tracking-widest">Detalle del Evento</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-zinc-100">
                {filteredLogs.map(log => {
                  const theme = getCategoryTheme(log.category);
                  const Icon = theme.icon;
                  const dateObj = new Date(log.timestamp);
                  
                  return (
                    <tr key={log.id} className="hover:bg-zinc-50 transition-colors group">
                      <td className="p-6 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-zinc-800">
                          <Clock className="w-4 h-4 text-zinc-400" />
                          <div className="flex flex-col">
                            <span className="font-black text-sm">{format(dateObj, 'MMM dd, yyyy', { locale: es }).toUpperCase()}</span>
                            <span className="text-[10px] font-bold text-zinc-500">{format(dateObj, 'hh:mm:ss a')}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 shadow-[2px_2px_0_0_rgba(0,0,0,1)]", theme.bg, theme.border)}>
                          <Icon className={cn("w-4 h-4", theme.text)} />
                          <span className={cn("font-black text-[9px] uppercase tracking-widest", theme.text)}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-zinc-800 truncate max-w-[200px]" title={log.adminEmail}>
                            {log.adminEmail}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            IP: {log.ip}
                          </span>
                        </div>
                      </td>
                      <td className="p-6 max-w-sm">
                        <p className="text-xs font-bold text-zinc-600 leading-relaxed border-l-4 border-zinc-200 pl-3">
                          {log.details}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
