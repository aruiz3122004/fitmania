'use client';

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { toast, Toaster } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { ConfirmModal } from '@/components/ui/comic-modal';
import { Sidebar } from '@/components/admin/sidebar';
import { AdminLoginForm } from '@/components/admin/admin-login-form';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminGlobalStyles } from '@/components/admin/admin-global-styles';
import { AuditLogsTab } from '@/components/admin/audit-logs-tab';
import { AttendanceTab } from '@/components/admin/attendance-tab';
import { SystemTab } from '@/components/admin/system-tab';
import { CommunityTab } from '@/components/admin/community-tab';
import { PaymentsTab } from '@/components/admin/payments-tab';
import { OverviewTab } from '@/components/admin/tabs/overview-tab';
import { UsersTab } from '@/components/admin/tabs/users-tab';
import { InventoryTab } from '@/components/admin/tabs/inventory-tab';
import { PqrsTab } from '@/components/admin/tabs/pqrs-tab';
import { PlanesTab } from '@/components/admin/tabs/planes-tab';
import { OrdersTab } from '@/components/admin/tabs/orders-tab';
import type { ConfirmState } from '@/components/admin/tabs/types';
import { XCircle } from 'lucide-react';

// F3-21: cada pestaña vive en components/admin/tabs/*; aquí quedan la sesión,
// la carga de datos compartidos, el encabezado y el modal de confirmación.
export default function AdminPage() {
  const [visualState, setVisualState] = useState<'login' | 'unauthorized' | 'dashboard'>('login');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Datos
  const [notifications, setNotifications] = useState<any[]>([]);

  // F3-08: notificaciones en tiempo real (stock bajo, conteos, cierres de caja, compras).
  // Las reglas permiten leer `notifications` solo con el claim `admin`.
  useEffect(() => {
    if (visualState !== 'dashboard') return;
    const q = query(collection(db, 'notifications'), orderBy('fecha', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snap) => setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('Notificaciones en tiempo real no disponibles:', err)
    );
  }, [visualState]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [pqrsList, setPqrsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);

  // UI States
  const { user: authUser } = useAuthStore();

  // Modal de confirmación compartido por las pestañas
  const [confirmModal, setConfirmModal] = useState<ConfirmState>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  useEffect(() => {
    // Verificar la sesión leyendo la cookie HttpOnly via el endpoint de verificación
    // (la cookie no es accesible desde JavaScript, el servidor la verifica)
    const checkAdminSession = async () => {
      try {
        const res = await fetch('/api/auth/verify?role=admin');
        const { valid } = res.ok ? await res.json() : { valid: false };
        if (valid) {
          // Si la cookie es válida, verificar también el estado de Firebase
          const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
              const decodedResult = await currentUser.getIdTokenResult();
              if (decodedResult.claims.admin === true) {
                setVisualState('dashboard');
                refreshAllData();
              } else {
                setVisualState('login');
              }
            } else {
              // Cookie válida pero Firebase no tiene sesión activa — mostrar login
              setVisualState('login');
            }
            setLoading(false);
          });
          return unsubscribe;
        } else {
          // Sin cookie válida → mostrar login
          setLoading(false);
          setVisualState('login');
          return () => {};
        }
      } catch {
        setLoading(false);
        setVisualState('login');
        return () => {};
      }
    };

    let unsubscribeFirebase: (() => void) | void;
    checkAdminSession().then(unsub => { unsubscribeFirebase = unsub; });
    return () => { if (unsubscribeFirebase) unsubscribeFirebase(); };
  }, []);

  // El login ahora no recibe token — la cookie HttpOnly ya fue establecida por el servidor
  const handleAdminLoginSuccess = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const decodedResult = await currentUser.getIdTokenResult();
      if (decodedResult.claims.admin === true) {
        setVisualState('dashboard');
        refreshAllData();
      } else {
        setVisualState('unauthorized');
      }
    }
  };

  const refreshAllData = async () => {
    // Las cookies HttpOnly se envían automáticamente por el navegador — no se necesita el Bearer token manualmente
    const handleFetchError = (err: any) => {
      console.error('Error fetching admin data:', err);
      // Antes el mensaje se guardaba en un estado que nunca se mostraba.
      toast.error('Error de conexión con el servidor. Algunos datos del panel no se cargaron.');
    };

    // F2-20: solo lo que necesita el resumen. Las notificaciones llegan en tiempo real
    // (onSnapshot) y los logs y planes se cargan al abrir su pestaña.
    fetch('/api/admin/users')
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setUsersList(data) : setUsersList([]))
      .catch(handleFetchError);

    fetch('/api/admin/products')
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setProductsList(data) : setProductsList([]))
      .catch(handleFetchError);

    fetch('/api/admin/pqrs')
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setPqrsList(data) : setPqrsList([]))
      .catch(handleFetchError);

    fetch('/api/admin/orders')
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setOrdersList(data) : setOrdersList([]))
      .catch(handleFetchError);

    if (activeTab === 'audit') loadAuditLogs();
  };

  const loadAuditLogs = () =>
    fetch('/api/admin/logs')
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setAuditLogsList(data) : setAuditLogsList([]))
      .catch((err) => console.error('Error cargando auditoría:', err));

  // Carga diferida por pestaña (F2-20).
  useEffect(() => {
    if (visualState !== 'dashboard') return;
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab, visualState]);

  const handleLogout = async () => {
    // Cerrar SOLO la sesión del panel (cookie HttpOnly `fitmania_session` del servidor).
    // IMPORTANTE: no usar signOut(auth). Eso cerraba también la cuenta de Firebase y
    // obligaba al usuario a volver a iniciar sesión en el sitio. La cuenta sigue activa;
    // para reabrir el panel basta el botón de acceso del menú (nuevo ID token).
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      window.location.href = '/';
    }
  };


  const handleUpdateStock = async (id: string, newStock: number) => {
    const res = await fetch(`/api/admin/products`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stock: newStock })
    });
    if (res.ok) {
      toast.success("Stock actualizado");
      setProductsList(productsList.map(p => p.id === id ? { ...p, stock: newStock } : p));
    }
  };

  const markNotificationRead = async (id: string) => {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    setNotifications(notifications.map(n => n.id === id ? { ...n, leido: true } : n));
  };

  // --- FINAL RENDER ---

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (visualState === 'login') {
    return <AdminLoginForm onSuccess={handleAdminLoginSuccess} />;
  }

  if (visualState === 'unauthorized') return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d12] p-6 font-sans">
      <div className="bg-white border-8 border-black p-12 rounded-[2rem] shadow-[20px_20px_0_0_rgba(220,38,38,1)] max-w-sm text-center animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-red-100 rounded-3xl mx-auto flex items-center justify-center mb-8 border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          <XCircle className="w-16 h-16 text-red-600" />
        </div>
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-4" style={{ fontFamily: 'var(--font-display)' }}>ACCESO RESTRINGIDO</h2>
        <p className="text-zinc-500 font-bold mb-8 italic uppercase text-[10px] tracking-widest leading-relaxed">
          Este centro de mando está reservado <br /> exclusivamente para personal administrativo <br /> de nivel 5 (FITMANIA ADMIN).
        </p>
        <div className="flex flex-col gap-3">
          <button onClick={() => window.location.href = '/'} className="w-full py-4 bg-black text-white font-black rounded-xl border-b-8 border-zinc-950 hover:-translate-y-1 transition-all shadow-[6px_6px_0_0_rgba(220,38,38,0.2)]">REGRESAR AL SITIO</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <style dangerouslySetInnerHTML={{
        __html: `
        .halftone { background-image: radial-gradient(circle, #ddd 1px, transparent 1px); background-size: 14px 14px; }
      `}} />
      <Toaster position="bottom-right" richColors />

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

      <main className="md:ml-64 p-4 md:p-12 min-h-screen halftone relative">
        <AdminHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          notifications={notifications}
          markNotificationRead={markNotificationRead}
          authUser={authUser}
        />

        <div className="mb-20">
          {activeTab === 'overview' && (
            <OverviewTab usersList={usersList} ordersList={ordersList} pqrsList={pqrsList} productsList={productsList} setActiveTab={setActiveTab} handleUpdateStock={handleUpdateStock} />
          )}
          {activeTab === 'attendance' && <AttendanceTab />}
          {activeTab === 'system' && <SystemTab />}
          {activeTab === 'community' && <CommunityTab />}
          {activeTab === 'users' && (
            <UsersTab usersList={usersList} setUsersList={setUsersList} refreshAllData={refreshAllData} setConfirmModal={setConfirmModal} />
          )}
          {activeTab === 'inventory' && (
            <InventoryTab productsList={productsList} setProductsList={setProductsList} refreshAllData={refreshAllData} setConfirmModal={setConfirmModal} handleUpdateStock={handleUpdateStock} />
          )}
          {activeTab === 'planes' && <PlanesTab setConfirmModal={setConfirmModal} />}
          {activeTab === 'pqrs' && <PqrsTab pqrsList={pqrsList} setPqrsList={setPqrsList} />}
          {activeTab === 'orders' && <OrdersTab ordersList={ordersList} setOrdersList={setOrdersList} setConfirmModal={setConfirmModal} />}
          {activeTab === 'payments' && <PaymentsTab />}
          {activeTab === 'audit' && <AuditLogsTab logs={auditLogsList} loading={false} onRefreshAction={refreshAllData} />}
        </div>

        {/* Decorative corner element */}
        <div className="fixed bottom-0 right-0 w-32 h-32 bg-yellow-400 border-l-4 border-t-4 border-black z-0 pointer-events-none hidden lg:block" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}>
          <div className="absolute bottom-4 right-4 font-black uppercase text-black text-xs rotate-[-45deg]">v1.0</div>
        </div>
      </main>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />

      <AdminGlobalStyles />
    </div>
  );
}
