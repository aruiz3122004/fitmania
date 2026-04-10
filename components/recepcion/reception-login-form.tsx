'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { auth } from '@/lib/firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { ShieldCheck, Mail, Lock, KeyRound, Loader2, PlaySquare } from 'lucide-react'
import Image from 'next/image'

export function ReceptionLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [securityToken, setSecurityToken] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { setUser } = useAuthStore()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // TOKEN TRIPLE CAPA (Hardcoded estricto para recepción)
    const RECEPTION_TOKEN = process.env.NEXT_PUBLIC_RECEPTION_TOKEN || 'REC-2026-FIT'

    if (securityToken !== RECEPTION_TOKEN) {
      setError('❌ Token de Estación de Recepción Inválido')
      setIsLoading(false)
      return
    }

    // EMAIL WHITELIST (Capa 2.1 - Específicamente el correo solicitado)
    const AUTHORIZED_RECEPCIONIST = 'arturosce56@gmail.com'

    if (email.toLowerCase() !== AUTHORIZED_RECEPCIONIST.toLowerCase()) {
      setError('❌ Este correo no está autorizado para acceder a Recepción.')
      setIsLoading(false)
      return
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)

      setUser({
        uid: userCredential.user.uid,
        email: userCredential.user.email || '',
        username: 'Recepcionista Oficial',
        avatar: 'fitman',
      })

      sessionStorage.setItem('fitmania_reception_session', 'FitmaniaReception2026')
      onSuccess()
    } catch (err: any) {
      setError('Credenciales incorrectas o usuario sin permisos.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-green-50">
      <div className="w-full max-w-md bg-white border-8 border-black p-8 rounded-[2rem] shadow-[20px_20px_0_0_rgba(22,163,74,1)] relative">
        <div className="absolute -top-12 -left-12 opacity-20">
          <ShieldCheck className="w-32 h-32 text-green-600" />
        </div>

        <div className="relative z-10 flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-green-600 border-4 border-black rounded-full flex items-center justify-center text-white shadow-[4px_4px_0_0_rgba(0,0,0,1)] mb-4">
            <PlaySquare className="w-10 h-10" />
          </div>
          <h1 className="font-display text-4xl text-black tracking-[2px] uppercase italic text-center">
            Recepción <br /><span className="text-green-600">Fitmania</span>
          </h1>
          <p className="font-label text-xs tracking-widest uppercase text-gray-500 mt-2">Control de Ingresos</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border-4 border-red-600 rounded-xl relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-600" />
            <p className="font-label text-xs font-black text-red-600 uppercase tracking-widest pl-4">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
          <div>
            <label className="font-label text-xs font-black uppercase text-gray-500 tracking-widest block mb-2">Correo Autorizado</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-xl outline-none focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all font-bold"
                placeholder="recepcion@fitmania.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="font-label text-xs font-black uppercase text-gray-500 tracking-widest block mb-2">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-xl outline-none focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all font-bold tracking-widest"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="font-label text-xs font-black uppercase text-green-600 tracking-widest">Token de Estación</label>
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold uppercase">Capa 3</span>
            </div>

            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
              <input
                type="password"
                value={securityToken}
                onChange={(e) => setSecurityToken(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border-4 border-green-600 shadow-[4px_4px_0_0_rgba(22,163,74,1)] rounded-xl outline-none focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all font-bold tracking-widest bg-green-50"
                placeholder="R E C - * * *"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full relative group mt-8"
          >
            <div className="absolute inset-0 bg-black rounded-xl translate-y-2 translate-x-2 transition-transform group-hover:translate-y-1 group-hover:translate-x-1 group-active:translate-y-0 group-active:translate-x-0" />
            <div className="relative bg-green-600 border-4 border-black p-4 rounded-xl flex items-center justify-center gap-2">
              {isLoading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <span className="font-display italic text-2xl text-white uppercase tracking-widest">INGRESAR AL SISTEMA</span>
              )}
            </div>
          </button>
        </form>

        <button onClick={() => router.push('/')} className="w-full text-center mt-8 font-label text-xs text-gray-400 font-bold uppercase hover:text-black transition-colors">
          ← Volver al sitio público
        </button>
      </div>
    </div>
  )
}
