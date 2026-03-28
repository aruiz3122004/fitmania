'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { useAuthStore } from '@/lib/store'
import { auth, db } from '@/lib/firebase'
import { avatarOptions, getAvatarUrlById } from '@/lib/avatar-utils'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Dumbbell, Scale, Ruler } from 'lucide-react'

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      router.push('/')
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        setError('Este correo ya esta registrado.')
      } else {
        setError('Error al crear la cuenta. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <Topbar />
      
      <section className="mt-[72px] min-h-screen bg-navy-dark flex items-center justify-center py-16 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '10px 10px'
        }} />

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
          <div className="bg-white border-4 border-secondary shadow-[8px_8px_0_var(--red-primary)] p-8">
            <h2 className="font-display text-2xl text-secondary text-center tracking-wider mb-6">
              CREAR CUENTA
            </h2>

            {error && (
              <div className="bg-red-light border-2 border-primary p-3 mb-6">
                <p className="font-label text-sm text-primary text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Username */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2">
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
                  <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2">
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
              <div className="mb-4">
                <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2">
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

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Password */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2">
                    Contrasena
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
                  <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2">
                    Confirmar
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Repetir contrasena"
                      className="w-full font-body pl-11 pr-4 py-3 border-3 border-gray-200 focus:border-primary outline-none transition-colors"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Weight */}
                <div>
                  <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2">
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
                  <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-2">
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

              {/* Avatar Selection */}
              <div className="mb-6">
                <label className="font-label font-bold text-xs text-secondary uppercase tracking-wider block mb-3">
                  Elige tu Avatar
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {avatarOptions.map((avatar) => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, avatar: avatar.id })}
                      className={`aspect-square rounded-full border-3 flex items-center justify-center transition-all hover:scale-110 ${
                        formData.avatar === avatar.id 
                          ? 'border-primary bg-red-light' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                      title={avatar.name}
                    >
                      <span className="font-display text-lg text-secondary">
                        {avatar.name.charAt(0)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 font-display text-xl tracking-[2px] text-white bg-primary py-4 border-3 border-secondary shadow-comic transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--navy)] hover:bg-red-dark disabled:opacity-70 disabled:cursor-not-allowed"
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
                <Link href="/login" className="font-label font-bold text-primary hover:underline">
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
