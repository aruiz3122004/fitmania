'use client'

import Link from 'next/link'
import { ChangeEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, useUIStore } from '@/lib/store'
import { LogOut, Settings, UserCircle } from 'lucide-react'
import { avatarOptions, getAvatarUrlById } from '@/lib/avatar-utils'
import { FitAvatar } from '@/components/ui/fit-avatar'
import { auth, db, storage } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'
import { uploadToCloudinary } from '@/services/cloudinary'

export function UserDropdown() {
  const router = useRouter()
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
      const querySnapshot = await getDocs(postsRef)

      if (!querySnapshot.empty) {
        const batch = writeBatch(db)
        querySnapshot.forEach((docSnap) => {
          const postData = docSnap.data()
          let needsUpdate = false
          const postUpdate: any = {}

          // Actualizar avatar del autor del post
          if (postData.autor_id === user.uid) {
            postUpdate.autor_avatar = updates.photoURL
            needsUpdate = true
          }

          // Actualizar avatares en los comentarios
          if (Array.isArray(postData.comentarios)) {
            const updatedComentarios = postData.comentarios.map((comment: any) => {
              if (comment.autor_username === user.username) {
                return { ...comment, autor_avatar: updates.photoURL }
              }
              return comment
            })

            // Verificar si algún comentario cambió
            const changed = JSON.stringify(updatedComentarios) !== JSON.stringify(postData.comentarios)
            if (changed) {
              postUpdate.comentarios = updatedComentarios
              needsUpdate = true
            }
          }

          if (needsUpdate) {
            batch.update(docSnap.ref, postUpdate)
          }
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
    } catch (err) {
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
      <div className="absolute top-full -right-4 sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-72 max-w-xs bg-white border-3 border-secondary shadow-comic z-50">
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
  const isPremium = !!(user?.plan && daysRemaining !== null && daysRemaining > 0)

  return (
    <div className="fixed inset-x-4 sm:absolute sm:inset-auto sm:right-0 top-[76px] sm:top-full mt-2 w-auto sm:w-[320px] max-w-[400px] z-50">
      {/* Animated gradient wrapper for premium users */}
      {isPremium && (
        <div
          className="absolute inset-0 rounded-sm"
          style={{
            background: 'linear-gradient(45deg, #ef4444, #ffffff, #3b82f6, #ef4444, #ffffff, #3b82f6)',
            backgroundSize: '400% 400%',
            animation: 'premium-gradient-spin 4s linear infinite',
            boxShadow: '0 0 20px rgba(59,130,246,0.4), 0 0 40px rgba(220,38,38,0.2)',
          }}
        />
      )}

      <div
        className={`relative shadow-comic ${isPremium ? 'm-[4px]' : 'bg-white border-3 border-secondary'}`}
        style={isPremium ? {
          background: 'linear-gradient(135deg, #abd4f0ff 0%, #ffffff 50%, #e97373ff 100%)',
        } : {}}
      >
        <div className="p-5 border-b-2 border-gray-200">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <FitAvatar
              src={user?.photoURL}
              alt="Avatar"
              size={72}
              borderWidth="border-3"
              borderColor="border-secondary"
              bgColor="bg-primary"
              isPremium={isPremium}
              fallback={<UserCircle className="w-12 h-12 text-gray-400" />}
            />
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="font-label font-black text-xl sm:text-base text-secondary truncate uppercase">
                {user?.username || 'Usuario'}
              </h3>
              <p className="font-label text-xs sm:text-sm text-gray-400 truncate mb-2">
                {user?.email}
              </p>
              {isPremium && daysRemaining !== null && (
                <div className="bg-blue-100 border-2 border-blue-400 px-3 py-1.5 inline-flex items-center gap-2 rounded-lg shadow-[3px_3px_0_0_rgba(59,130,246,0.3)]">
                  <span className="text-sm">⭐</span>
                  <span className="font-label text-[10px] font-black text-blue-700 uppercase tracking-widest">
                    <span className="sm:inline hidden">PREMIUM · </span>{daysRemaining} DIAS
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Avatar Selection */}
        <div className="p-5 border-b-2 border-gray-200">
          <div className="flex flex-col gap-5">
            <h4 className="font-label text-xs font-bold text-gray-500 uppercase tracking-widest">
              Cambiar Avatar
            </h4>

            <div className="grid grid-cols-3 gap-4 justify-items-center">
              {avatarOptions.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => handleAvatarSelect(avatar.id)}
                  disabled={isSavingAvatar}
                  className="relative transition-transform hover:scale-115 active:scale-95"
                  title={avatar.name}
                >
                  <FitAvatar
                    src={avatar.url}
                    alt={avatar.name}
                    size={60}
                    borderColor={user?.avatar === avatar.id ? 'border-primary' : 'border-gray-300'}
                    bgColor="bg-primary"
                    circleClassName={user?.avatar === avatar.id ? 'ring-2 ring-primary/30 shadow-comic-sm' : ''}
                  />
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center">
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
                className="font-label text-xs font-bold text-primary hover:underline transition-all disabled:opacity-50 uppercase tracking-wide"
              >
                {isSavingAvatar ? 'Subiendo...' : 'Subir foto personalizada'}
              </button>
            </div>
          </div>
        </div>

        {/* Menu Options */}
        <div className="p-3 bg-zinc-50 border-t-2 border-gray-200 flex sm:flex-col gap-2">
          <Link
            href="/perfil"
            onClick={handleClose}
            className="flex-1 flex items-center justify-center sm:justify-start gap-3 px-3 py-3 sm:py-2 bg-white sm:bg-transparent border-2 sm:border-0 border-black sm:rounded rounded-xl hover:bg-gray-100 transition-all active:translate-y-1"
          >
            <Settings className="w-5 h-5 text-zinc-600" />
            <span className="hidden sm:inline font-label text-sm text-gray-700">Configuracion</span>
          </Link>
          <button
            onClick={async () => {
              await signOut(auth)
              logout()
              handleClose()
              router.push('/login')
            }}
            className="flex-1 flex items-center justify-center sm:justify-start gap-3 px-3 py-3 sm:py-2 bg-red-50 sm:bg-transparent border-2 sm:border-0 border-primary sm:rounded rounded-xl hover:bg-red-light transition-all active:translate-y-1"
          >
            <LogOut className="w-5 h-5 text-primary" />
            <span className="hidden sm:inline font-label text-sm text-primary">Cerrar Sesion</span>
          </button>
        </div>
      </div>
    </div>
  )
}
