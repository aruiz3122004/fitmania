'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import Image from 'next/image';

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretToken, setSecretToken] = useState('');
  
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [stats, setStats] = useState<any>(null);

  // Estados visuales: 'login' | 'verifying' | 'denied' | 'authorized'
  const [visualState, setVisualState] = useState<'login' | 'verifying' | 'denied' | 'authorized'>('login');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        verifyAdminStatus(currentUser);
      } else {
        setVisualState('login');
        setIsAdmin(false);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const verifyAdminStatus = async (userObj: User) => {
    try {
      // Forzamos la actualización del token
      const token = await userObj.getIdToken(true);
      const decodedResult = await userObj.getIdTokenResult();
      
      if (decodedResult.claims.admin === true) {
        setIsAdmin(true);
        setVisualState('authorized');
        fetchStats(token);
      } else {
        setIsAdmin(false);
        setVisualState('denied');
      }
    } catch (err) {
      console.error(err);
      setVisualState('denied');
    }
    setLoading(false);
  };

  const fetchStats = async (token: string) => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error obteniendo estadísticas", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    setVisualState('verifying');

    try {
      // 1. Iniciar sesión en Firebase
      const cred = await signInWithEmailAndPassword(auth, email, password);
      
      // 2. Comprobar si ya es admin
      const tokenResult = await cred.user.getIdTokenResult();
      
      if (tokenResult.claims.admin) {
        // Ya era admin
        setVisualState('authorized');
        fetchStats(await cred.user.getIdToken());
      } else {
        // No es admin, intentamos validar con el secret token para dárselo
        if (!secretToken) {
          throw new Error('Debes proveer un Token de Administrador para obtener privilegios.');
        }

        const res = await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: cred.user.uid, secretToken })
        });

        const data = await res.json();

        if (res.ok) {
          // Volvemos a verificar el estado para que detecte el nuevo claim
          await verifyAdminStatus(cred.user);
        } else {
          // Token inválido u otro error
          await signOut(auth);
          throw new Error(data.error || 'Token secreto inválido.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Error de autenticación.');
      setVisualState('denied');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setVisualState('login');
    setStats(null);
  };

  // Renderizamos el contenido según el estado visual
  const renderContent = () => {
    if (loading || visualState === 'verifying') {
      return (
        <div className="flex flex-col items-center p-8 space-y-4">
          <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl font-bold font-comic uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500">
            Verificando Credenciales...
          </p>
        </div>
      );
    }

    if (visualState === 'denied') {
      return (
        <div className="flex flex-col items-center p-8 space-y-6">
          <div className="relative w-full max-w-sm aspect-[4/3] rounded-xl overflow-hidden border-4 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.7)] group">
            <Image 
              src="/Imagenes/huella_admin/Denegado.jpeg" 
              alt="Acceso Denegado" 
              fill 
              className="object-cover group-hover:scale-110 transition-transform duration-500" 
            />
          </div>
          <p className="text-3xl font-black text-red-600 uppercase tracking-wider drop-shadow-md">
            ¡ACCESO DENEGADO!
          </p>
          <p className="text-red-500/80 font-bold text-center">{authError || 'No tienes privilegios de administrador.'}</p>
          <button 
            onClick={() => { setVisualState('login'); signOut(auth); }}
            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg uppercase shadow-lg hover:shadow-red-500/50 transition-all border-2 border-red-800 hover:-translate-y-1"
          >
            Reintentar
          </button>
        </div>
      );
    }

    if (visualState === 'authorized') {
      return (
        <div className="flex flex-col items-center p-8 w-full">
          <div className="relative w-64 h-64 mb-8 rounded-full overflow-hidden border-8 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.8)] animate-pulse-slow">
            <Image 
              src="/Imagenes/huella_admin/Autorizado.jpeg" 
              alt="Acceso Autorizado" 
              fill 
              className="object-cover" 
            />
          </div>
          
          <h2 className="text-4xl font-black text-green-500 uppercase tracking-widest mb-2 drop-shadow-md">
            BIENVENIDO, ADMIN
          </h2>
          <p className="text-gray-400 mb-8 font-semibold">Tus privilegios globales están habilitados.</p>

          {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
              <div className="bg-zinc-800 p-6 rounded-2xl border-l-4 border-blue-500 shadow-xl flex flex-col items-center">
                <span className="text-blue-400 text-sm uppercase tracking-wider font-bold mb-2">Usuarios Totales</span>
                <span className="text-5xl font-black text-white">{stats.totalUsers}</span>
              </div>
              <div className="bg-zinc-800 p-6 rounded-2xl border-l-4 border-purple-500 shadow-xl flex flex-col items-center">
                <span className="text-purple-400 text-sm uppercase tracking-wider font-bold mb-2">Administradores</span>
                <span className="text-5xl font-black text-white">{stats.admins}</span>
              </div>
              <div className="bg-zinc-800 p-6 rounded-2xl border-l-4 border-yellow-500 shadow-xl flex flex-col items-center">
                <span className="text-yellow-400 text-sm uppercase tracking-wider font-bold mb-2">Total PQRS</span>
                <span className="text-5xl font-black text-white">{stats.totalPqrs}</span>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mt-4"></div>
          )}

          <button 
            onClick={handleLogout}
            className="mt-12 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-lg uppercase shadow-lg transition-all border border-zinc-600"
          >
            Cerrar Sesión
          </button>
        </div>
      );
    }

    // Default Login
    return (
      <div className="w-full max-w-md p-8 md:p-12 relative flex justify-center flex-col items-center">
        {/* Diseño viñeta cómic para el encabezado */}
        <div className="absolute -top-6 -left-6 bg-yellow-400 text-black px-6 py-2 font-black text-2xl uppercase transform -rotate-6 border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          PANEL DE ADMIN
        </div>

        <h1 className="text-3xl font-black text-zinc-800 tracking-tighter uppercase mt-4 mb-8 text-center drop-shadow-md">
          Alto ahí,<br/> identifícate
        </h1>
        
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-5">
          <div>
            <label className="block text-zinc-700 font-bold uppercase text-sm mb-1 tracking-wider">Email</label>
            <input 
              type="email" 
              className="w-full bg-zinc-100 text-black px-4 py-3 rounded-lg border-2 border-zinc-300 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/20 outline-none transition-all font-semibold"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-zinc-700 font-bold uppercase text-sm mb-1 tracking-wider">Contraseña</label>
            <input 
              type="password" 
              className="w-full bg-zinc-100 text-black px-4 py-3 rounded-lg border-2 border-zinc-300 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/20 outline-none transition-all font-semibold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="relative">
            <label className="block text-red-600 font-black uppercase text-sm mb-1 tracking-wider">Secret Token</label>
            <input 
               type="password" 
               placeholder="Sólo si no tienes el rol"
               className="w-full bg-red-50 text-red-900 px-4 py-3 rounded-lg border-2 border-red-300 focus:border-red-600 focus:ring-4 focus:ring-red-600/20 outline-none transition-all font-semibold placeholder-red-300"
               value={secretToken}
               onChange={(e) => setSecretToken(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            className="mt-4 w-full py-4 bg-zinc-900 hover:bg-black text-white font-black text-xl rounded-xl uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl border-b-4 border-zinc-950 flex justify-center"
          >
            INGRESAR
          </button>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#0d0d12]">
      {/* Estilo CSS en línea para el fondo animado de cómic (Halftone pattern con movimiento) */}
      <style dangerouslySetInnerHTML={{__html: `
        .comic-bg {
          background-image: 
            radial-gradient(circle at center, #1a1a24 10%, transparent 10%),
            radial-gradient(circle at center, #1a1a24 10%, transparent 10%);
          background-size: 20px 20px;
          background-position: 0 0, 10px 10px;
          animation: moveBg 15s linear infinite;
        }
        @keyframes moveBg {
          100% { background-position: -40px -40px, -30px -30px; }
        }
        .comic-panel {
          box-shadow: 12px 12px 0px 0px rgba(0,0,0,0.5), inset 0 0 0 4px rgba(0,0,0,0.1);
        }
      `}} />
      
      {/* Grid pattern animado para el fondo */}
      <div className="absolute inset-0 comic-bg opacity-70"></div>
      
      {/* Destellos estilo cómic sueltos */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-500 rounded-full mix-blend-screen filter blur-[80px] animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-48 h-48 bg-red-600 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      {/* Contenedor tipo recuadro blanco que "respira" */}
      <div className="relative z-10 w-[95%] sm:w-full max-w-5xl comic-panel bg-white/95 backdrop-blur-sm rounded-[2rem] flex items-center justify-center min-h-[600px] hover:shadow-[16px_16px_0px_0px_rgba(0,0,0,0.6)] transition-all duration-300">
         {renderContent()}
      </div>
    </div>
  );
}
