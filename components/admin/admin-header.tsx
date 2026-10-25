'use client';

import Image from 'next/image';
import { ChevronLeft } from 'lucide-react';
import { NotificationBell } from '@/components/admin/notification-bell';

// F3-21: encabezado del panel admin extraído de app/fitministration/page.tsx.
export function AdminHeader({ activeTab, setActiveTab, notifications, markNotificationRead, authUser }: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  notifications: any[];
  markNotificationRead: (id: string) => void;
  authUser: any;
}) {
  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-8 relative mt-16 md:mt-0">
      {/* Mobile Back / Exit Button */}
      <div className="md:hidden absolute -top-14 left-0">
        {activeTab !== 'overview' ? (
          <button
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2 text-zinc-600 font-black hover:text-red-600 uppercase text-[10px] tracking-widest border-2 border-black px-4 py-2 bg-white rounded-lg shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> DASHBOARD
          </button>
        ) : (
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 text-zinc-600 font-black hover:text-red-600 uppercase text-[10px] tracking-widest border-2 border-black px-4 py-2 bg-white rounded-lg shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> SALIR
          </button>
        )}
      </div>

      <div className="w-full sm:w-auto mt-4 sm:mt-0">
        <h2 className="text-xs font-black text-red-600 uppercase tracking-[4px] mb-1">Fitmania Command Center</h2>
        <p className="text-4xl md:text-5xl font-black italic underline decoration-red-600 decoration-8 underline-offset-8 tracking-tighter uppercase">{activeTab === 'overview' ? 'Operaciones' : activeTab === 'attendance' ? 'Asistencia' : activeTab === 'system' ? 'Sistema' : activeTab === 'community' ? 'Comunidad' : activeTab === 'payments' ? 'Pagos' : activeTab}</p>
      </div>

      <div className="flex items-center gap-6 w-full sm:w-auto self-end sm:self-auto">
        <NotificationBell
          notifications={notifications}
          onMarkRead={markNotificationRead}
          onNavigate={(tab: string) => setActiveTab(tab)}
        />
        <div className="flex items-center gap-4 bg-white border-4 border-black p-2 pr-6 rounded-2xl shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
          <div className="w-12 h-12 bg-zinc-900 border-2 border-black rounded-xl overflow-hidden text-white flex items-center justify-center font-black italic text-xl shadow-[2px_2px_0_0_rgba(220,38,38,1)]">
            {authUser?.photoURL || authUser?.avatar ? (
              <Image src={authUser.photoURL || authUser.avatar} alt="Admin" width={48} height={48} className="object-cover" />
            ) : (
              'A'
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-black uppercase tracking-tighter truncate max-w-[120px]">
              {authUser?.username || authUser?.email?.split('@')[0] || 'Super User'}
            </p>
            <p className="text-[8px] font-black text-red-600 tracking-[3px] uppercase">Fitmania Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}
