'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { SectionHeader } from '@/components/ui/section-header'
import { useCartStore } from '@/lib/store'
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, CreditCard } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

function formatPrice(price: number) {
  return '$ ' + price.toLocaleString('es-CO')
}

export default function CarritoPage() {
  const { items, removeItem, updateQuantity, clearCart, getTotal } = useCartStore()
  const [showModal, setShowModal] = useState(false)
  const total = getTotal()
  const router = useRouter()

  const handleCheckout = (): void => {
    router.push('/pago')
  }

  return (
    <main>
      <Topbar />

      <section className="mt-[72px] min-h-screen bg-muted py-16">
        <div className="max-w-[1100px] mx-auto px-8">
          <SectionHeader
            label="TU PEDIDO"
            title="CARRITO DE"
            titleAccent="COMPRAS"
          />

          {items.length === 0 ? (
            <div className="bg-white border-3 border-secondary shadow-comic p-16 text-center">
              <ShoppingBag className="w-24 h-24 text-gray-300 mx-auto mb-6" />
              <h3 className="font-display text-3xl text-secondary tracking-[2px] mb-4">
                TU CARRITO ESTA VACIO
              </h3>
              <p className="font-body text-gray-500 mb-8 max-w-md mx-auto">
                Aun no has agregado productos a tu carrito. Explora nuestra tienda y encuentra lo que necesitas para tu entrenamiento.
              </p>
              <Link
                href="/#productos"
                className="inline-flex items-center gap-2 font-display text-lg tracking-[2px] text-white bg-primary px-8 py-4 border-3 border-secondary shadow-comic transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--navy)] hover:bg-red-dark"
              >
                <ArrowLeft className="w-5 h-5" />
                IR A LA TIENDA
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Cart items */}
              <div className="lg:col-span-2 space-y-4">
                {items.map((item) => (
                  <div
                    key={`${item.id}-${item.color}-${item.talla}`}
                    className="bg-white border-3 border-secondary shadow-comic-sm flex flex-col sm:flex-row overflow-hidden"
                  >
                    {/* Image */}
                    <div className="relative w-full sm:w-[160px] h-[160px] bg-gray-100 flex-shrink-0">
                      {item.imagen_url ? (
                        <Image
                          src={item.imagen_url}
                          alt={item.nombre}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl text-gray-300">
                          {item.categoria === 'snacks' ? '🥜' : item.categoria === 'ropa' ? '👕' : '💊'}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-5 flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-heading font-extrabold text-lg text-secondary">
                            {item.nombre}
                          </h4>
                          <span className="font-label text-xs text-gray-500 uppercase">
                            {item.categoria}
                          </span>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-gray-400 hover:text-primary transition-colors"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Ropa details */}
                      {item.categoria === 'ropa' && (
                        <div className="flex gap-4 mb-3">
                          {item.color && (
                            <div className="flex items-center gap-2">
                              <span className="font-label text-xs text-gray-500">Color:</span>
                              <div
                                className="w-5 h-5 border-2 border-secondary"
                                style={{ backgroundColor: item.color }}
                              />
                            </div>
                          )}
                          {item.talla && (
                            <div className="flex items-center gap-2">
                              <span className="font-label text-xs text-gray-500">Talla:</span>
                              <span className="font-label text-xs font-bold text-secondary">{item.talla}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-auto flex items-center justify-between">
                        {/* Quantity controls */}
                        <div className="flex items-center border-2 border-secondary">
                          <button
                            onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors"
                            aria-label="Reducir cantidad"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-12 h-10 flex items-center justify-center font-label font-bold text-secondary border-x-2 border-secondary">
                            {item.cantidad}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors"
                            aria-label="Aumentar cantidad"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Price */}
                        <span className="font-display text-2xl text-primary tracking-[1px]">
                          {formatPrice(item.precio * item.cantidad)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Clear cart */}
                <button
                  onClick={clearCart}
                  className="flex items-center justify-center gap-2 font-label font-bold text-sm text-white bg-red-dark py-3 px-4 border-2 border-secondary shadow-comic-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_var(--navy)] active:translate-x-[1px] active:translate-y-[1px] rounded-lg"
                >
                  <Trash2 className="w-5 h-5" />
                  Vaciar carrito
                </button>
              </div>

              {/* Summary */}
              <div className="lg:col-span-1">
                <div className="bg-white border-3 border-secondary shadow-comic p-6 sticky top-[100px]">
                  <h3 className="font-display text-2xl text-secondary tracking-[2px] mb-6 pb-4 border-b-3 border-gray-200">
                    RESUMEN
                  </h3>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between font-body text-gray-700">
                      <span>Subtotal</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                    <div className="flex justify-between font-body text-gray-700">
                      <span>Envio</span>
                      <span className="text-green-600">Gratis</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-4 border-t-3 border-secondary mb-6">
                    <span className="font-display text-xl text-secondary tracking-[1px]">TOTAL</span>
                    <span className="font-display text-3xl text-primary tracking-[1px]">
                      {formatPrice(total)}
                    </span>
                  </div>

                  <button
                    onClick={handleCheckout}
                    className="w-full flex items-center justify-center gap-2 font-display text-xl tracking-[2px] text-white bg-primary py-4 px-6 border-3 border-secondary shadow-comic transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--navy)] hover:bg-red-dark"
                  >
                    <CreditCard className="w-6 h-6" />
                    PAGAR
                  </button>

                  <p className="font-body text-xs text-gray-500 text-center mt-4">
                    Pago seguro con stripe
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />

      {/* Payment Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-navy/85 flex items-center justify-center z-50 animate-[fadeIn_0.3s_ease]"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white border-4 border-secondary shadow-[8px_8px_0_var(--navy)] p-10 text-center max-w-md w-[90%] animate-[popIn_0.4s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display text-[2.5rem] text-primary [text-shadow:2px_2px_0_#fce] tracking-[2px] mb-2">
              EXCELENTE!
            </div>
            <div className="font-heading font-extrabold text-xl text-secondary mb-1">
              Total: {formatPrice(total)}
            </div>
            <p className="font-body text-[0.9rem] text-gray-500 mb-6">
              Proximamente integracion con PSE para pagos seguros. Tu pedido heroico esta casi listo!
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
    </main>
  )
}
