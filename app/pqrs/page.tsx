'use client'

import { useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { SectionHeader } from '@/components/ui/section-header'
import { useAuthStore } from '@/lib/store'
import { 
  HelpCircle, 
  AlertTriangle, 
  XCircle, 
  Lightbulb, 
  Send,
  CheckCircle,
  ArrowRight
} from 'lucide-react'

const tiposPQRS = [
  {
    id: 'peticion',
    label: 'Peticion',
    icon: HelpCircle,
    description: 'Solicita informacion, servicios o cambios en nuestros procedimientos.',
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
  },
  {
    id: 'queja',
    label: 'Queja',
    icon: AlertTriangle,
    description: 'Reporta una situacion que afecta tu experiencia en el gimnasio.',
    color: 'bg-yellow-500',
    borderColor: 'border-yellow-500',
  },
  {
    id: 'reclamo',
    label: 'Reclamo',
    icon: XCircle,
    description: 'Exige una solucion a un problema con nuestros servicios o productos.',
    color: 'bg-primary',
    borderColor: 'border-primary',
  },
  {
    id: 'sugerencia',
    label: 'Sugerencia',
    icon: Lightbulb,
    description: 'Comparte ideas para mejorar nuestros servicios y tu experiencia.',
    color: 'bg-green-500',
    borderColor: 'border-green-500',
  },
]

export default function PQRSPage() {
  const { user, isAuthenticated } = useAuthStore()
  const [selectedTipo, setSelectedTipo] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTipo || !mensaje.trim()) return
    
    // Here would go the Firebase submission
    console.log('PQRS submitted:', { tipo: selectedTipo, mensaje })
    setIsSubmitted(true)
  }

  const resetForm = () => {
    setSelectedTipo(null)
    setMensaje('')
    setIsSubmitted(false)
  }

  return (
    <main>
      <Topbar />
      
      <section className="mt-[72px] min-h-screen bg-muted py-16">
        <div className="max-w-[800px] mx-auto px-8">
          <SectionHeader 
            label="ATENCION AL CLIENTE" 
            title="SISTEMA" 
            titleAccent="PQRS" 
          />

          <div className="bg-white border-3 border-secondary shadow-comic p-8">
            {!isAuthenticated ? (
              <div className="text-center py-8">
                <HelpCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="font-display text-2xl text-secondary tracking-wider mb-3">
                  INICIA SESION
                </h3>
                <p className="font-body text-gray-500 mb-6 max-w-md mx-auto">
                  Debes iniciar sesion para enviar una peticion, queja, reclamo o sugerencia.
                </p>
                <a
                  href="/login"
                  className="inline-flex items-center gap-2 font-label font-bold text-sm text-white bg-primary px-6 py-3 border-2 border-secondary shadow-comic-sm transition-all hover:bg-red-dark hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_var(--navy)]"
                >
                  INICIAR SESION
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            ) : isSubmitted ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 border-3 border-green-500">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="font-display text-2xl text-secondary tracking-wider mb-3">
                  ENVIADO CON EXITO!
                </h3>
                <p className="font-body text-gray-500 mb-6 max-w-md mx-auto">
                  Tu {tiposPQRS.find(t => t.id === selectedTipo)?.label.toLowerCase()} ha sido registrada. Te responderemos pronto a tu correo electronico.
                </p>
                <button
                  onClick={resetForm}
                  className="font-label font-bold text-sm text-white bg-secondary px-6 py-3 border-2 border-secondary shadow-comic-sm transition-all hover:bg-navy-light"
                >
                  ENVIAR OTRA
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* User info */}
                <div className="flex items-center gap-3 pb-6 mb-6 border-b-2 border-gray-200">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-primary flex items-center justify-center border-3 border-secondary flex-shrink-0">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-lg text-white">
                        {user?.username?.charAt(0) || 'U'}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-label font-bold text-sm text-secondary">
                      {user?.username || 'Usuario'}
                    </h4>
                    <p className="font-label text-xs text-gray-400">
                      {user?.email}
                    </p>
                  </div>
                </div>

                {/* Type selection */}
                <div className="mb-6">
                  <h3 className="font-display text-xl text-secondary tracking-wider mb-4">
                    SELECCIONA EL TIPO
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {tiposPQRS.map((tipo) => {
                      const Icon = tipo.icon
                      const isSelected = selectedTipo === tipo.id
                      return (
                        <button
                          key={tipo.id}
                          type="button"
                          onClick={() => setSelectedTipo(tipo.id)}
                          className={`p-4 border-3 text-center transition-all ${
                            isSelected 
                              ? `${tipo.borderColor} bg-gray-50 shadow-comic-sm` 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full ${tipo.color} flex items-center justify-center mx-auto mb-2`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <span className="font-label font-bold text-sm text-secondary block">
                            {tipo.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {selectedTipo && (
                    <p className="font-body text-sm text-gray-500 mt-3 p-3 bg-gray-50 border-l-4 border-secondary">
                      {tiposPQRS.find(t => t.id === selectedTipo)?.description}
                    </p>
                  )}
                </div>

                {/* Message */}
                <div className="mb-6">
                  <label className="font-display text-xl text-secondary tracking-wider mb-4 block">
                    TU MENSAJE
                  </label>
                  <textarea
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    placeholder="Describe tu peticion, queja, reclamo o sugerencia en detalle..."
                    className="w-full font-body text-gray-700 p-4 border-3 border-gray-200 focus:border-primary outline-none resize-none transition-colors"
                    rows={6}
                    required
                  />
                  <p className="font-label text-xs text-gray-400 mt-2">
                    Minimo 20 caracteres. Se claro y especifico.
                  </p>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!selectedTipo || mensaje.trim().length < 20}
                  className="w-full flex items-center justify-center gap-2 font-display text-xl tracking-[2px] text-white bg-primary py-4 px-6 border-3 border-secondary shadow-comic transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--navy)] hover:bg-red-dark disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-comic"
                >
                  <Send className="w-6 h-6" />
                  ENVIAR
                </button>
              </form>
            )}
          </div>

          {/* Info */}
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div className="bg-white border-3 border-secondary shadow-comic-sm p-6">
              <h4 className="font-display text-lg text-secondary tracking-wider mb-3">
                TIEMPO DE RESPUESTA
              </h4>
              <ul className="space-y-2">
                <li className="font-body text-sm text-gray-600 flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary"></span>
                  Peticiones: 5 dias habiles
                </li>
                <li className="font-body text-sm text-gray-600 flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-500"></span>
                  Quejas: 3 dias habiles
                </li>
                <li className="font-body text-sm text-gray-600 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500"></span>
                  Reclamos: 15 dias habiles
                </li>
                <li className="font-body text-sm text-gray-600 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500"></span>
                  Sugerencias: 10 dias habiles
                </li>
              </ul>
            </div>
            <div className="bg-white border-3 border-secondary shadow-comic-sm p-6">
              <h4 className="font-display text-lg text-secondary tracking-wider mb-3">
                CONTACTO DIRECTO
              </h4>
              <p className="font-body text-sm text-gray-600 mb-3">
                Si prefieres comunicarte directamente:
              </p>
              <p className="font-label text-sm text-secondary">
                +57 300 123 4567
              </p>
              <p className="font-label text-sm text-secondary">
                pqrs@fitmania.com
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
