'use client'

import Image from 'next/image'
import { SectionHeader } from '@/components/ui/section-header'
import { MessageCircle } from 'lucide-react'

const coaches = [
  {
    id: 'randy',
    nombre: 'RANDY',
    role: 'Entrenador de Fuerza',
    specialty: 'Fuerza & Potencia',
    bio: 'Especialista en entrenamiento de fuerza con mas de 10 anos de experiencia. Certificado en levantamiento olimpico.',
    imagen_url: '/Imagenes/Coaches/Randy.jpeg',
    whatsapp: '+573001234567',
  },
  {
    id: 'melissa',
    nombre: 'MELISSA',
    role: 'Entrenadora HIIT',
    specialty: 'Cardio & HIIT',
    bio: 'Experta en entrenamiento de alta intensidad. Te ayudara a quemar grasa y mejorar tu resistencia cardiovascular.',
    imagen_url: '/Imagenes/Coaches/Melissa.jpeg',
    whatsapp: '+573001234568',
  },
  {
    id: 'cinereth',
    nombre: 'CINERETH',
    role: 'Entrenadora Funcional',
    specialty: 'Funcional & Core',
    bio: 'Especializada en entrenamiento funcional y fortalecimiento del core. Mejora tu movilidad y estabilidad.',
    imagen_url: '/Imagenes/Coaches/Cinereth.jpeg',
    whatsapp: '+573001234569',
  },
  {
    id: 'yonaiker',
    nombre: 'YONAIKER',
    role: 'Entrenador de Musculacion',
    specialty: 'Musculacion',
    bio: 'Experto en hipertrofia muscular y composicion corporal. Te guiara en tu camino hacia la masa muscular.',
    imagen_url: '/Imagenes/Coaches/Yonaiker.jpeg',
    whatsapp: '+573001234570',
  },
]

export function Entrenadores() {
  const handleWhatsApp = (whatsapp: string, nombre: string) => {
    const message = encodeURIComponent(`Hola ${nombre}, quiero agendar una sesion de entrenamiento en Fitmania!`)
    window.open(`https://wa.me/${whatsapp.replace(/\+/g, '')}?text=${message}`, '_blank')
  }

  return (
    <section id="entrenadores" className="bg-navy-dark relative overflow-hidden py-20">
      {/* Halftone pattern */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '10px 10px'
      }} />

      <div className="max-w-[1300px] mx-auto px-8 relative z-10">
        <SectionHeader 
          label="TU EQUIPO DE HEROES" 
          title="NUESTROS" 
          titleAccent="ENTRENADORES" 
          dark
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {coaches.map((coach) => (
            <div
              key={coach.id}
              className="bg-navy-light border-3 border-white/15 overflow-hidden transition-all shadow-[4px_4px_0_rgba(0,0,0,0.4)] hover:translate-y-[-8px] hover:-rotate-1 hover:shadow-[6px_6px_0_var(--red-primary)] hover:border-primary group"
            >
              {/* Image */}
              <div className="relative h-[280px] overflow-hidden">
                <div className="relative w-full h-full">
                  <Image
                    src={coach.imagen_url}
                    alt={`Coach ${coach.nombre}`}
                    fill
                    className="object-cover transition-all duration-500 grayscale-[20%] group-hover:grayscale-0 group-hover:scale-110"
                  />
                </div>
                
                {/* Overlay with specialty */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-navy/90 to-transparent translate-y-full transition-transform duration-400 group-hover:translate-y-0">
                  <span className="font-label font-bold text-[0.85rem] text-accent tracking-[1px] uppercase">
                    {coach.specialty}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-5 border-t-3 border-primary">
                <h4 className="font-display text-2xl text-white tracking-[2px] [text-shadow:1px_1px_0_var(--navy-dark)]">
                  {coach.nombre}
                </h4>
                <p className="font-label text-[0.8rem] text-gray-300 tracking-[1px] uppercase mb-3">
                  {coach.role}
                </p>
                <p className="font-body text-sm text-gray-400 leading-relaxed mb-4">
                  {coach.bio}
                </p>
                
                {/* WhatsApp button */}
                <button
                  onClick={() => handleWhatsApp(coach.whatsapp, coach.nombre)}
                  className="w-full flex items-center justify-center gap-2 font-label font-bold text-sm text-white bg-[#25D366] py-3 px-4 border-2 border-secondary shadow-comic-sm transition-all hover:bg-[#128C7E] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_var(--navy)]"
                >
                  <MessageCircle className="w-5 h-5" />
                  AGENDAR
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
