'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { useAuthStore } from '@/lib/store'
import { auth, db } from '@/lib/firebase'
import { getAvatarUrlById } from '@/lib/avatar-utils'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Dumbbell, 
  AlertTriangle, 
  Timer 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getRateLimitStatus, consumeRateLimitAttempt, clearRateLimit, formatTimeLeft } from '@/lib/rate-limit-client'

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  // Rate Limit States
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [isBlocked, setIsBlocked] = useState(false)

  // Countdown effect
  useEffect(() => {
    if (secondsLeft <= 0) {
      if (isBlocked) setIsBlocked(false)
      return
    }
    const timer = setInterval(() => setSecondsLeft(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [secondsLeft, isBlocked])

  // Status check on mount
  useEffect(() => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isBlocked) return

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      // 1. Consumimos un intento exactamente al presionar "ENTRAR"
      const status = await consumeRateLimitAttempt()
      setRemainingAttempts(status.remaining)
      
      if (!status.success) {
        setIsBlocked(true)
        setSecondsLeft(status.secondsLeft)
        setError(status.message || 'Has excedido el límite de intentos.')
        setLoading(false)
        return
      }

      const credentials = await signInWithEmailAndPassword(auth, email, password)
      const userDoc = await getDoc(doc(db, 'users', credentials.user.uid))
      const userData = userDoc.data()

      setUser({
        uid: credentials.user.uid,
        username: userData?.username || email.split('@')[0],
        email: credentials.user.email || email,
        gender: userData?.gender,
        avatar: userData?.avatar || 'fitman',
        photoURL: userData?.photoURL || getAvatarUrlById(userData?.avatar || 'fitman'),
        peso: userData?.peso,
        altura: userData?.altura,
        plan: userData?.plan || null,
      })

      // EXITO: Limpiamos por completo el historial de fallos y rate limit
      await clearRateLimit()

      router.push('/')
    } catch (err: any) {
      if (err?.code === 'auth/invalid-credential') {
        setError('Credenciales invalidas.')
      } else {
        setError(err.message || 'Error al iniciar sesion. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Por favor ingresa tu correo primero.')
      return
    }
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setSuccess('Se ha enviado un enlace para restablecer tu contraseña a tu correo. Revisa tu bandeja de entrada.')
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No existe un usuario con este correo.')
      } else {
        setError('Error al enviar el correo. Verifica tu conexion.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <Topbar />

      <section className="mt-[72px] min-h-screen flex items-center justify-center py-16 relative overflow-hidden bg-navy-dark">
        {/* Background Image with Transparency & Blur */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: 'url("/Imagenes/Fitmania Animado.jpeg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.3,
            filter: 'blur(8px)',
          }}
        />

        <div className="w-full max-w-md mx-auto px-6 relative z-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-primary border-4 border-accent rounded-full flex items-center justify-center mx-auto mb-4 shadow-comic">
              <Dumbbell className="w-10 h-10 text-white" />
            </div>
            <h1 className="font-display text-4xl text-white tracking-wider [text-shadow:3px_3px_0_var(--red-primary)]">
              FIT<span className="text-accent">MANIA</span>
            </h1>
            <p className="font-label text-sm text-white/60 tracking-wider mt-2">
              Tu Pasion. Tu Fuerza.
            </p>
          </div>

          {/* Form */}
          <div className={cn(
            "bg-white border-4 border-secondary shadow-[8px_8px_0_var(--red-primary)] p-8 transition-all duration-300",
            (isBlocked || error) && "animate-shake"
          )}>
            
            {/* Intentos restantes */}
            {!isBlocked && remainingAttempts !== null && (
              <div className="flex justify-center gap-1.5 mb-6">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-3 h-1.5 rounded-full border border-secondary transition-all",
                      i < remainingAttempts ? "bg-primary" : "bg-red-100"
                    )}
                  />
                ))}
              </div>
            )}

            <h2 className="font-display text-2xl text-secondary text-center tracking-wider mb-6">
              INICIAR SESION
            </h2>

            {isBlocked ? (
              <div className="bg-primary text-white p-6 mb-6 border-b-4 border-navy-dark rounded flex flex-col items-center">
                <AlertTriangle className="w-12 h-12 mb-2 animate-bounce" />
                <div className="bg-navy-dark px-4 py-1 rounded-full text-xl font-black flex items-center gap-2 mb-3">
                  <Timer className="w-5 h-5" />
                  {formatTimeLeft(secondsLeft)}
                </div>
                <p className="font-label text-[10px] text-center uppercase tracking-widest font-black">
                  Seguridad Activada <br />Demasiados intentos
                </p>
              </div>
            ) : error ? (
              <div className="bg-red-light border-2 border-primary p-3 mb-6 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-primary shrink-0" />
                <p className="font-label text-[10px] font-black text-primary uppercase leading-tight tracking-wider">{error}</p>
              </div>
            ) : null}

            {success && (
              <div className="bg-green-100 border-2 border-green-500 p-3 mb-6">
                <p className="font-label text-sm text-green-700 text-center font-bold italic">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className={cn("mb-4", isBlocked && "opacity-50 pointer-events-none")}>
                <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2 px-1">
                  Correo Electronico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="fitmaniatics@gmail.com"
                    className="w-full font-body pl-11 pr-4 py-3 border-3 border-gray-200 focus:border-primary outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className={cn("mb-2", isBlocked && "opacity-50 pointer-events-none")}>
                <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2 px-1">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    className="w-full font-body pl-11 pr-12 py-3 border-3 border-gray-200 focus:border-primary outline-none transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-secondary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password */}
              <div className="mb-6 text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-label text-[10px] font-black text-gray-400 hover:text-primary hover:underline uppercase tracking-widest"
                >
                  Olvidé mi contraseña
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || isBlocked}
                className="w-full flex items-center justify-center gap-3 font-display text-xl tracking-[2px] text-white bg-primary py-4 border-3 border-secondary shadow-comic transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--navy)] hover:bg-red-dark disabled:opacity-70 disabled:grayscale disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="animate-pulse">ENTRANDO...</span>
                ) : (
                  <>
                    ENTRAR
                    <ArrowRight className="w-6 h-6" />
                  </>
                )}
              </button>
            </form>

            {/* Register link */}
            <div className="mt-6 pt-6 border-t-2 border-gray-200 text-center">
              <p className="font-body text-sm text-gray-500">
                No tienes cuenta?{' '}
                <Link href="/registro" className="font-label font-bold text-primary hover:underline uppercase tracking-wider">
                  Registrate aqui
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      
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
    </main>
  )
}
