'use client'

import { useState, useRef } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { SectionHeader } from '@/components/ui/section-header'
import { useAuthStore } from '@/lib/store'
import { db, storage } from '@/lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Save, UserCircle, Camera, Loader2 } from 'lucide-react'

export default function PerfilPage() {
  const { user, updateUser } = useAuthStore()
  const [username, setUsername] = useState(user?.username || '')
  const [peso, setPeso] = useState(user?.peso?.toString() || '')
  const [altura, setAltura] = useState(user?.altura?.toString() || '')
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.uid) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setStatus('Por favor selecciona un archivo de imagen válido.')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatus('La imagen no puede superar los 5MB.')
      return
    }

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file)
    setAvatarPreview(localPreview)

    setIsUploadingAvatar(true)
    setStatus('')

    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, `avatars/${user.uid}`)
      await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(storageRef)

      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), { photoURL: downloadURL })

      // Update local state
      updateUser({ photoURL: downloadURL })
      setStatus('Avatar actualizado correctamente.')
    } catch {
      setStatus('No se pudo subir la imagen. Intenta de nuevo.')
      setAvatarPreview(null)
    } finally {
      setIsUploadingAvatar(false)
      // Reset input so the same file can be selected again if needed
      e.target.value = ''
    }
  }

  const handleSave = async () => {
    if (!user?.uid) {
      setStatus('Debes iniciar sesion para editar tu perfil.')
      return
    }

    setIsSaving(true)
    setStatus('')
    try {
      const payload = {
        username: username.trim(),
        peso: peso ? Number(peso) : null,
        altura: altura ? Number(altura) : null,
      }
      await updateDoc(doc(db, 'users', user.uid), payload)
      updateUser({
        username: payload.username,
        peso: payload.peso || undefined,
        altura: payload.altura || undefined,
      })
      setStatus('Configuracion guardada.')
    } catch {
      setStatus('No se pudo guardar la configuracion.')
    } finally {
      setIsSaving(false)
    }
  }

  const currentAvatar = avatarPreview || user?.photoURL

  return (
    <main>
      <Topbar />
      <section className="mt-[72px] min-h-screen bg-muted py-16">
        <div className="max-w-[900px] mx-auto px-8">
          <SectionHeader label="TU PERFIL" title="CONFIGURACION" titleAccent="BASICA" />

          <div className="bg-white border-3 border-secondary shadow-comic p-8">
            <div className="flex items-center gap-4 mb-8">

              {/* Avatar with upload button */}
              <div className="relative group shrink-0">
                <div className="w-16 h-16 rounded-full border-3 border-secondary overflow-hidden bg-gray-100 flex items-center justify-center">
                  {currentAvatar ? (
                    <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="w-10 h-10 text-gray-400" />
                  )}
                </div>

                {/* Overlay button */}
                <button
                  onClick={handleAvatarClick}
                  disabled={isUploadingAvatar}
                  title="Cambiar foto de perfil"
                  className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:cursor-not-allowed"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                </button>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div>
                <h3 className="font-heading font-extrabold text-xl text-secondary">{user?.username || 'Usuario'}</h3>
                <p className="font-label text-sm text-gray-500">{user?.email || 'Sin sesion'}</p>
                <button
                  onClick={handleAvatarClick}
                  disabled={isUploadingAvatar}
                  className="mt-1 font-label text-xs text-primary underline hover:text-red-dark transition-colors disabled:opacity-50"
                >
                  {isUploadingAvatar ? 'Subiendo...' : 'Cambiar foto de perfil'}
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="font-label text-xs text-gray-500 uppercase">Nombre de usuario</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full mt-2 border-2 border-gray-200 px-3 py-2 outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="font-label text-xs text-gray-500 uppercase">Peso (kg)</label>
                <input
                  type="number"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  className="w-full mt-2 border-2 border-gray-200 px-3 py-2 outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="font-label text-xs text-gray-500 uppercase">Altura (cm)</label>
                <input
                  type="number"
                  value={altura}
                  onChange={(e) => setAltura(e.target.value)}
                  className="w-full mt-2 border-2 border-gray-200 px-3 py-2 outline-none focus:border-primary"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 font-label font-bold text-sm text-white bg-primary px-6 py-3 border-2 border-secondary shadow-comic-sm hover:bg-red-dark transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>

            {status && <p className="mt-4 font-label text-sm text-gray-600">{status}</p>}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
