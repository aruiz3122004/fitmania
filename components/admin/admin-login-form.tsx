'use client';

import React, { useState } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Image from 'next/image';
import {
  ShieldCheck,
  ShieldAlert,
  Mail,
  Lock,
  Key,
  Loader2,
  AlertCircle,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AdminLoginFormProps {
  onSuccess: (token: string) => void;
}

export function AdminLoginForm({ onSuccess }: AdminLoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Validar Token de Seguridad (Insensible a mayúsculas para evitar errores)
      if (token.toLowerCase() !== 'FitmaniaAdmin2026'.toLowerCase()) {
        throw new Error('Token de Seguridad Incorrecto');
      }

      // 2. Iniciar sesión en Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idTokenResult = await userCredential.user.getIdTokenResult();

      // 3. Verificar si tiene la claim de admin
      if (idTokenResult.claims.admin !== true) {
        throw new Error('No tienes permisos de administrador');
      }

      setAuthSuccess(true);
      toast.success('Acceso Autorizado');

      // Mostrar la pantala de éxito por 1.5s
      setTimeout(() => {
        onSuccess(token);
      }, 1500)
    } catch (err: any) {
      console.error(err);
      setError('Credenciales Inválidas u otro error de campo');
      toast.error('Acceso Denegado');
    } finally {
      if (!authSuccess) setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d12] p-6 font-sans">
      <div className={cn(
        "bg-white border-8 border-black p-8 md:p-12 rounded-[2.5rem] shadow-[20px_20px_0_0_rgba(220,38,38,1)] max-w-md w-full transition-all duration-500",
        error ? "animate-shake" : "animate-in zoom-in-95"
      )}>

        {authSuccess ? (
          <div className="flex flex-col items-center justify-center p-8 animate-in zoom-in duration-500">
            <div className="relative w-full aspect-[4/3] max-w-[300px] mb-8 rounded-3xl overflow-hidden border-8 border-black shadow-[10px_10px_0_0_rgba(0,128,0,1)] bg-green-500 flex items-center justify-center group">
              {/* Reemplazo de la imagen perdida por iconos HD que no dependen de la red */}
              <ShieldCheck className="w-32 h-32 text-black group-hover:scale-110 transition-transform drop-shadow-[5px_5px_0_rgba(0,0,0,0.5)] z-10" strokeWidth={2.5} />
            </div>
            <h3 className="text-3xl font-black italic text-green-600 uppercase tracking-tighter animate-pulse" style={{ fontFamily: 'var(--font-display)' }}>
              ACCESO CONCEDIDO
            </h3>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-8 animate-in zoom-in duration-500">
            <div className="relative w-full aspect-[4/3] max-w-[300px] mb-8 rounded-3xl overflow-hidden border-8 border-black shadow-[10px_10px_0_0_rgba(220,38,38,1)] bg-red-500 flex items-center justify-center group">
              <ShieldAlert className="w-32 h-32 text-black group-hover:scale-110 transition-transform drop-shadow-[5px_5px_0_rgba(0,0,0,0.5)] z-10" strokeWidth={2.5} />
            </div>
            <h3 className="text-3xl font-black italic text-red-600 uppercase tracking-tighter mb-6" style={{ fontFamily: 'var(--font-display)' }}>
              ACCESO DENEGADO
            </h3>
            <button
              onClick={() => setError(null)}
              className="px-8 py-4 bg-black text-white font-black uppercase text-sm border-b-8 border-zinc-900 rounded-2xl hover:bg-zinc-800 hover:-translate-y-1 active:translate-y-0 active:border-b-0 transition-all shadow-comic-sm"
            >
              REINTENTAR MANIOBRA
            </button>
          </div>
        ) : (
          <>
            {/* Header Header */}
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

              {/* Token */}
              <div className="relative group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-primary mb-2 ml-2 flex items-center gap-2">
                  <Key className="w-3 h-3" /> Token de Seguridad de Campo
                </label>
                <div className="relative">
                  <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-pulse" />
                  <input
                    type="text"
                    required
                    className="w-full pl-12 pr-4 py-4 bg-red-50 border-4 border-black rounded-2xl font-black uppercase tracking-widest focus:bg-white focus:ring-8 focus:ring-red-600/5 outline-none transition-all placeholder:text-red-200"
                    placeholder="TOKEN-ID"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
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
