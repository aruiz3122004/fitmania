'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const slides = [
  {
    id: 1,
    image: '/images/gym1.jpg',
    badge: 'Te invitamos a conocer nuestras instalaciones',
    title: 'DESPIERTA TU',
    titleAccent: 'SUPER PODER',
    subtitle: 'Entrena como un heroe. Resultados de otro nivel.',
    cta: 'UNETE AHORA',
    ctaLink: '/#planes',
  },
  {
    id: 2,
    image: '/images/gym2.jpg',
    badge: 'Nuevas incorporaciones',
    title: 'ENTRENA',
    titleAccent: 'SIN LIMITES',
    subtitle: 'Equipos de ultima generacion para tu transformacion.',
    cta: 'VER PLANES',
    ctaLink: '/#planes',
  },
  {
    id: 3,
    image: '/Images/Gym3.jpg',
    badge: 'Planes personalizados',
    title: 'FORJA TU',
    titleAccent: 'LEGADO',
    subtitle: 'Cada repeticion te acerca a la grandeza.',
    cta: 'VER TIENDA',
    ctaLink: '/tienda',
  },
]

export function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const goToSlide = useCallback((index: number) => {
    if (isAnimating) return
    setIsAnimating(true)
    setCurrentSlide((index + slides.length) % slides.length)
    setTimeout(() => setIsAnimating(false), 800)
  }, [isAnimating])

  const nextSlide = useCallback(() => goToSlide(currentSlide + 1), [currentSlide, goToSlide])
  const prevSlide = useCallback(() => goToSlide(currentSlide - 1), [currentSlide, goToSlide])

  useEffect(() => {
    const interval = setInterval(nextSlide, 5000)
    return () => clearInterval(interval)
  }, [nextSlide])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevSlide()
      if (e.key === 'ArrowRight') nextSlide()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [nextSlide, prevSlide])

  return (
    <section className="mt-[72px] relative overflow-hidden bg-navy-dark">
      <div className="relative h-[85vh] min-h-[500px] max-h-[800px]">
        {/* Slides */}
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-800 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Background with gradient */}
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${slide.image})`,
                backgroundColor: '#1a1a2e'
              }}
            />
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-navy/85 via-primary/40 to-navy/70">
              {/* Halftone pattern */}
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: '6px 6px'
              }} />
            </div>

            {/* Content */}
            <div className="absolute inset-0 flex items-center px-[5%]">
              <div 
                className={`max-w-[700px] relative z-10 ${
                  index === currentSlide ? 'animate-[slideInUp_0.8s_ease-out]' : ''
                }`}
              >
                <span className="inline-block font-label font-bold text-[0.85rem] text-secondary bg-accent px-5 py-2 tracking-[2px] uppercase border-3 border-secondary shadow-comic-sm mb-6">
                  {slide.badge}
                </span>
                
                <h1 className="font-display text-[clamp(3rem,7vw,5.5rem)] text-white leading-none tracking-[3px] [text-shadow:4px_4px_0_var(--navy),-1px_-1px_0_var(--navy),1px_-1px_0_var(--navy),-1px_1px_0_var(--navy)] mb-4">
                  {slide.title}<br />
                  <span className="text-accent [text-shadow:4px_4px_0_var(--red-dark),-1px_-1px_0_var(--red-dark),1px_-1px_0_var(--red-dark),-1px_1px_0_var(--red-dark)]">
                    {slide.titleAccent}
                  </span>
                </h1>
                
                <p className="font-body text-xl text-white/90 mb-8 max-w-[500px]">
                  {slide.subtitle}
                </p>
                
                <Link
                  href={slide.ctaLink}
                  className="inline-block font-display text-[1.4rem] text-white bg-primary px-10 py-4 tracking-[2px] uppercase border-3 border-secondary shadow-comic transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--navy)] hover:bg-red-dark active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--navy)]"
                >
                  {slide.cta}
                </Link>
              </div>
            </div>
          </div>
        ))}

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-8 top-1/2 -translate-y-1/2 z-10 w-[52px] h-[52px] flex items-center justify-center text-white bg-primary/70 border-3 border-white backdrop-blur-sm transition-all hover:bg-primary hover:scale-110 hover:shadow-comic"
          aria-label="Anterior"
        >
          <ChevronLeft className="w-8 h-8" strokeWidth={3} />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-8 top-1/2 -translate-y-1/2 z-10 w-[52px] h-[52px] flex items-center justify-center text-white bg-primary/70 border-3 border-white backdrop-blur-sm transition-all hover:bg-primary hover:scale-110 hover:shadow-comic"
          aria-label="Siguiente"
        >
          <ChevronRight className="w-8 h-8" strokeWidth={3} />
        </button>

        {/* Dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-[14px] h-[14px] border-2 border-white transition-all ${
                index === currentSlide 
                  ? 'bg-accent border-secondary scale-[1.3] rotate-45 shadow-[0_0_10px_rgba(250,204,21,0.5)]' 
                  : 'bg-white/40 hover:bg-accent hover:scale-[1.2]'
              }`}
              aria-label={`Slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
