'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Image from 'next/image';
import {
  ShieldCheck,
  ShieldAlert,
  Mail,
  Lock,
  Loader2,
  AlertTriangle,
  Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getRateLimitStatus, clearRateLimit, formatTimeLeft } from '@/lib/rate-limit-client';

interface AdminLoginFormProps {
  onSuccess: () => void;
}

export function AdminLoginForm({ onSuccess }: AdminLoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);
  
  // Estados para Rate Limit
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  // Efecto para la cuenta regresiva
  useEffect(() => {
    if (secondsLeft <= 0) {
      if (isBlocked) setIsBlocked(false);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, isBlocked]);

  // Verificar estado inicial y limpiar llave de la URL
  useEffect(() => {
    // 1. Limpiar la llave de la barra de direcciones de inmediato
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('key')) {
        url.searchParams.delete('key');
        window.history.replaceState({}, '', url.pathname);
      }
    }

    // 2. Cargar estado de rate limit
    const checkInitialStatus = async () => {
      const status = await getRateLimitStatus();
      setRemainingAttempts(status.remaining);
      if (!status.success) {
        setIsBlocked(true);
        setSecondsLeft(status.secondsLeft);
        setError(status.message || 'Límite excedido');
      }
    };
    checkInitialStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) return;
    
    setLoading(true);
    setError(null);

    try {
      // 1. Autenticar con Firebase (client-side)
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // 2. Verificar claim de admin antes de enviar al servidor
      const idTokenResult = await userCredential.user.getIdTokenResult();
      if (idTokenResult.claims.admin !== true) {
        throw new Error('No tienes permisos de administrador');
      }

      // 3. Obtener el ID Token y enviarlo al servidor para crear la cookie HttpOnly
      const idToken = await userCredential.user.getIdToken();
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      // Actualizar contadores desde los headers
      const remaining = response.headers.get('X-RateLimit-Remaining');
      if (remaining) setRemainingAttempts(parseInt(remaining));

      if (!response.ok) {
        const data = await response.json();
        
        if (response.status === 429) {
          setIsBlocked(true);
          const reset = parseInt(response.headers.get('X-RateLimit-Reset') || '0');
          const wait = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
          setSecondsLeft(wait);
          throw new Error(data.error || 'Has excedido el límite de intentos.');
        }
        
        throw new Error(data.error || 'Error al crear sesión segura');
      }

      // Sesión creada con cookie HttpOnly — no hay token en el cliente
      setAuthSuccess(true);
      toast.success('Acceso Autorizado');
      
      // Limpiar rate limit histórico de fallos exitosamente
      await clearRateLimit();

      // Limpiar la URL (quitar la ?key= de la barra de direcciones)
      if (typeof window !== 'undefined') {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }

      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Credenciales Inválidas u otro error de campo');
      toast.error(isBlocked ? 'Seguridad: Límite excedido' : 'Acceso Denegado');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d12] p-6 font-sans">
      <div className={cn(
        "bg-white border-8 border-black p-8 md:p-12 rounded-[2.5rem] shadow-[20px_20px_0_0_rgba(220,38,38,1)] max-w-md w-full transition-all duration-500 relative overflow-hidden",
        (error || isBlocked) ? "animate-shake" : "animate-in zoom-in-95"
      )}>

        {/* Indicador de Intentos (Header) */}
        {!authSuccess && remainingAttempts !== null && !isBlocked && (
          <div className="absolute top-4 right-6 flex items-center gap-2">
            <div className={cn(
              "flex gap-1",
              remainingAttempts <= 2 ? "animate-pulse" : ""
            )}>
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-2 h-2 rounded-full border border-black",
                    i < remainingAttempts ? "bg-green-500" : "bg-red-200"
                  )}
                />
              ))}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              {remainingAttempts} intentos
            </span>
          </div>
        )}

        {authSuccess ? (
          <div className="flex flex-col items-center justify-center p-8 animate-in zoom-in duration-500">
            <div className="relative w-full aspect-[4/3] max-w-[300px] mb-8 rounded-3xl overflow-hidden border-8 border-black shadow-[10px_10px_0_0_rgba(0,128,0,1)] bg-green-500 flex items-center justify-center group">
              <ShieldCheck className="w-32 h-32 text-black group-hover:scale-110 transition-transform drop-shadow-[5px_5px_0_rgba(0,0,0,0.5)] z-10" strokeWidth={2.5} />
            </div>
            <h3 className="text-3xl font-black italic text-green-600 uppercase tracking-tighter animate-pulse" style={{ fontFamily: 'var(--font-display)' }}>
              ACCESO CONCEDIDO
            </h3>
          </div>
        ) : isBlocked ? (
          <div className="flex flex-col items-center justify-center p-8 animate-in zoom-in duration-500">
            <div className="relative w-full aspect-[4/3] max-w-[300px] mb-8 rounded-3xl overflow-hidden border-8 border-black shadow-[10px_10px_0_0_rgba(220,38,38,1)] bg-red-600 flex flex-col items-center justify-center group">
              <AlertTriangle className="w-24 h-24 text-white mb-2 animate-bounce" strokeWidth={2.5} />
              <div className="bg-black text-white px-4 py-1 rounded-full font-black text-xl flex items-center gap-2">
                <Timer className="w-5 h-5" />
                {formatTimeLeft(secondsLeft)}
              </div>
            </div>
            <h3 className="text-2xl font-black italic text-red-600 uppercase tracking-tighter mb-2 text-center" style={{ fontFamily: 'var(--font-display)' }}>
              SISTEMA BLOQUEADO
            </h3>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[2px] text-center mb-6">
              Detectados demasiados intentos fallidos. <br />Seguridad activada.
            </p>
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden border-2 border-black">
              <div 
                className="h-full bg-red-600 transition-all duration-1000 ease-linear"
                style={{ width: `${(secondsLeft / 60) * 100}%` }}
              />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-8 animate-in zoom-in duration-500">
            <div className="relative w-full aspect-[4/3] max-w-[300px] mb-8 rounded-3xl overflow-hidden border-8 border-black shadow-[10px_10px_0_0_rgba(220,38,38,1)] bg-red-500 flex items-center justify-center group">
              <ShieldAlert className="w-32 h-32 text-black group-hover:scale-110 transition-transform drop-shadow-[5px_5px_0_rgba(0,0,0,0.5)] z-10" strokeWidth={2.5} />
            </div>
            <h3 className="text-3xl font-black italic text-red-600 uppercase tracking-tighter mb-4 text-center leading-none" style={{ fontFamily: 'var(--font-display)' }}>
              ERROR DE <br />VERIFICACIÓN
            </h3>
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-[1px] text-center mb-6 px-4">
              {error}
            </p>
            <button
              onClick={() => setError(null)}
              className="px-8 py-4 bg-black text-white font-black uppercase text-sm border-b-8 border-zinc-900 rounded-2xl hover:bg-zinc-800 hover:-translate-y-1 active:translate-y-0 active:border-b-0 transition-all shadow-comic-sm"
            >
              REINTENTAR MANIOBRA
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-10 pt-4">
              <div className="w-28 h-28 bg-primary border-4 border-black rounded-full mx-auto flex items-center justify-center shadow-[6px_6px_0_0_rgba(0,0,0,1)] mb-6 overflow-hidden relative">
                <Image
                  src="/Imagenes/Avatares/FitmanNEW.png"
                  alt="Fitmania"
                  fill
                  sizes="112px"
                  className="object-cover scale-[1.65] translate-y-3"
                />
              </div>
              <h2 className="text-4xl font-black lowercase italic tracking-tighter mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                SISTEMA <span className="text-primary">ADMIN</span>
              </h2>
              <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-[4px]">Verificación de Identidad</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div className="relative group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-2">Email del Administrador</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
                  <input
                    type="email"
                    required
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 border-4 border-black rounded-2xl font-bold focus:bg-white focus:ring-8 focus:ring-red-600/5 outline-none transition-all"
                    placeholder="nombre@fitmania.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="relative group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-2">Código de Acceso</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
                  <input
                    type="password"
                    required
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 border-4 border-black rounded-2xl font-bold focus:bg-white focus:ring-8 focus:ring-red-600/5 outline-none transition-all"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || isBlocked}
                className="w-full py-5 bg-black text-white font-black uppercase tracking-widest rounded-3xl border-b-8 border-zinc-900 flex items-center justify-center gap-3 hover:-translate-y-1 hover:bg-zinc-800 transition-all active:translate-y-0 active:border-b-0 disabled:opacity-50 shadow-[10px_10px_0_0_rgba(220,38,38,0.3)] hover:shadow-[15px_15px_0_0_rgba(220,38,38,0.5)]"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'INICIAR SESIÓN'}
              </button>
            </form>

            <p className="mt-10 text-center text-[9px] font-bold text-zinc-400 uppercase tracking-[2px]">
              Fitmania Control System v2.0 - Reservado para administradores
            </p>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes comicShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px) rotate(-1deg); }
          75% { transform: translateX(10px) rotate(1deg); }
        }
        .animate-shake {
          animation: comicShake 0.2s ease-in-out 3;
        }
      `}</style>
    </div>
  );
}
