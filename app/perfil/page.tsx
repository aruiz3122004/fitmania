'use client'

import { useState, useRef } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { SectionHeader } from '@/components/ui/section-header'
import { useAuthStore } from '@/lib/store'
import { db } from '@/lib/firebase'
import { uploadToCloudinary } from '@/services/cloudinary'
import { doc, updateDoc } from 'firebase/firestore'
import { Save, UserCircle, Camera, Loader2, ShieldCheck, Clock, Calendar } from 'lucide-react'
import { FitAvatar } from '@/components/ui/fit-avatar'

const formatDate = (dateValue: any) => {
  if (!dateValue) return 'N/A';
  let d: Date;
  if (dateValue.seconds) d = new Date(dateValue.seconds * 1000);
  else d = new Date(dateValue);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
};

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
      // Upload to Cloudinary
      const resultado = await uploadToCloudinary(file)
      const downloadURL = resultado.url

      // Update cloudinary storage
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
                <FitAvatar
                  src={currentAvatar}
                  alt="Avatar"
                  size={64}
                  borderWidth="border-3"
                  borderColor="border-secondary"
                  bgColor="bg-gray-100"
                  fallback={<UserCircle className="w-10 h-10 text-gray-400" />}
                />

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

              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-extrabold text-xl text-secondary truncate">{user?.username || 'Usuario'}</h3>
                <p className="font-label text-sm text-gray-500 truncate">{user?.email || 'Sin sesion'}</p>
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

          {/* Sección de Membresía */}
          {user?.plan && (
            <div className="mt-8 bg-zinc-900 border-3 border-black shadow-[8px_8px_0_0_rgba(220,38,38,1)] p-8 text-white animate-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center gap-3 mb-6">
                  <ShieldCheck className="text-primary w-8 h-8" />
                  <h3 className="font-display text-2xl tracking-[2px]">MI MEMBRESÍA</h3>
               </div>
               
               <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <div>
                        <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[3px]">Plan Activo</p>
                        <p className="text-2xl font-black italic text-primary uppercase">{user.plan.nombre}</p>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                        <p className="text-xs font-bold uppercase tracking-widest text-green-500">Estado: Activo</p>
                     </div>
                  </div>

                  <div className="bg-zinc-800 p-6 rounded-2xl border-2 border-zinc-700 flex flex-col gap-4">
                     <div className="flex items-center gap-4">
                        <Calendar className="w-5 h-5 text-zinc-500" />
                        <div>
                           <p className="text-[10px] font-black uppercase text-zinc-500">Inicio del ciclo</p>
                           <p className="text-sm font-bold">{formatDate(user.plan.inicio)}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <Clock className="w-5 h-5 text-primary" />
                        <div>
                           <p className="text-[10px] font-black uppercase text-zinc-500">Próximo vencimiento</p>
                           <p className="text-sm font-bold">{formatDate(user.plan.expira)}</p>
                        </div>
                     </div>
                  </div>
               </div>
               
               <p className="mt-8 text-[10px] font-bold text-zinc-500 uppercase italic text-center">
                  * Si necesitas modificar tus fechas o congelar tu plan, contacta al administrador.
               </p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}
