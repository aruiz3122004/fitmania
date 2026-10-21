'use client'

import { useState, useEffect } from 'react'
import { Toaster, toast } from 'sonner'

import { ReceptionLoginForm } from '@/components/recepcion/reception-login-form'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { useIdleLogout } from '@/lib/use-idle-logout'
import { verifyPassOffline, ACCESS_TOKEN_PREFIX } from '@/lib/access-token-client'
import { cacheMembers, cachedMembers, enqueueOfflineEntry, pendingOfflineEntries, syncOfflineEntries } from '@/lib/offline-entries'
import { ShieldCheck, LogOut, QrCode, Search, CheckCircle2, UserCircle, Users, ShoppingCart, History, CalendarDays, XCircle, ClipboardList, Package } from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import EntryHistoryTab from '@/components/recepcion/entry-history-tab'
import InventoryTab from '@/components/recepcion/inventory-tab'

const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then((mod) => mod.Scanner), {
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-100 animate-pulse flex items-center justify-center font-black uppercase text-zinc-400">Iniciando Cámara...</div>
})

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutos

export default function ReceptionPage() {
  const [visualState, setVisualState] = useState<'login' | 'unauthorized' | 'dashboard'>('login')
  const [usersList, setUsersList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showScanner, setShowScanner] = useState(false)
  const [scannedUser, setScannedUser] = useState<any>(null)
  const [simulatorId, setSimulatorId] = useState('')
  const [activeTab, setActiveTab] = useState('scanner') // 'scanner' | 'members'
  const [userOrders, setUserOrders] = useState<any[]>([])
  const [userCheckIns, setUserCheckIns] = useState<any[]>([])
  const [isFetchingLogs, setIsFetchingLogs] = useState(false)
  // F2-06: ingresos pendientes de sincronizar y estado de la red.
  const [pendingSync, setPendingSync] = useState(0)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setPendingSync(pendingOfflineEntries().length)
    setIsOnline(navigator.onLine)
    const trySync = async () => {
      if (!navigator.onLine || pendingOfflineEntries().length === 0) return
      const { synced, remaining } = await syncOfflineEntries()
      setPendingSync(remaining)
      if (synced > 0) toast.success(`${synced} ingreso(s) sin conexión sincronizado(s).`)
    }
    const goOnline = () => { setIsOnline(true); trySync() }
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    const timer = setInterval(trySync, 60_000)
    trySync()
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    // Verificar la sesión leyendo la cookie HttpOnly vía el servidor
    const checkReceptionSession = async () => {
      try {
        const res = await fetch('/api/auth/verify?role=recepcion');
        if (res.ok) {
          // Si la cookie es válida, verificar estado de Firebase
          const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
              setVisualState('dashboard');
              fetchUsers();
            } else {
              setVisualState('login');
              setLoading(false);
            }
          });
          return unsubscribe;
        } else {
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
    checkReceptionSession().then(unsub => { unsubscribeFirebase = unsub; });
    return () => { if (unsubscribeFirebase) unsubscribeFirebase(); };
  }, []);

  // F2-18: el directorio y la ficha del socio vienen del servidor con datos mínimos
  // (antes el navegador leía toda la colección `users`, con peso, altura y correo).
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/recepcion/members')
      if (res.status === 401) {
        setVisualState('login')
        return
      }
      if (!res.ok) throw new Error('members')
      const data = await res.json()
      const members = Array.isArray(data.members) ? data.members : []
      setUsersList(members)
      cacheMembers(members) // F2-06: directorio disponible sin conexión
    } catch (e) {
      console.error("Error al cargar socios:", e)
      const cached = cachedMembers()
      if (cached) {
        setUsersList(cached.members)
        toast.warning('Sin conexión: usando el directorio guardado.')
      } else {
        toast.error('No se pudo cargar el directorio de socios.')
      }
    } finally {
      setLoading(false)
    }
  }

  // F2-06: sin red el pase firmado se verifica localmente con la clave pública.
  const scanOffline = async (code: string) => {
    if (code.startsWith(ACCESS_TOKEN_PREFIX)) {
      const result = await verifyPassOffline(code)
      if (!result.ok) {
        toast.error(result.reason)
        return
      }
      const p = result.payload
      setScannedUser({
        id: p.uid,
        username: p.n,
        photoURL: null,
        plan: p.pe ? { nombre: p.p || 'Plan', expira: { seconds: Math.floor(p.pe / 1000) } } : null,
        offline: true,
      })
    } else {
      // QR antiguo (UID): solo si el socio está en el directorio guardado.
      const member = (cachedMembers()?.members || []).find((m: any) => m.id === code)
      if (!member) {
        toast.error('Sin conexión: código no verificable.')
        return
      }
      setScannedUser({ ...member, offline: true })
    }
    setUserOrders([])
    setUserCheckIns([])
    setShowScanner(false)
    toast.warning('Modo sin conexión: el ingreso se sincronizará al volver la red.')
  }

  const handleScan = async (text: string, manual = false) => {
    const code = text?.trim()
    if (!code) return;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await scanOffline(code)
      return
    }

    setIsFetchingLogs(true)
    try {
      const res = await fetch('/api/recepcion/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, manual }),
      })
      if (res.status === 401) {
        setVisualState('login')
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || (res.status === 404 ? 'Código QR inválido o socio no encontrado' : 'Error consultando el socio'))
        return
      }
      setScannedUser(data.member)
      setUserOrders(Array.isArray(data.orders) ? data.orders : [])
      setUserCheckIns(Array.isArray(data.checkIns) ? data.checkIns : [])
      setShowScanner(false)
      toast.success(data.signed ? 'Pase verificado' : 'Usuario encontrado (QR antiguo)')
    } catch (err) {
      // Error de red: se intenta la verificación local.
      console.error("Error consultando socio:", err)
      await scanOffline(code)
    } finally {
      setIsFetchingLogs(false)
    }
  }

  const handleSimulateScan = () => {
    handleScan(simulatorId, true)
  }

  const queueOffline = () => {
    enqueueOfflineEntry(scannedUser.id, scannedUser.username || 'Socio')
    setPendingSync(pendingOfflineEntries().length)
    toast.warning('Sin conexión: ingreso guardado en este equipo; se sincroniza al volver la red.')
    setScannedUser(null)
    setSimulatorId('')
  }

  const handleAuthorize = async () => {
    if (!scannedUser) return;

    if (scannedUser.offline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      queueOffline()
      return
    }

    try {
      // El servidor registra entry_logs + checkIns en una transacción, deriva el estado
      // del plan desde Firestore y rechaza duplicados (409). Solo se envía el uid.
      const res = await fetch('/api/recepcion/entry-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: scannedUser.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          toast.warning(data.error || 'Este socio ya registró su ingreso.')
        } else {
          toast.error(data.error || 'Error al registrar acceso.')
        }
        return
      }

      if (data.hasPlanActivo) {
        toast.success('Acceso autorizado y registrado.')
      } else {
        toast.warning('Ingreso registrado SIN plan activo.')
      }
      setScannedUser(null)
      setSimulatorId('')
    } catch (error) {
      // Se cayó la red al registrar: se guarda para sincronizar.
      queueOffline()
    }
  }

  const handleLogout = async () => {
    // Cerrar SOLO la sesión del panel de recepción (cookie HttpOnly).
    // No usar auth.signOut(): cerraba la cuenta de Firebase y obligaba a
    // volver a iniciar sesión en el sitio. La cuenta debe permanecer activa.
    try {
      await fetch('/api/recepcion/logout', { method: 'POST' });
    } finally {
      window.location.href = '/';
    }
  };

  // F1-15: tras 30 min sin actividad se cierra el panel Y la cuenta de Firebase, para
  // que volver a entrar exija la contraseña (un equipo desatendido no queda abierto).
  useIdleLogout(visualState === 'dashboard', IDLE_TIMEOUT_MS, async () => {
    try {
      await fetch('/api/recepcion/logout', { method: 'POST' });
      await signOut(auth);
    } finally {
      window.location.href = '/login?motivo=inactividad';
    }
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 font-display text-white text-2xl uppercase tracking-widest animate-pulse">Cargando Sistema...</div>
  }

  if (visualState === 'login') {
    return <ReceptionLoginForm onSuccessAction={() => { setVisualState('dashboard'); fetchUsers(); }} />
  }

  if (visualState === 'unauthorized') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d12] p-6 font-sans">
        <div className="bg-white border-8 border-black p-12 rounded-[2rem] shadow-[20px_20px_0_0_rgba(22,163,74,1)] max-w-sm text-center animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-green-100 rounded-3xl mx-auto flex items-center justify-center mb-8 border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <XCircle className="w-16 h-16 text-green-600" />
          </div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-4" style={{ fontFamily: 'var(--font-display)' }}>ACCESO RESTRINGIDO</h2>
          <p className="text-zinc-500 font-bold mb-8 italic uppercase text-[10px] tracking-widest leading-relaxed">
            Este panel está reservado <br /> exclusivamente para el personal <br /> oficial de RECEPCIÓN.
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={() => window.location.href = '/'} className="w-full py-4 bg-black text-white font-black rounded-xl border-b-8 border-zinc-950 hover:-translate-y-1 transition-all shadow-[6px_6px_0_0_rgba(22,163,74,0.2)]">REGRESAR AL SITIO</button>
          </div>
        </div>
      </div>
    )
  }

  const activeMembers = usersList.filter(u => u.plan && new Date(u.plan.expira.seconds * 1000) > new Date())

  return (
    <div className="min-h-screen bg-green-50 font-sans text-zinc-900 pb-20">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="bg-green-700 text-white p-4 sm:p-6 border-b-8 border-black flex flex-col sm:flex-row justify-between items-center shadow-[0_8px_0_0_rgba(0,0,0,1)] z-10 relative">
        <div className="flex items-center gap-4 mb-4 sm:mb-0">
          <div className="w-12 h-12 bg-white rounded-xl border-4 border-black flex items-center justify-center text-green-700 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="font-display text-2xl uppercase italic tracking-wider leading-none">Recepcion</h1>
            <p className="font-label text-[10px] uppercase tracking-[3px] text-green-200">Fitmania Command Center</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(!isOnline || pendingSync > 0) && (
            <span className={`px-3 py-2 border-2 border-black rounded font-label text-[10px] uppercase font-black ${isOnline ? 'bg-yellow-300 text-black' : 'bg-red-600 text-white'}`}>
              {isOnline ? 'Sincronizando' : 'Sin conexión'}{pendingSync > 0 ? ` · ${pendingSync} pendiente(s)` : ''}
            </span>
          )}
          <button onClick={handleLogout} className="flex items-center gap-2 bg-black text-white px-4 py-2 border-2 border-white rounded font-label text-xs uppercase font-bold hover:bg-zinc-800 transition-colors">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex justify-center mt-8 gap-3 px-4 flex-wrap">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex-1 max-w-[180px] py-4 rounded-t-2xl font-black uppercase text-xs sm:text-sm border-t-4 border-x-4 border-black transition-all ${activeTab === 'scanner' ? 'bg-white shadow-[0_-4px_0_0_rgba(22,163,74,1)]' : 'bg-green-200 text-green-800 border-b-4 hover:bg-green-300'}`}
        >
          <QrCode className="w-4 h-4 mx-auto mb-1 sm:hidden" />
          Escaner QR
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 max-w-[180px] py-4 rounded-t-2xl font-black uppercase text-xs sm:text-sm border-t-4 border-x-4 border-black transition-all ${activeTab === 'members' ? 'bg-white shadow-[0_-4px_0_0_rgba(22,163,74,1)]' : 'bg-green-200 text-green-800 border-b-4 hover:bg-green-300'}`}
        >
          <Users className="w-4 h-4 mx-auto mb-1 sm:hidden" />
          Directorio
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 max-w-[180px] py-4 rounded-t-2xl font-black uppercase text-xs sm:text-sm border-t-4 border-x-4 border-black transition-all ${activeTab === 'history' ? 'bg-white shadow-[0_-4px_0_0_rgba(22,163,74,1)]' : 'bg-green-200 text-green-800 border-b-4 hover:bg-green-300'}`}
        >
          <ClipboardList className="w-4 h-4 mx-auto mb-1 sm:hidden" />
          Historial
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 max-w-[180px] py-4 rounded-t-2xl font-black uppercase text-xs sm:text-sm border-t-4 border-x-4 border-black transition-all ${activeTab === 'inventory' ? 'bg-white shadow-[0_-4px_0_0_rgba(22,163,74,1)]' : 'bg-green-200 text-green-800 border-b-4 hover:bg-green-300'}`}
        >
          <Package className="w-4 h-4 mx-auto mb-1 sm:hidden" />
          Inventario
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-8">

        {/* Scanner Tab */}
        {activeTab === 'scanner' && (
          <div className="bg-white p-6 sm:p-12 border-x-4 border-b-4 border-black rounded-b-[2rem] shadow-[12px_12px_0_0_rgba(0,0,0,1)]">
            {!scannedUser ? (
              <div className="flex flex-col items-center">
                <h2 className="font-display text-3xl uppercase italic mb-8 text-center">Autorizar Acceso</h2>

                {/* Real Scanner */}
                {showScanner ? (
                  <div className="w-full max-w-sm mb-8 border-8 border-black rounded-3xl overflow-hidden relative shadow-[8px_8px_0_0_rgba(22,163,74,1)]">
                    <Scanner onScan={(result) => { if (result && result.length > 0) handleScan(result[0].rawValue) }} onError={(e) => console.log(e)} />
                    <button onClick={() => setShowScanner(false)} className="absolute top-4 right-4 bg-red-600 text-white font-bold p-2 text-xs border-2 border-black rounded-lg">Cerrar Camara</button>
                  </div>
                ) : (
                  <button onClick={() => setShowScanner(true)} className="flex flex-col items-center gap-4 bg-green-100 border-4 border-green-600 p-8 rounded-3xl mb-8 hover:bg-green-200 transition-colors shadow-[6px_6px_0_0_rgba(22,163,74,1)]">
                    <QrCode className="w-20 h-20 text-green-700" />
                    <span className="font-label font-black uppercase text-green-800 tracking-widest text-lg">Abrir Cámara</span>
                  </button>
                )}

                <div className="flex items-center gap-4 w-full mb-8">
                  <div className="flex-1 h-1 bg-zinc-200" />
                  <span className="font-label text-xs text-zinc-400 font-bold uppercase">Ó Utiliza el Simulador Manual</span>
                  <div className="flex-1 h-1 bg-zinc-200" />
                </div>

                {/* Simulator */}
                <div className="w-full relative">
                  <select
                    value={simulatorId}
                    onChange={(e) => setSimulatorId(e.target.value)}
                    className="w-full p-4 pl-12 border-4 border-black font-bold uppercase rounded-xl appearance-none bg-zinc-50 focus:border-green-600 outline-none"
                  >
                    <option value="">Selecciona un usuario...</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>{u.username || u.email}</option>
                    ))}
                  </select>
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                </div>
                <button onClick={handleSimulateScan} disabled={!simulatorId} className="w-full mt-4 bg-black text-white p-4 font-black uppercase rounded-xl border-b-8 border-zinc-900 active:translate-y-2 active:border-b-0 transition-all disabled:opacity-50">
                  Simular Lector
                </button>
              </div>
            ) : (
              <div className="animate-in zoom-in-95 duration-300 w-full">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 sm:p-8 bg-zinc-50 border-4 border-black rounded-3xl mb-8 relative shadow-[8px_8px_0_0_rgba(0,0,0,1)] text-center sm:text-left">
                  {scannedUser.plan && new Date(scannedUser.plan.expira.seconds * 1000) > new Date() ? (
                    <div className="absolute -top-4 -right-4 w-12 h-12 bg-green-500 border-4 border-black rounded-full flex items-center justify-center animate-bounce shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                      <CheckCircle2 className="text-white w-6 h-6" />
                    </div>
                  ) : (
                    <div className="absolute -top-4 -right-4 w-12 h-12 bg-red-600 border-4 border-black rounded-full flex items-center justify-center animate-bounce shadow-[4px_4px_0_0_rgba(0,0,0,1)] text-white font-black">
                      X
                    </div>
                  )}

                  <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl border-4 border-black overflow-hidden bg-white shrink-0 shadow-[4px_4px_0_0_rgba(0,0,0,1)] mx-auto sm:mx-0">
                    {scannedUser.photoURL || scannedUser.avatar ? (
                      <Image src={scannedUser.photoURL || scannedUser.avatar} alt="Foto" width={160} height={160} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-200">
                        <UserCircle className="w-16 h-16 text-zinc-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 w-full">
                    <h3 className="font-display italic text-3xl sm:text-4xl uppercase mb-1 leading-none break-words text-secondary">{scannedUser.username || 'Desconocido'}</h3>
                    <p className="font-label text-xs sm:text-sm text-zinc-500 font-bold uppercase tracking-widest mb-4 break-all">{scannedUser.email}</p>

                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-6">
                      <div className="flex items-center gap-2 bg-zinc-200 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase text-zinc-600">
                        <CalendarDays className="w-4 h-4" />
                        Desde: {scannedUser.createdAt ? new Date(scannedUser.createdAt.seconds * 1000).toLocaleDateString() : 'Desconocido'}
                      </div>
                    </div>

                    <div className="p-4 bg-white border-4 border-dashed border-zinc-200 rounded-2xl">
                      <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">Estado de Membresía</p>
                      {scannedUser.plan ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                          <p className={`font-black uppercase text-xl leading-none ${new Date(scannedUser.plan.expira.seconds * 1000) > new Date() ? 'text-green-600' : 'text-red-600'}`}>
                            {scannedUser.plan.nombre}
                          </p>
                          <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-xl border-2 shrink-0 ${new Date(scannedUser.plan.expira.seconds * 1000) > new Date() ? 'bg-green-100 border-green-600 text-green-700' : 'bg-red-100 border-red-600 text-red-700'}`}>
                            {new Date(scannedUser.plan.expira.seconds * 1000) > new Date() ? 'VIGENTE' : 'VENCIDO'}
                          </span>
                        </div>
                      ) : (
                        <p className="font-black uppercase text-xl text-zinc-400">Visitante (Sin Plan)</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Logs Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {/* Purchase History */}
                  <div className="bg-zinc-900 text-white p-5 rounded-3xl border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingCart className="w-4 h-4 text-green-400" />
                      <h4 className="font-display italic text-sm uppercase tracking-widest text-green-400">Tienda Fitmania</h4>
                    </div>
                    <div className="space-y-3 min-h-[100px]">
                      {isFetchingLogs ? (
                        <div className="h-full flex items-center justify-center animate-pulse text-zinc-600 text-[10px] font-black italic uppercase">Buscando Compras...</div>
                      ) : userOrders.length > 0 ? (
                        userOrders.map(order => (
                          <div key={order.id} className="border-b border-zinc-700 pb-2 last:border-0">
                            <div className="flex justify-between items-start">
                              <p className="text-[10px] font-bold text-zinc-400 uppercase">{new Date(order.fecha.seconds * 1000).toLocaleDateString()}</p>
                              <p className="text-xs font-black text-green-500">${order.total}</p>
                            </div>
                            <p className="text-[10px] text-zinc-300 font-medium truncate">
                              {order.concepto || order.items?.map((it: any) => it.nombre).join(', ')}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-zinc-600 text-[10px] font-bold italic uppercase mt-4">Sin compras registradas</p>
                      )}
                    </div>
                  </div>

                  {/* Recent Check-ins */}
                  <div className="bg-white p-5 rounded-3xl border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                    <div className="flex items-center gap-2 mb-4">
                      <History className="w-4 h-4 text-zinc-900" />
                      <h4 className="font-display italic text-sm uppercase tracking-widest">Últimos Ingresos</h4>
                    </div>
                    <div className="space-y-3 min-h-[100px]">
                      {isFetchingLogs ? (
                        <div className="h-full flex items-center justify-center animate-pulse text-zinc-300 text-[10px] font-black italic uppercase">Cuidando accesos...</div>
                      ) : userCheckIns.length > 0 ? (
                        userCheckIns.map(check => (
                          <div key={check.id} className="flex items-center gap-3 border-b border-zinc-100 pb-2 last:border-0">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <div>
                              <p className="text-[10px] font-black uppercase text-zinc-900">
                                {new Date(check.timestamp.seconds * 1000).toLocaleDateString()}
                              </p>
                              <p className="text-[9px] font-bold text-zinc-400 uppercase">
                                {new Date(check.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-zinc-300 text-[10px] font-bold italic uppercase mt-4">Primer ingreso hoy</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setScannedUser(null)} className="flex-1 py-5 font-black uppercase text-sm border-4 border-black rounded-xl hover:bg-zinc-100 transition-colors">Cancelar</button>
                  <button
                    onClick={handleAuthorize}
                    className="flex-1 py-5 bg-green-600 text-white font-black uppercase text-sm border-b-8 border-black rounded-xl shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 transition-all active:translate-y-1 active:border-b-0 disabled:opacity-50"
                  >
                    Autorizar Ingreso
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <EntryHistoryTab />
        )}

        {activeTab === 'inventory' && (
          <InventoryTab />
        )}

        {/* Members Directory Tab */}
        {activeTab === 'members' && (
          <div className="bg-white p-6 sm:p-12 border-x-4 border-b-4 border-black rounded-b-[2rem] shadow-[12px_12px_0_0_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 mb-8">
              <Users className="w-8 h-8 text-black" />
              <h2 className="font-display text-3xl uppercase italic">Directorio de Miembros Activos</h2>
            </div>

            <div className="space-y-4">
              {activeMembers.map(user => (
                <div key={user.id} className="p-5 border-4 border-black rounded-2xl shadow-[6px_6px_0_0_rgba(0,0,0,1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-black uppercase text-xl">{user.username}</p>
                    <p className="font-label text-xs text-zinc-500 font-bold tracking-widest">{user.plan.nombre}</p>
                  </div>

                  {user.plan.acompanante ? (
                    <div className="bg-blue-50 border-2 border-blue-600 p-3 rounded-lg flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white"><Users className="w-4 h-4" /></div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Acompañante</p>
                        <p className="font-bold text-sm">{user.plan.acompanante.nombre}</p>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">Días permitidos: {user.plan.acompanante.rutinaDias?.join(', ')}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-zinc-400 border-2 border-zinc-200 px-3 py-1 rounded-full uppercase">Individual</span>
                  )}
                </div>
              ))}
              {activeMembers.length === 0 && (
                <p className="text-center font-bold text-zinc-400 py-12">No hay miembros activos actualmente.</p>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
