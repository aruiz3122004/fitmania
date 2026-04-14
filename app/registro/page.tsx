'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { useAuthStore } from '@/lib/store'
import { auth, db } from '@/lib/firebase'
import { avatarOptions, getAvatarUrlById } from '@/lib/avatar-utils'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  User, 
  ArrowRight, 
  Dumbbell, 
  Scale, 
  Ruler,
  AlertTriangle,
  Timer
} from 'lucide-react'
import { FitAvatar } from '@/components/ui/fit-avatar'
import { cn } from '@/lib/utils'
import { getRateLimitStatus, consumeRateLimitAttempt, clearRateLimit, formatTimeLeft } from '@/lib/rate-limit-client'

export default function RegistroPage() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    gender: '',
    peso: '',
    altura: '',
    avatar: 'fitman',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
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

  // Initial status check
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isBlocked) return

    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Las contrasenas no coinciden')
      return
    }

    if (formData.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      // 1. Consumimos un intento exactamente al presionar "REGISTRARSE"
      const status = await consumeRateLimitAttempt()
      setRemainingAttempts(status.remaining)

      if (!status.success) {
        setIsBlocked(true)
        setSecondsLeft(status.secondsLeft)
        setError(status.message || 'Demasiados intentos de registro.')
        setLoading(false)
        return
      }

      const credentials = await createUserWithEmailAndPassword(auth, formData.email, formData.password)
      const avatarUrl = getAvatarUrlById(formData.avatar) || '/Imagenes/Avatares/Fitman.jpeg'
      const userData = {
        uid: credentials.user.uid,
        username: formData.username,
        email: formData.email,
        gender: formData.gender,
        avatar: formData.avatar,
        photoURL: avatarUrl,
        peso: formData.peso ? parseFloat(formData.peso) : undefined,
        altura: formData.altura ? parseFloat(formData.altura) : undefined,
        plan: null,
      }

      await setDoc(doc(db, 'users', credentials.user.uid), {
        ...userData,
        createdAt: new Date(),
      })

      setUser(userData)
      
      // EXITO: Limpiamos por completo el historial de fallos y rate limit
      await clearRateLimit()
      
      router.push('/')
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        setError('Este correo ya esta registrado.')
      } else {
        setError(err.message || 'Error al crear la cuenta. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
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

      <Topbar />

      <section className="mt-[72px] min-h-screen bg-navy-dark flex items-center justify-center py-16 relative overflow-hidden">
        {/* Background Image with Transparency & Blur */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: 'url("/Imagenes/FatuBackground .jpeg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.3,
            filter: 'blur(4px)',
          }}
        />

        <div className="w-full max-w-lg mx-auto px-6 relative z-10">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary border-4 border-accent rounded-full flex items-center justify-center mx-auto mb-3 shadow-comic">
              <Dumbbell className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-3xl text-white tracking-wider [text-shadow:3px_3px_0_var(--red-primary)]">
              FIT<span className="text-accent">MANIA</span>
            </h1>
          </div>

          {/* Form */}
          <div className={cn(
            "bg-white border-4 border-secondary shadow-[8px_8px_0_var(--red-primary)] p-8 transition-all duration-300",
            (isBlocked || error) && "animate-shake"
          )}>
            
            {/* Indicador de Intentos */}
            {!isBlocked && remainingAttempts !== null && (
              <div className="flex justify-center gap-1.5 mb-6">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-4 h-2 rounded-full border border-secondary transition-all",
                      i < remainingAttempts ? "bg-primary" : "bg-red-100"
                    )}
                  />
                ))}
              </div>
            )}

            <h2 className="font-display text-2xl text-secondary text-center tracking-wider mb-6">
              CREAR CUENTA
            </h2>

            {isBlocked ? (
              <div className="bg-primary text-white p-6 mb-6 border-b-4 border-navy-dark rounded flex flex-col items-center">
                <AlertTriangle className="w-12 h-12 mb-2 animate-bounce" />
                <div className="bg-navy-dark px-4 py-1 rounded-full text-xl font-black flex items-center gap-2 mb-3">
                  <Timer className="w-5 h-5" />
                  {formatTimeLeft(secondsLeft)}
                </div>
                <p className="font-label text-xs text-center uppercase tracking-widest font-black leading-tight">
                  Protección de Registro <br />Espera antes de reintentar
                </p>
              </div>
            ) : error ? (
              <div className="bg-red-light border-2 border-primary p-3 mb-6 flex items-center gap-3">
                 <AlertTriangle className="w-5 h-5 text-primary shrink-0" />
                 <p className="font-label text-xs font-black text-primary uppercase leading-tight tracking-wider">{error}</p>
              </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <div className={cn("grid grid-cols-2 gap-4 mb-4 transition-opacity", isBlocked && "opacity-50 pointer-events-none")}>
                {/* Username */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2 px-1">
                    Nombre de Usuario
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="Tu apodo heroico"
                      className="w-full font-body pl-11 pr-4 py-3 border-3 border-gray-200 focus:border-primary outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Gender */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2 px-1">
                    Genero
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full font-body px-4 py-3 border-3 border-gray-200 focus:border-primary outline-none transition-colors bg-white"
                    required
                  >
                    <option value="">Seleccionar</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Email */}
              <div className={cn("mb-4 transition-opacity", isBlocked && "opacity-50 pointer-events-none")}>
                <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2 px-1">
                  Correo Electronico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="tu@correo.com"
                    className="w-full font-body pl-11 pr-4 py-3 border-3 border-gray-200 focus:border-primary outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              <div className={cn("grid grid-cols-2 gap-4 mb-4 transition-opacity", isBlocked && "opacity-50 pointer-events-none")}>
                {/* Password */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2 px-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Min. 6 caracteres"
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

                {/* Confirm Password */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2 px-1">
                    Confirmar
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Repetir contraseña"
                      className="w-full font-body pl-11 pr-4 py-3 border-3 border-gray-200 focus:border-primary outline-none transition-colors"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className={cn("grid grid-cols-2 gap-4 mb-4 transition-opacity", isBlocked && "opacity-50 pointer-events-none")}>
                {/* Weight */}
                <div>
                  <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2 px-1">
                    Peso (kg)
                  </label>
                  <div className="relative">
                    <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      name="peso"
                      value={formData.peso}
                      onChange={handleChange}
                      placeholder="70"
                      className="w-full font-body pl-11 pr-4 py-3 border-3 border-gray-200 focus:border-primary outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Height */}
                <div>
                  <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2 px-1">
                    Altura (cm)
                  </label>
                  <div className="relative">
                    <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      name="altura"
                      value={formData.altura}
                      onChange={handleChange}
                      placeholder="175"
                      className="w-full font-body pl-11 pr-4 py-3 border-3 border-gray-200 focus:border-primary outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className={cn("mb-6 transition-opacity", isBlocked && "opacity-50 pointer-events-none")}>
                <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-3 px-1 text-center sm:text-left">
                  Elige tu Avatar Heroico
                </label>
                <div className="grid grid-cols-3 gap-6 sm:gap-4 justify-items-center max-w-sm mx-auto">
                  {avatarOptions.map((avatar) => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, avatar: avatar.id })}
                      className="relative transition-transform hover:scale-110"
                      title={avatar.name}
                    >
                      <FitAvatar
                        src={avatar.url}
                        alt={avatar.name}
                        size={64}
                        borderColor={formData.avatar === avatar.id ? 'border-primary' : 'border-gray-200'}
                        bgColor={formData.avatar === avatar.id ? 'bg-red-light' : 'bg-gray-50'}
                        circleClassName={formData.avatar === avatar.id ? 'shadow-[0_0_15px_rgba(220,38,38,0.5)] scale-105 transition-all' : 'transition-all'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || isBlocked}
                className="w-full flex items-center justify-center gap-3 font-display text-xl tracking-[2px] text-white bg-primary py-4 border-3 border-secondary shadow-comic transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--navy)] hover:bg-red-dark disabled:opacity-70 disabled:grayscale disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="animate-pulse">CREANDO...</span>
                ) : (
                  <>
                    REGISTRARSE
                    <ArrowRight className="w-6 h-6" />
                  </>
                )}
              </button>
            </form>

            {/* Login link */}
            <div className="mt-6 pt-6 border-t-2 border-gray-200 text-center">
              <p className="font-body text-sm text-gray-500">
                Ya tienes cuenta?{' '}
                <Link href="/login" className="font-label font-bold text-primary hover:underline uppercase tracking-wider">
                  Inicia sesion
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
