'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { auth } from '@/lib/firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  Loader2, 
  PlaySquare, 
  AlertTriangle, 
  Timer, 
  ArrowLeft 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getRateLimitStatus, clearRateLimit, formatTimeLeft } from '@/lib/rate-limit-client'

export function ReceptionLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // Rate Limit States
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [isBlocked, setIsBlocked] = useState(false)

  const { setUser } = useAuthStore()
  const router = useRouter()

  // Countdown effect
  useEffect(() => {
    if (secondsLeft <= 0) {
      if (isBlocked) setIsBlocked(false)
      return
    }
    const timer = setInterval(() => setSecondsLeft(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [secondsLeft, isBlocked])

  // Initial status check and URL key cleanup
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
    const checkStatus = async () => {
      const status = await getRateLimitStatus()
      setRemainingAttempts(status.remaining)
      if (!status.success) {
        setIsBlocked(true)
        setSecondsLeft(status.secondsLeft)
        setError(status.message || 'Límite de intentos excedido')
      }
    }
    checkStatus()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isBlocked) return
    
    setError('')
    setIsLoading(true)

    try {
      // 1. Autenticar con Firebase (client-side)
      const userCredential = await signInWithEmailAndPassword(auth, email, password)

      // 2. Obtener el ID Token y enviarlo al servidor
      const idToken = await userCredential.user.getIdToken()
      const response = await fetch('/api/recepcion/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      // Update remaining from headers
      const remaining = response.headers.get('X-RateLimit-Remaining')
      if (remaining) setRemainingAttempts(parseInt(remaining))

      if (!response.ok) {
        const data = await response.json()
        
        if (response.status === 429) {
          setIsBlocked(true)
          const reset = parseInt(response.headers.get('X-RateLimit-Reset') || '0')
          const wait = Math.max(0, Math.ceil((reset - Date.now()) / 1000))
          setSecondsLeft(wait)
          throw new Error(data.error || 'Seguridad: Límite de intentos excedido.')
        }

        const error = new Error(data.error || 'Acceso no autorizado para recepción') as any
        error.details = data.details
        error.code = data.code
        throw error
      }

      // 3. Sesión creada satisfactoriamente
      setUser({
        uid: userCredential.user.uid,
        email: userCredential.user.email || '',
        username: 'Recepcionista Oficial',
        avatar: 'fitman',
      })

      // EXITO: Limpiar historial de bloqueos
      await clearRateLimit()

      // Limpiar la URL (quitar la ?key= de la barra de direcciones)
      if (typeof window !== 'undefined') {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Credenciales incorrectas o usuario sin permisos.')
      if (err.details) {
        console.error('Detalles del error:', err.details, err.code)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-green-50">
      <div className={cn(
        "w-full max-w-md bg-white border-8 border-black p-8 rounded-[2rem] shadow-[20px_20px_0_0_rgba(22,163,74,1)] relative transition-all duration-500",
        (error || isBlocked) ? "animate-shake" : "animate-in zoom-in-95"
      )}>
        
        {/* Attempts Indicator */}
        {!isBlocked && remainingAttempts !== null && (
          <div className="absolute top-6 right-8 flex items-center gap-2">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={cn(
                  "w-2 h-2 rounded-full border border-black transition-colors",
                  i < remainingAttempts ? "bg-green-600" : "bg-red-200"
                )} />
              ))}
            </div>
          </div>
        )}

        <div className="absolute -top-12 -left-12 opacity-10">
          <ShieldCheck className="w-32 h-32 text-green-600" />
        </div>

        <div className="relative z-10 flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-green-600 border-4 border-black rounded-full flex items-center justify-center text-white shadow-[4px_4px_0_0_rgba(0,0,0,1)] mb-4">
            <PlaySquare className="w-10 h-10" />
          </div>
          <h1 className="font-display text-4xl text-black tracking-[2px] uppercase italic text-center">
            Recepción <br /><span className="text-green-600">Fitmania</span>
          </h1>
          <p className="font-label text-[10px] tracking-[4px] uppercase text-gray-500 mt-2">Control de Ingresos</p>
        </div>

        {isBlocked ? (
          <div className="mb-8 p-6 bg-red-600 border-4 border-black rounded-2xl flex flex-col items-center animate-in slide-in-from-top duration-300">
            <AlertTriangle className="w-16 h-16 text-white mb-3 animate-bounce" />
            <div className="bg-black text-white px-6 py-2 rounded-full font-black text-2xl flex items-center gap-2 mb-4">
              <Timer className="w-6 h-6" />
              {formatTimeLeft(secondsLeft)}
            </div>
            <p className="font-label text-[10px] text-white/80 text-center uppercase tracking-widest leading-relaxed">
              Sistema temporalmente bloqueado <br />por excesivos intentos fallidos.
            </p>
          </div>
        ) : error && (
          <div className="mb-6 p-4 bg-red-100 border-4 border-red-600 rounded-xl relative overflow-hidden animate-in slide-in-from-top duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-600" />
            <p className="font-label text-[10px] font-black text-red-600 uppercase tracking-widest pl-4 leading-tight">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
          <div className={cn(isBlocked && "opacity-50 pointer-events-none")}>
            <label className="font-label text-xs font-black uppercase text-gray-400 tracking-widest block mb-2 ml-2">Correo Autorizado</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-xl outline-none focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all font-bold focus:border-green-600"
                placeholder="recepcion@fitmania.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className={cn(isBlocked && "opacity-50 pointer-events-none")}>
            <label className="font-label text-xs font-black uppercase text-gray-400 tracking-widest block mb-2 ml-2">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-xl outline-none focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all font-bold tracking-widest focus:border-green-600"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isBlocked}
            className="w-full relative group mt-8"
          >
            <div className={cn(
              "absolute inset-0 bg-black rounded-xl translate-y-2 translate-x-2 transition-transform",
              !isLoading && !isBlocked && "group-hover:translate-y-1 group-hover:translate-x-1 group-active:translate-y-0 group-active:translate-x-0"
            )} />
            <div className={cn(
              "relative border-4 border-black p-4 rounded-xl flex items-center justify-center gap-2 transition-colors font-display italic text-2xl uppercase tracking-widest text-white",
              isBlocked ? "bg-gray-400" : "bg-green-600 active:bg-green-700"
            )}>
              {isLoading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <span>INGRESAR AL SISTEMA</span>
              )}
            </div>
          </button>
        </form>

        <button 
          onClick={() => router.push('/')} 
          className="w-full flex items-center justify-center gap-2 mt-8 font-label text-[10px] text-gray-400 font-black uppercase hover:text-black transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Volver al sitio público
        </button>
      </div>

      <style jsx global>{`
        @keyframes comicShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: comicShake 0.1s ease-in-out 4;
        }
      `}</style>
    </div>
  )
}
