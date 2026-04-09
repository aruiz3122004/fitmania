'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import Image from 'next/image';
import { 
  Users, 
  Package, 
  MessageSquare, 
  TrendingUp, 
  Bell, 
  LogOut, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  XCircle,
  Menu,
  X,
  CreditCard,
  ShoppingBag,
  Send,
  ArrowRight,
  ClipboardList,
  AlertTriangle,
  AlertCircle,
  Mail,
  RotateCcw
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { ConfirmModal } from '@/components/ui/comic-modal';
import { ProductModal } from '@/components/admin/product-modal';
import { AdminLoginForm } from '@/components/admin/admin-login-form';

// --- HELPERS ---
const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(val);

const formatDate = (dateValue: any) => {
  if (!dateValue) return 'N/A';
  // Si es un Timestamp de Firestore { seconds, nanoseconds }
  if (dateValue?.seconds) {
    return new Date(dateValue.seconds * 1000).toLocaleDateString();
  }
  // Si es un objeto Date o un string ISO
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return 'Fecha Inválida';
  return d.toLocaleDateString();
};

// --- COMPONENTES ---

const Sidebar = ({ activeTab, setActiveTab, onLogout }: any) => {
  const menuItems = [
    { id: 'overview', icon: TrendingUp, label: 'Resumen' },
    { id: 'users', icon: Users, label: 'Usuarios' },
    { id: 'inventory', icon: Package, label: 'Inventario' },
    { id: 'pqrs', icon: MessageSquare, label: 'PQRS' },
    { id: 'orders', icon: ShoppingBag, label: 'Compras' },
  ];

  return (
    <div className="w-64 bg-zinc-900 h-screen fixed left-0 top-0 border-r-4 border-black flex flex-col p-6 z-40 hidden md:flex shadow-[4px_0_0_0_rgba(0,0,0,0.2)]">
      <div className="mb-12">
        <h1 className="text-3xl font-black text-white italic tracking-tighter" style={{ fontFamily: 'var(--font-display)' }}>
          FIT<span className="text-red-600">MANIA</span>
        </h1>
        <p className="text-[10px] text-zinc-500 font-bold tracking-[3px] uppercase">Admin System</p>
      </div>

      <nav className="flex-1 space-y-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl font-black uppercase text-sm transition-all border-4 ${
              activeTab === item.id 
                ? 'bg-red-600 text-white border-black translate-x-1 -translate-y-1 shadow-[4px_4px_0_0_rgba(255,255,255,1)]' 
                : 'text-zinc-400 border-transparent hover:text-white hover:bg-zinc-800'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>

      <button 
        onClick={onLogout}
        className="mt-auto flex items-center gap-4 p-4 text-zinc-500 font-bold hover:text-red-500 transition-colors uppercase text-xs"
      >
        <LogOut className="w-4 h-4" />
        Salir del Panel
      </button>
    </div>
  );
};

const NotificationBell = ({ notifications, onMarkRead, onNavigate }: any) => {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n: any) => !n.leido).length;

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className="relative p-2 bg-white border-3 border-black rounded-lg shadow-[3px_3px_0_0_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none transition-all"
      >
        <Bell className="w-6 h-6 text-black" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-black animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-4 w-80 bg-white border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] z-50 rounded-xl overflow-hidden">
          <div className="bg-zinc-900 p-4 border-b-4 border-black flex justify-between items-center">
            <h3 className="text-white font-black uppercase text-sm tracking-widest">Notificaciones</h3>
            <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-white" /></button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-8 text-center text-zinc-400 font-bold italic">Todo despejado, jefe.</p>
            ) : (
              notifications.map((n: any) => (
                <div 
                  key={n.id} 
                  className={`p-4 border-b-2 border-zinc-100 cursor-pointer transition-colors ${!n.leido ? 'bg-yellow-50 hover:bg-yellow-100' : 'opacity-60 hover:bg-zinc-50'}`}
                  onClick={() => {
                    onMarkRead(n.id);
                    if (n.tipo === 'low_stock') onNavigate('inventory');
                    if (n.tipo === 'purchase') onNavigate('orders');
                    if (n.tipo === 'pqrs') onNavigate('pqrs');
                    setOpen(false);
                  }}
                >
                  <p className="text-[10px] font-black uppercase mb-1 flex items-center gap-1">
                    {n.tipo === 'low_stock' && <AlertTriangle className="w-3 h-3 text-red-600" />}
                    {n.tipo === 'purchase' && <CreditCard className="w-3 h-3 text-green-600" />}
                    {n.tipo === 'low_stock' ? 'Stock Bajo' : n.tipo === 'purchase' ? 'Compra' : 'Alerta'}
                  </p>
                  <p className="text-sm font-bold text-zinc-800 leading-tight">{n.mensaje}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN PAGE ---

export default function AdminPage() {
  const [visualState, setVisualState] = useState<'login' | 'unauthorized' | 'dashboard'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [adminSessionValid, setAdminSessionValid] = useState(false);

  // Datos
  const [stats, setStats] = useState<any>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [pqrsList, setPqrsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);

  // UI States
  const [isReplying, setIsReplying] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { user: authUser } = useAuthStore();

  // Modal States
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  useEffect(() => {
    // Verificar si ya hay una sesión de admin válida para esta pestaña del navegador
    const savedSession = sessionStorage.getItem('fitmania_admin_session');
    if (savedSession === 'FitmaniaAdmin2026') {
      setAdminSessionValid(true);
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const decodedResult = await currentUser.getIdTokenResult();
        if (decodedResult.claims.admin === true) {
          if (savedSession === 'FitmaniaAdmin2026') {
            setVisualState('dashboard');
            refreshAllData();
          } else {
            setVisualState('login');
          }
        } else {
          setVisualState('unauthorized');
        }
      } else {
        setVisualState('unauthorized');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAdminLoginSuccess = async (token: string) => {
    sessionStorage.setItem('fitmania_admin_session', token);
    setAdminSessionValid(true);
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
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    setConnectionError(null);

    const handleFetchError = (err: any) => {
      console.error('Error fetching admin data:', err);
      setConnectionError('Error de conexión con el Servidor / Base de Datos. Verifica las variables de entorno en Vercel.');
    };

    fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` }})
      .then(res => {
        if (!res.ok) throw new Error('Stats failure');
        return res.json();
      })
      .then(setStats)
      .catch(handleFetchError);
    
    fetch('/api/admin/notifications', { headers: { 'Authorization': `Bearer ${token}` }})
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setNotifications(data) : setNotifications([]))
      .catch(handleFetchError);

    fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` }})
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setUsersList(data) : setUsersList([]))
      .catch(handleFetchError);

    fetch('/api/admin/products', { headers: { 'Authorization': `Bearer ${token}` }})
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setProductsList(data) : setProductsList([]))
      .catch(handleFetchError);

    fetch('/api/admin/pqrs', { headers: { 'Authorization': `Bearer ${token}` }})
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setPqrsList(data) : setPqrsList([]))
      .catch(handleFetchError);

    fetch('/api/admin/orders', { headers: { 'Authorization': `Bearer ${token}` }})
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setOrdersList(data) : setOrdersList([]))
      .catch(handleFetchError);
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('fitmania_admin_session');
    await signOut(auth);
    setVisualState('login');
  };

  // --- ACTIONS ---

  const handleDeleteUser = (uid: string) => {
     setConfirmModal({
       isOpen: true,
       title: "BORRAR SOCIO",
       message: "¿¡ESTÁS SEGURO!? Este socio será eliminado permanentemente de la base de datos de Fitmania. Esta acción no se puede deshacer.",
       onConfirm: async () => {
         const token = await auth.currentUser?.getIdToken();
         const res = await fetch(`/api/admin/users?uid=${uid}`, { 
           method: 'DELETE', 
           headers: { 'Authorization': `Bearer ${token}` } 
         });
         if(res.ok) {
           toast.success("Usuario borrado satisfactoriamente");
           setUsersList(usersList.filter(u => u.uid !== uid));
         }
       }
     });
  };

  const handleRemovePlan = (uid: string) => {
    setConfirmModal({
      isOpen: true,
      title: "REMOVER PLAN",
      message: "¿Deseas quitarle el plan activo a este usuario? Ya no tendrá acceso a los beneficios de socio.",
      onConfirm: async () => {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/admin/users`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, plan: null })
        });
        if(res.ok) {
          toast.success("Plan removido");
          setUsersList(usersList.map(u => u.uid === uid ? { ...u, plan: null } : u));
        }
      }
    });
  };

  const handleUpdateStock = async (id: string, newStock: number) => {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`/api/admin/products`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stock: newStock })
    });
    if(res.ok) {
      toast.success("Stock actualizado");
      setProductsList(productsList.map(p => p.id === id ? { ...p, stock: newStock } : p));
    }
  };

  const handleSaveProduct = async (data: any) => {
    const token = await auth.currentUser?.getIdToken();
    const isEditing = !!selectedProduct;
    
    const res = await fetch('/api/admin/products', {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(isEditing ? { id: selectedProduct.id, ...data } : data)
    });

    if(res.ok) {
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
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/admin/products?id=${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if(res.ok) {
          toast.success("Producto eliminado");
          setProductsList(productsList.filter(p => p.id !== id));
        }
      }
    });
  };

  const handleReplyPqrs = async (pqrs: any) => {
    if(!replyMessage) return;
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/admin/pqrs/respond', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pqrsId: pqrs.id,
        userEmail: pqrs.userEmail, 
        userName: pqrs.userName,
        originalMessage: pqrs.mensaje,
        responseMessage: replyMessage
      })
    });
    if(res.ok) {
      toast.success("Respuesta enviada por Gmail");
      setIsReplying(null);
      setReplyMessage('');
      setPqrsList(pqrsList.map(p => p.id === pqrs.id ? { ...p, estado: 'resuelto' } : p));
    }
  };

  const markNotificationRead = async (id: string) => {
    const token = await auth.currentUser?.getIdToken();
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    setNotifications(notifications.map(n => n.id === id ? { ...n, leido: true } : n));
  };

  // --- RENDERS ---

  const renderOverview = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                <div key={order.id} className="flex justify-between items-center p-4 border-2 border-zinc-100 rounded-xl hover:bg-zinc-50 transition-colors">
                   <div>
                     <p className="font-black text-sm">{order.customerName}</p>
                     <p className="text-[10px] text-zinc-400 font-bold uppercase">{new Date(order.fecha?.seconds * 1000).toLocaleDateString()}</p>
                   </div>
                   <p className="font-black text-green-600">{formatCurrency(order.total || 0)}</p>
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
              {productsList.filter(p => p.stock < 5).map(p => (
                <div key={p.id} className="bg-zinc-800 p-4 rounded-xl border-l-4 border-yellow-500 flex justify-between items-center animate-shake">
                   <div>
                     <p className="font-black text-sm uppercase">{p.nombre}</p>
                     <p className="text-xs text-zinc-500">Solo quedan {p.stock} unidades</p>
                   </div>
                   <button onClick={() => handleUpdateStock(p.id, p.stock + 20)} className="text-[10px] font-black underline hover:text-yellow-400">SURTIR +20</button>
                </div>
              ))}
              {productsList.filter(p => p.stock < 5).length === 0 && <p className="text-zinc-600 font-bold italic">No hay alertas de inventario por ahora.</p>}
           </div>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="bg-white border-4 border-black rounded-[2rem] shadow-[10px_10px_0_0_rgba(0,0,0,1)] overflow-hidden animate-in zoom-in-95 duration-300">
      <div className="p-8 border-b-4 border-black bg-zinc-50 flex flex-col md:flex-row gap-4 justify-between items-center">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter">Base de Usuarios</h2>
        <div className="relative w-full md:w-auto">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="pl-10 pr-4 py-3 bg-white border-2 border-black rounded-xl outline-none focus:ring-4 focus:ring-red-500/10 transition-all font-bold text-sm w-full md:w-72" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
            {usersList.filter(u => u.email.includes(searchQuery.toLowerCase()) || u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
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
                          <span className="text-[10px] font-bold text-red-500 mt-1 uppercase">Vence: {formatDate(u.plan.expira)}</span>
                       </div>
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
                  <button onClick={() => handleDeleteUser(u.uid)} className="p-2 border-2 border-transparent hover:border-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-5 h-5 text-red-600" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
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
                   <p className={`text-xl font-black ${p.stock < 5 ? 'text-red-600 animate-shake' : 'text-zinc-900'}`}>{p.stock} UDS</p>
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
  );

  const renderPQRS = () => (
    <div className="space-y-8 animate-in slide-in-from-top-4 duration-500">
       <div className="bg-white p-8 border-4 border-black rounded-[2rem] shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-red-600 mb-2">Buzón de Atención (PQRS)</h2>
          <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Escucha y responde a los integrantes de la comunidad</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {pqrsList.map(pqrs => (
            <div key={pqrs.id} className={`bg-white border-4 border-black rounded-2xl shadow-[8px_8px_0_0_rgba(0,0,0,1)] transition-all ${pqrs.estado === 'resuelto' ? 'opacity-60 bg-zinc-50 shadow-none grayscale' : 'hover:-translate-y-1'}`}>
               <div className="p-6 flex gap-4">
                  <div className="w-16 h-16 bg-zinc-100 rounded-full border-3 border-black flex-shrink-0 overflow-hidden relative shadow-[3px_3px_0_0_rgba(0,0,0,1)]">
                     {pqrs.avatar || pqrs.photoURL ? (
                       <Image src={pqrs.avatar || pqrs.photoURL} alt="User" fill className="object-cover" />
                     ) : (
                       <Users className="p-4 text-zinc-300 w-full h-full" />
                     )}
                  </div>
                  <div className="flex-1">
                     <div className="flex justify-between items-start mb-2">
                        <div>
                           <h4 className="font-black uppercase text-sm">{pqrs.userName || 'Usuario'}</h4>
                           <p className="text-[10px] text-zinc-400 font-bold">{pqrs.userEmail}</p>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-1 border-2 border-black rounded ${pqrs.estado === 'resuelto' ? 'bg-green-400' : 'bg-yellow-400'}`}>
                           {pqrs.estado === 'resuelto' ? 'Resuelto' : 'Pendiente'}
                        </span>
                     </div>
                     <p className="text-xs text-zinc-500 font-bold mb-4 uppercase tracking-tighter italic">{pqrs.tipo} - {pqrs.fecha} {pqrs.hora}</p>
                     <p className="text-sm font-medium text-zinc-800 bg-zinc-50 p-4 border-2 border-dashed border-zinc-200 rounded-xl mb-4 leading-relaxed">"{pqrs.mensaje}"</p>
                     
                     {pqrs.estado !== 'resuelto' ? (
                       isReplying === pqrs.id ? (
                         <div className="space-y-3 bg-red-50 p-4 border-2 border-black rounded-xl">
                            <textarea 
                              placeholder="Escribe tu respuesta aquí..." 
                              className="w-full bg-white border-2 border-black p-3 rounded-lg outline-none text-sm font-medium focus:ring-4 focus:ring-red-500/10 min-h-[100px] resize-none"
                              value={replyMessage}
                              onChange={(e) => setReplyMessage(e.target.value)}
                            />
                            <div className="flex gap-2">
                               <button onClick={() => handleReplyPqrs(pqrs)} className="flex-1 bg-black text-white py-3 rounded-lg font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-zinc-800"><Send className="w-3 h-3" /> Enviar Respuesta</button>
                               <button onClick={() => setIsReplying(null)} className="p-3 bg-white border-2 border-black rounded-lg hover:bg-zinc-100"><X className="w-4 h-4" /></button>
                            </div>
                         </div>
                       ) : (
                         <button onClick={() => setIsReplying(pqrs.id)} className="w-full py-4 border-2 border-black rounded-xl font-black text-[10px] uppercase hover:bg-zinc-900 hover:text-white transition-all shadow-[4px_4px_0_0_rgba(0,0,0,1)] active:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"><Mail className="w-4 h-4 inline mr-2" /> Responder via Gmail</button>
                       )
                     ) : (
                       <div className="bg-green-50 p-4 border-2 border-green-200 rounded-xl">
                          <p className="text-[10px] font-black text-green-700 uppercase mb-2">✓ Respuesta enviada:</p>
                          <p className="text-xs text-green-800 font-medium italic">"{pqrs.respuesta_admin}"</p>
                       </div>
                     )}
                  </div>
               </div>
            </div>
          ))}
          {pqrsList.length === 0 && <div className="col-span-2 text-center py-20 bg-white border-4 border-black border-dashed rounded-[2rem] text-zinc-300 font-black italic text-2xl uppercase opacity-20">No hay tickets de atención aún</div>}
       </div>
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-8 animate-in fade-in duration-600">
       <div className="bg-white p-8 border-4 border-black rounded-[2rem] shadow-[6px_6px_0_0_rgba(0,0,0,1)] flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Historial de Ventas</h2>
            <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Listado de transacciones y pedidos procesados</p>
          </div>
          <div className="bg-zinc-900 border-2 border-black p-4 rounded-xl text-white">
             <p className="text-[10px] font-bold text-zinc-500 uppercase italic">Recaudado (Total)</p>
             <p className="text-2xl font-black text-green-400">{formatCurrency(ordersList.reduce((acc, o) => acc + (o.total || 0), 0))}</p>
          </div>
       </div>

       <div className="grid grid-cols-1 gap-6">
          {ordersList.map(order => (
            <div key={order.id} className="bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0_0_rgba(0,0,0,1)] overflow-hidden">
               <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-6 bg-zinc-50 border-b-2 border-zinc-100">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-zinc-900 border-2 border-black rounded-xl flex items-center justify-center text-white"><ShoppingBag /></div>
                     <div>
                        <p className="font-black uppercase text-sm">{order.customerName}</p>
                        <p className="text-xs text-zinc-400 font-bold font-mono uppercase tracking-tighter">ID: {order.id.slice(0, 12)}...</p>
                     </div>
                  </div>
                  <div className="flex gap-8 items-center text-center">
                     <div><p className="text-[10px] font-black uppercase text-zinc-400">Fecha</p><p className="text-sm font-bold">{new Date(order.fecha?.seconds * 1000).toLocaleDateString()}</p></div>
                     <div><p className="text-[10px] font-black uppercase text-zinc-400">Banco</p><p className="text-sm font-bold truncate max-w-[100px]">{order.banco}</p></div>
                     <div><p className="text-[10px] font-black uppercase text-zinc-400">Total</p><p className="text-xl font-black text-red-600 italic tracking-tighter">{formatCurrency(order.total || 0)}</p></div>
                  </div>
               </div>
               <div className="p-6">
                  <p className="text-[10px] font-black uppercase text-zinc-400 mb-4 tracking-widest">Artículos Comprados:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                     {order.items?.map((it:any, idx:number) => (
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
          Este centro de mando está reservado <br/> exclusivamente para personal administrativo <br/> de nivel 5 (FITMANIA ADMIN).
        </p>
        <div className="flex flex-col gap-3">
          <button onClick={() => window.location.href = '/'} className="w-full py-4 bg-black text-white font-black rounded-xl border-b-8 border-zinc-950 hover:-translate-y-1 transition-all shadow-[6px_6px_0_0_rgba(220,38,38,0.2)]">REGRESAR AL SITIO</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <style dangerouslySetInnerHTML={{__html: `
        .halftone { background-image: radial-gradient(circle, #ddd 1px, transparent 1px); background-size: 14px 14px; }
      `}} />
      <Toaster position="bottom-right" richColors />
      
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

      <main className="md:ml-64 p-4 md:p-12 min-h-screen halftone relative">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-8">
          <div>
            <h2 className="text-xs font-black text-red-600 uppercase tracking-[4px] mb-1">Fitmania Command Center</h2>
            <p className="text-4xl md:text-5xl font-black italic underline decoration-red-600 decoration-8 underline-offset-8 tracking-tighter uppercase">{activeTab === 'overview' ? 'Operaciones' : activeTab}</p>
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

        <div className="mb-20">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'inventory' && renderInventory()}
          {activeTab === 'pqrs' && renderPQRS()}
          {activeTab === 'orders' && renderOrders()}
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

      <ProductModal 
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        product={selectedProduct}
      />

      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes comicShake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-1deg); }
          75% { transform: rotate(1deg); }
        }
        .animate-shake {
          animation: comicShake 0.2s ease-in-out infinite;
        }
        main {
           background-image: 
            radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px),
            linear-gradient(to right, rgba(0,0,0,0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,0,0,0.02) 1px, transparent 1px);
           background-size: 20px 20px, 40px 40px, 40px 40px;
        }
        /* Custom scrollbar comic style */
        ::-webkit-scrollbar { width: 12px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; border-left: 3px solid black; }
        ::-webkit-scrollbar-thumb { background: black; border: 2px solid #f1f1f1; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }
      `}</style>
    </div>
  );
}
