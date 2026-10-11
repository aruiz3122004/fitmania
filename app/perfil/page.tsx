'use client'

import { useState, useRef } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { SectionHeader } from '@/components/ui/section-header'
import { useAuthStore } from '@/lib/store'
import { db } from '@/lib/firebase'
import { uploadToCloudinary } from '@/services/cloudinary'
import { doc, updateDoc } from 'firebase/firestore'
import { Save, UserCircle, Camera, Loader2, ShieldCheck, Clock, Calendar, QrCode, Users } from 'lucide-react'
import { FitAvatar } from '@/components/ui/fit-avatar'
import QRCode from 'react-qr-code'

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

  // Companion State
  const [compNombre, setCompNombre] = useState(user?.plan?.acompanante?.nombre || '')
  const [compEmail, setCompEmail] = useState(user?.plan?.acompanante?.email || '')
  const [compDias, setCompDias] = useState<string[]>(user?.plan?.acompanante?.rutinaDias || [])
  const [isSavingCompanion, setIsSavingCompanion] = useState(false)
  
  const showCompanionForm = user?.plan && (user.plan.nombre.toLowerCase().includes('pareja') || user.plan.nombre.toLowerCase().includes('dos') || user.plan.nombre.toLowerCase().includes('2'));
  const daysOfWeek = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

  const handleToggleDay = (day: string) => {
    if (compDias.includes(day)) {
      setCompDias(compDias.filter(d => d !== day))
    } else {
      if (compDias.length < 3) setCompDias([...compDias, day])
    }
  }

  const handleSaveCompanion = async () => {
    if(!user?.uid || !user.plan) return;
    setIsSavingCompanion(true);
    setStatus('Guardando acompañante...');
    try {
      const companionData = {
        nombre: compNombre,
        email: compEmail,
        rutinaDias: compDias
      };
      
      await updateDoc(doc(db, 'users', user.uid), {
        'plan.acompanante': companionData
      });
      
      updateUser({
        ...user,
        plan: {
          ...user.plan,
          acompanante: companionData
        }
      });
      setStatus('Acompañante registrado con éxito.');
    } catch {
      setStatus('Error al guardar acompañante.');
    } finally {
      setIsSavingCompanion(false);
    }
  }

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
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8 pb-8 border-b-2 border-dashed border-gray-100">
              {/* Avatar with upload button */}
              <div className="relative group shrink-0">
                <FitAvatar
                  src={currentAvatar}
                  alt="Avatar"
                  size={96}
                  borderWidth="border-4"
                  borderColor="border-black"
                  bgColor="bg-gray-100"
                  circleClassName="shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
                  fallback={<UserCircle className="w-16 h-16 text-gray-400" />}
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

              <div className="flex-1 min-w-0 text-center md:text-left">
                <h3 className="font-display italic text-3xl text-secondary truncate uppercase">{user?.username || 'Usuario'}</h3>
                <p className="font-label text-sm text-gray-500 truncate mb-4">{user?.email || 'Sin sesion'}</p>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  <button
                    onClick={handleAvatarClick}
                    disabled={isUploadingAvatar}
                    className="font-label text-xs font-black uppercase tracking-widest bg-black text-white px-4 py-2 border-2 border-black rounded shadow-[2px_2px_0_0_rgba(220,38,38,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
                  >
                    {isUploadingAvatar ? 'Cargando...' : 'Cambiar Imagen'}
                  </button>
                </div>
              </div>

              {/* QR ACCESS PASS - UNIVERSAL */}
              <div className="shrink-0 p-4 bg-white border-4 border-black rounded-3xl shadow-[6px_6px_0_0_rgba(22,163,74,1)] flex flex-col items-center group hover:scale-105 transition-transform">
                <QRCode value={user?.uid || 'no-session'} size={100} />
                <div className="mt-2 flex items-center gap-1">
                  <QrCode className="w-3 h-3 text-green-600" />
                  <span className="text-[9px] font-black text-black uppercase tracking-widest">Access Pass</span>
                </div>
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

          {/* Sección de Acompañante */}
          {showCompanionForm && (
            <div className="mt-8 bg-white border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] p-8 animate-in slide-in-from-bottom-4 duration-500">
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                 <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                      <Users className="text-white w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-display italic text-2xl tracking-[2px] uppercase">Invitado de Honor</h3>
                      <p className="font-label text-xs tracking-widest text-zinc-500 uppercase">Beneficio por Plan Parejas/Dos en Uno</p>
                    </div>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="font-label text-[10px] text-gray-500 uppercase font-black tracking-widest">Nombre del Acompañante</label>
                    <input
                      type="text"
                      placeholder="Ej. Clark Kent"
                      value={compNombre}
                      onChange={(e) => setCompNombre(e.target.value)}
                      className="w-full mt-2 font-body px-4 py-3 border-3 border-gray-200 outline-none focus:border-red-600 rounded-xl"
                    />
                 </div>
                 <div>
                    <label className="font-label text-[10px] text-gray-500 uppercase font-black tracking-widest">Correo de Registro</label>
                    <input
                      type="email"
                      placeholder="clark@krypton.com"
                      value={compEmail}
                      onChange={(e) => setCompEmail(e.target.value)}
                      className="w-full mt-2 font-body px-4 py-3 border-3 border-gray-200 outline-none focus:border-red-600 rounded-xl"
                    />
                 </div>
               </div>

               <div className="mt-6">
                  <label className="font-label text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3 block">Días de Entrenamiento (Máx 3) - Seleccionados: {compDias.length}/3</label>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map(day => (
                      <button 
                        key={day}
                        onClick={() => handleToggleDay(day)}
                        disabled={compDias.length >= 3 && !compDias.includes(day)}
                        className={`font-label text-xs font-bold uppercase tracking-widest px-4 py-2 border-2 rounded-xl transition-all ${compDias.includes(day) ? 'bg-red-600 border-red-600 text-white shadow-[3px_3px_0_0_rgba(0,0,0,1)] -translate-y-1' : 'bg-gray-100 border-gray-200 text-gray-500 hover:border-red-400 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
               </div>

               <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-200 flex justify-end">
                 <button
                   onClick={handleSaveCompanion}
                   disabled={isSavingCompanion || compDias.length === 0 || !compNombre || !compEmail}
                   className="inline-flex items-center gap-2 font-label font-black text-sm text-white bg-black px-8 py-4 border-2 border-black rounded-xl shadow-[6px_6px_0_0_rgba(220,38,38,1)] hover:bg-zinc-800 transition-all disabled:opacity-50 active:-translate-x-1 active:-translate-y-1 active:shadow-[2px_2px_0_0_rgba(220,38,38,1)] uppercase tracking-[2px]"
                 >
                   <Save className="w-5 h-5" />
                   {isSavingCompanion ? 'Vinculando...' : 'Guardar Acompañante'}
                 </button>
               </div>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}
