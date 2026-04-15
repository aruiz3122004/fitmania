'use client'

import { useState, useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import { ReceptionLoginForm } from '@/components/recepcion/reception-login-form'
import { db, auth } from '@/lib/firebase'
import { collection, getDocs, doc, setDoc, query, where, orderBy, limit } from 'firebase/firestore'
import { ShieldCheck, LogOut, QrCode, Search, CheckCircle2, UserCircle, Users, ShoppingCart, History, CalendarDays, XCircle } from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'

const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then((mod) => mod.Scanner), {
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-100 animate-pulse flex items-center justify-center font-black uppercase text-zinc-400">Iniciando Cámara...</div>
})

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

  useEffect(() => {
    // Verificar la sesión leyendo la cookie HttpOnly vía el servidor
    const checkReceptionSession = async () => {
      try {
        const res = await fetch('/api/auth/verify?role=reception');
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

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'))
      const users: any[] = []
      snap.forEach(doc => {
        users.push({ id: doc.id, ...doc.data() })
      })
      setUsersList(users)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleScan = async (text: string) => {
    if (!text) return;
    const user = usersList.find(u => u.id === text)
    if (user) {
      setScannedUser(user)
      setShowScanner(false)
      toast.success('Usuario encontrado')

      // Fetch additional logs
      setIsFetchingLogs(true)
      try {
        // Orders
        const ordersQuery = query(
          collection(db, 'orders'),
          where('uid', '==', user.id),
          orderBy('fecha', 'desc'),
          limit(5)
        )
        const ordersSnap = await getDocs(ordersQuery)
        const orders: any[] = []
        ordersSnap.forEach(d => orders.push({ id: d.id, ...d.data() }))
        setUserOrders(orders)

        // Check-ins
        const checkinsQuery = query(
          collection(db, 'checkIns'),
          where('userId', '==', user.id),
          orderBy('timestamp', 'desc'),
          limit(5)
        )
        const checkinsSnap = await getDocs(checkinsQuery)
        const checkins: any[] = []
        checkinsSnap.forEach(d => checkins.push({ id: d.id, ...d.data() }))
        setUserCheckIns(checkins)

      } catch (err) {
        console.error("Error fetching user logs:", err)
      } finally {
        setIsFetchingLogs(false)
      }
    } else {
      toast.error('Código QR Invalido o Usuario no encontrado')
    }
  }

  const handleSimulateScan = () => {
    handleScan(simulatorId)
  }

  const handleAuthorize = async () => {
    if (!scannedUser) return;

    try {
      const checkInRef = doc(collection(db, 'checkIns'))
      await setDoc(checkInRef, {
        userId: scannedUser.id,
        userName: scannedUser.username || scannedUser.email,
        timestamp: new Date(),
        authorizedBy: 'Recepcionista'
      });
      toast.success('Acceso autorizado y registrado.')
      setScannedUser(null)
      setSimulatorId('')
    } catch (error) {
      toast.error('Error al registrar acceso.')
    }
  }

  const handleLogout = async () => {
    await fetch('/api/recepcion/logout', { method: 'POST' });
    await auth.signOut();
    setVisualState('login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 font-display text-white text-2xl uppercase tracking-widest animate-pulse">Cargando Sistema...</div>
  }

  if (visualState === 'login') {
    return <ReceptionLoginForm onSuccess={() => { setVisualState('dashboard'); fetchUsers(); }} />
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
        <button onClick={handleLogout} className="flex items-center gap-2 bg-black text-white px-4 py-2 border-2 border-white rounded font-label text-xs uppercase font-bold hover:bg-zinc-800 transition-colors">
          <LogOut className="w-4 h-4" /> Salir
        </button>
      </header>

      {/* Tabs */}
      <div className="flex justify-center mt-8 gap-4 px-4">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex-1 max-w-[200px] py-4 rounded-t-2xl font-black uppercase text-sm border-t-4 border-x-4 border-black transition-all ${activeTab === 'scanner' ? 'bg-white shadow-[0_-4px_0_0_rgba(22,163,74,1)]' : 'bg-green-200 text-green-800 border-b-4 hover:bg-green-300'}`}
        >
          Escaner QR
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 max-w-[200px] py-4 rounded-t-2xl font-black uppercase text-sm border-t-4 border-x-4 border-black transition-all ${activeTab === 'members' ? 'bg-white shadow-[0_-4px_0_0_rgba(22,163,74,1)]' : 'bg-green-200 text-green-800 border-b-4 hover:bg-green-300'}`}
        >
          Directorio
        </button>
      </div>

      <main className="max-w-4xl mx-auto px-4">

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
                              {order.items?.map((it: any) => it.nombre).join(', ')}
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
