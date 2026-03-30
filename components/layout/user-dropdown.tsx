'use client'

import Link from 'next/link'
import { ChangeEvent, useRef, useState } from 'react'
import { useAuthStore, useUIStore } from '@/lib/store'
import { LogOut, Settings, UserCircle } from 'lucide-react'
import { avatarOptions, getAvatarUrlById } from '@/lib/avatar-utils'
import { FitAvatar } from '@/components/ui/fit-avatar'
import { auth, db, storage } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'
import { uploadToCloudinary } from '@/services/cloudinary'

export function UserDropdown() {
  const { user, isAuthenticated, logout, updateUser } = useAuthStore()
  const { setUserDropdownOpen } = useUIStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)

  const handleClose = () => setUserDropdownOpen(false)

  const updateUserProfile = async (updates: { avatar?: string; photoURL?: string }) => {
    if (!user?.uid) return
    await updateDoc(doc(db, 'users', user.uid), updates)
    
    if (updates.photoURL) {
      const postsRef = collection(db, 'posts')
      const q = query(postsRef, where('autor_id', '==', user.uid))
      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        const batch = writeBatch(db)
        querySnapshot.forEach((docSnap) => {
          batch.update(docSnap.ref, { autor_avatar: updates.photoURL })
        })
        await batch.commit()
      }
    }
    
    updateUser(updates)
  }

  const handleAvatarSelect = async (avatarId: string) => {
    if (!user?.uid || isSavingAvatar) return
    const avatarUrl = getAvatarUrlById(avatarId)
    if (!avatarUrl) return
    setIsSavingAvatar(true)
    try {
      await updateUserProfile({ avatar: avatarId, photoURL: avatarUrl })
    } finally {
      setIsSavingAvatar(false)
    }
  }

  const handleCustomPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user?.uid || isSavingAvatar) return
    setIsSavingAvatar(true)
    try {
      const resultado = await uploadToCloudinary(file)
      await updateUserProfile({ photoURL: resultado.url })
    } catch(err) {
      console.error("Error al subir imagen:", err)
    } finally {
      setIsSavingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const getDaysRemaining = () => {
    if (!user?.plan?.expira) return null
    const now = new Date()
    const expira = new Date(user.plan.expira)
    const diff = Math.ceil((expira.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }

  if (!isAuthenticated) {
    return (
      <div className="absolute top-full right-0 mt-2 w-72 bg-white border-3 border-secondary shadow-comic z-50">
        <div className="p-4">
          <h3 className="font-display text-xl text-secondary tracking-wider mb-3">
            BIENVENIDO
          </h3>
          <p className="font-body text-sm text-gray-500 mb-4">
            Inicia sesion para acceder a todas las funciones
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              onClick={handleClose}
              className="font-label font-bold text-sm text-white bg-primary text-center py-2 px-4 border-2 border-secondary shadow-comic-sm transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_var(--navy)]"
            >
              INICIAR SESION
            </Link>
            <Link
              href="/registro"
              onClick={handleClose}
              className="font-label font-bold text-sm text-secondary bg-white text-center py-2 px-4 border-2 border-secondary shadow-comic-sm transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_var(--navy)]"
            >
              REGISTRARSE
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const daysRemaining = getDaysRemaining()

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white border-3 border-secondary shadow-comic z-50">
      <div className="p-4 border-b-2 border-gray-200">
        <div className="flex items-start gap-3">
          <FitAvatar
            src={user?.photoURL}
            alt="Avatar"
            size={56}
            borderWidth="border-3"
            borderColor="border-secondary"
            bgColor="bg-primary"
            fallback={<UserCircle className="w-10 h-10 text-gray-400" />}
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-label font-bold text-sm text-secondary truncate">
              {user?.username || 'Usuario'}
            </h3>
            <p className="font-label text-xs text-gray-400 truncate">
              {user?.email}
            </p>
            {user?.plan && daysRemaining !== null && daysRemaining > 0 && (
              <div className="mt-2 bg-accent/20 border-2 border-accent px-2 py-1 inline-block">
                <span className="font-label text-xs font-bold text-secondary">
                  {daysRemaining} dias restantes
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Avatar Selection */}
      <div className="p-4 border-b-2 border-gray-200">
        <h4 className="font-label text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          Cambiar Avatar
        </h4>
        <div className="grid grid-cols-6 gap-2">
          {avatarOptions.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => handleAvatarSelect(avatar.id)}
              disabled={isSavingAvatar}
              className="relative transition-transform hover:scale-110"
              title={avatar.name}
            >
              <FitAvatar
                src={avatar.url}
                alt={avatar.name}
                size={40}
                borderColor={user?.avatar === avatar.id ? 'border-primary' : 'border-gray-300'}
                bgColor="bg-primary"
                circleClassName={user?.avatar === avatar.id ? 'ring-2 ring-primary/30' : ''}
              />
            </button>
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleCustomPhoto}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isSavingAvatar}
          className="mt-2 w-full font-label text-xs text-primary hover:underline disabled:opacity-50"
        >
          {isSavingAvatar ? 'Subiendo...' : 'Subir foto personalizada'}
        </button>
      </div>

      {/* Menu Options */}
      <div className="p-2">
        <Link
          href="/perfil"
          onClick={handleClose}
          className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors"
        >
          <Settings className="w-4 h-4 text-gray-500" />
          <span className="font-label text-sm text-gray-700">Configuracion</span>
        </Link>
        <button
          onClick={async () => {
            await signOut(auth)
            logout()
            handleClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-red-light transition-colors text-left"
        >
          <LogOut className="w-4 h-4 text-primary" />
          <span className="font-label text-sm text-primary">Cerrar Sesion</span>
        </button>
      </div>
    </div>
  )
}
