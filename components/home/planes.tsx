'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SectionHeader } from '@/components/ui/section-header'
import { Clock, Users, Star, Coffee, ArrowRight } from 'lucide-react'

const planes = [
  {
    id: 'estandar',
    name: 'Plan Estandar',
    price: 80000,
    duration: '1 Mes',
    days: 30,
    ribbon: 'BASICO',
    ribbonFeatured: false,
    description: 'Plan basico con acceso a las instalaciones durante un mes. Ideal para empezar tu transformacion heroica.',
    features: [
      'Acceso completo al gym',
      'Casillero incluido',
      'Zona de cardio y pesas',
    ],
    icon: Coffee,
    featured: false,
  },
  {
    id: 'parejas',
    name: 'Plan Parejas',
    price: 95000,
    duration: '40 Dias',
    days: 40,
    ribbon: 'POPULAR',
    ribbonFeatured: true,
    description: 'El usuario inscrito puede llevar un invitado 3 veces por semana. Entrena con tu companero de equipo!',
    features: [
      'Todo del Plan Estandar',
      'Invitado 3 veces/semana',
      'Acceso a clases grupales',
      'Asesoria nutricional',
    ],
    icon: Users,
    featured: true,
  },
  {
    id: 'dosenuno',
    name: 'Plan Dos en Uno',
    price: 140000,
    duration: '2 Meses',
    days: 60,
    ribbon: '25% OFF',
    ribbonFeatured: false,
    description: 'El usuario puede disfrutar 2 meses de gimnasio con un descuento aplicado del 25%. Maximo poder!',
    features: [
      'Todo del Plan Parejas',
      '25% de descuento',
      'Plan personalizado',
      'Seguimiento semanal',
    ],
    icon: Star,
    featured: false,
  },
]

function formatPrice(price: number) {
  return price.toLocaleString('es-CO')
}

export function Planes() {
  const [showModal, setShowModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<typeof planes[0] | null>(null)
  const router = useRouter()
  const handlePay = (plan: typeof planes[0]) => {
    //setSelectedPlan(plan) //modal anterior
    //setShowModal(true) //modal anterior
    const concepto = encodeURIComponent(plan.name)
    router.push(`/pago?concepto=${concepto}&monto=${plan.price}`)
  }

  return (
    <section id="planes" className="bg-muted relative overflow-hidden py-20">
      {/* Pattern background */}
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{
        backgroundImage: 'radial-gradient(circle, var(--gray-300) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }} />

      <div className="max-w-[1300px] mx-auto px-8 relative z-10">
        <SectionHeader 
          label="ELIGE TU PODER" 
          title="NUESTROS" 
          titleAccent="PLANES" 
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {planes.map((plan) => {
            const Icon = plan.icon
            return (
              <div
                key={plan.id}
                className={`bg-white border-3 border-secondary p-10 flex flex-col items-center text-center relative transition-all overflow-hidden group ${
                  plan.featured 
                    ? 'md:scale-105 shadow-[6px_6px_0_var(--red-dark)] bg-gradient-to-b from-white to-red-light border-primary hover:md:scale-105 hover:translate-y-[-8px] hover:shadow-[8px_8px_0_var(--red-dark)]' 
                    : 'shadow-comic hover:translate-y-[-8px] hover:shadow-[6px_6px_0_var(--navy)]'
                }`}
              >
                {/* Speed lines on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{
                  background: 'repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(220,38,38,0.03) 18px, rgba(220,38,38,0.03) 20px)'
                }} />

                {/* Ribbon */}
                <div className={`absolute top-4 right-[-35px] px-10 py-1 text-white font-label font-bold text-[0.7rem] tracking-[2px] rotate-45 z-10 ${
                  plan.ribbonFeatured ? 'bg-primary' : 'bg-secondary'
                }`}>
                  {plan.ribbonFeatured && '★ '}{plan.ribbon}
                </div>

                {/* Icon */}
                <div className={`mb-3 ${plan.featured ? 'text-red-dark' : 'text-primary'}`}>
                  <Icon className="w-12 h-12" strokeWidth={2} />
                </div>

                {/* Name */}
                <h3 className="font-display text-[1.8rem] text-secondary tracking-[2px] [text-shadow:1px_1px_0_var(--gray-200)] mb-4">
                  {plan.name}
                </h3>

                {/* Price */}
                <div className="flex items-start gap-1 mb-2">
                  <span className={`font-label font-bold text-xl mt-2 ${plan.featured ? 'text-red-dark' : 'text-primary'}`}>$</span>
                  <span className={`font-display text-5xl leading-none tracking-[1px] ${plan.featured ? 'text-red-dark' : 'text-primary'}`}>
                    {formatPrice(plan.price)}
                  </span>
                </div>

                {/* Duration */}
                <div className="flex items-center gap-2 font-label text-[0.85rem] text-gray-500 mb-6 px-4 py-2 bg-gray-100 border-2 border-gray-200">
                  <Clock className="w-4 h-4" />
                  Duracion: <strong>{plan.duration}</strong>
                </div>

                {/* Description */}
                <p className="font-body text-[0.9rem] text-gray-700 leading-relaxed mb-6">
                  {plan.description}
                </p>

                {/* Features */}
                <ul className="text-left w-full mb-8">
                  {plan.features.map((feature, i) => (
                    <li 
                      key={i} 
                      className="font-body text-[0.9rem] text-gray-700 py-2 border-b border-dashed border-gray-200 last:border-none"
                    >
                      &#10003; {feature}
                    </li>
                  ))}
                </ul>

                {/* Button */}
                <button
                  onClick={() => handlePay(plan)}
                  className={`flex items-center gap-2 font-display text-xl tracking-[2px] text-white px-10 py-3 border-3 mt-auto transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-[1px] active:translate-y-[1px] ${
                    plan.featured 
                      ? 'bg-primary border-red-dark shadow-comic-red hover:shadow-[5px_5px_0_var(--red-dark)] hover:bg-red-dark active:shadow-[2px_2px_0_var(--red-dark)]' 
                      : 'bg-secondary border-secondary shadow-comic-sm hover:shadow-[5px_5px_0_var(--navy)] hover:bg-navy-light active:shadow-[2px_2px_0_var(--navy)]'
                  }`}
                >
                  <span>PAGAR</span>
                  <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedPlan && (
        <div 
          className="fixed inset-0 bg-navy/85 flex items-center justify-center z-50 animate-[fadeIn_0.3s_ease]"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white border-4 border-secondary shadow-[8px_8px_0_var(--navy)] p-10 text-center max-w-md w-[90%] animate-[popIn_0.4s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display text-[2.5rem] text-primary [text-shadow:2px_2px_0_#fce] tracking-[2px] mb-2">
              GRAN ELECCION!
            </div>
            <div className="font-heading font-extrabold text-xl text-secondary mb-1">
              {selectedPlan.name}
            </div>
            <div className="font-display text-3xl text-primary mb-4">
              ${formatPrice(selectedPlan.price)}
            </div>
            <p className="font-body text-[0.9rem] text-gray-500 mb-6">
              Proximamente pasarela de pago. Tu aventura heroica esta a punto de comenzar!
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="font-display text-lg tracking-[2px] text-white bg-secondary border-3 border-secondary px-8 py-3 shadow-[3px_3px_0_var(--red-primary)] transition-all hover:bg-navy-light"
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </section>
  )
}
