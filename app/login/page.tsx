'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { useAuthStore } from '@/lib/store'
import { auth, db } from '@/lib/firebase'
import { getAvatarUrlById } from '@/lib/avatar-utils'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Dumbbell } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
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
      router.push('/')
    } catch (err: any) {
      if (err?.code === 'auth/invalid-credential') {
        setError('Credenciales invalidas.')
      } else {
        setError('Error al iniciar sesion. Intenta de nuevo.')
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
          <div className="bg-white border-4 border-secondary shadow-[8px_8px_0_var(--red-primary)] p-8">
            <h2 className="font-display text-2xl text-secondary text-center tracking-wider mb-6">
              INICIAR SESION
            </h2>

            {error && (
              <div className="bg-red-light border-2 border-primary p-3 mb-6">
                <p className="font-label text-sm text-primary text-center">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-100 border-2 border-green-500 p-3 mb-6">
                <p className="font-label text-sm text-green-700 text-center">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className="mb-4">
                <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2">
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
              <div className="mb-2">
                <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2">
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
                  className="font-label text-xs font-bold text-gray-400 hover:text-primary hover:underline uppercase tracking-wide"
                >
                  Olvidé mi contraseña
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 font-display text-xl tracking-[2px] text-white bg-primary py-4 border-3 border-secondary shadow-comic transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--navy)] hover:bg-red-dark disabled:opacity-70 disabled:cursor-not-allowed"
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
                <Link href="/registro" className="font-label font-bold text-primary hover:underline">
                  Registrate aqui
                </Link>
              </p>
            </div>
          </div>

          {/* Demo info */}
          <div className="mt-6 text-center">
            <p className="font-label text-xs text-white/40">
              Demo: Usa cualquier correo y contrasena
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
