'use client'

import { useState } from 'react'
import Image from 'next/image'
import { SectionHeader } from '@/components/ui/section-header'
import { useCartStore, type CartItem } from '@/lib/store'
import { Pill, Cookie, Shirt, Plus } from 'lucide-react'

interface Product {
  id: string
  nombre: string
  precio: number
  categoria: 'suplementos' | 'snacks' | 'ropa'
  imagen_url?: string
  badge?: string
  colores?: string[]
  tallas?: string[]
}

const productos: Record<string, { icon: typeof Pill; title: string; items: Product[] }> = {
  suplementos: {
    icon: Pill,
    title: 'SUPLEMENTOS',
    items: [
      { id: 'creatina', nombre: 'Creatina Mono', precio: 200000, categoria: 'suplementos', imagen_url: '/Imagenes/suplementos/creatina_mono.png', badge: 'TOP' },
      { id: 'proteina', nombre: 'Proteina II', precio: 200000, categoria: 'suplementos', imagen_url: '/Imagenes/suplementos/proteina.png' },
      { id: 'aminoacidos', nombre: 'Aminoacidos', precio: 200000, categoria: 'suplementos', imagen_url: '/Imagenes/suplementos/aminoacidos.png' },
      { id: 'citrato', nombre: 'Citrato de Magnesio', precio: 150000, categoria: 'suplementos', imagen_url: '/Imagenes/suplementos/citrato_magnesio.png' },
    ],
  },
  snacks: {
    icon: Cookie,
    title: 'SNACKS',
    items: [
      { id: 'granola', nombre: 'Barra Granola', precio: 5000, categoria: 'snacks', imagen_url: '/Imagenes/Snacks/granola.jpeg' },
      { id: 'yogurt', nombre: 'Yogurt Griego', precio: 10000, categoria: 'snacks', imagen_url: '/Imagenes/Snacks/yogurt griego.jpeg' },
      { id: 'tostadas', nombre: 'Tostadas Integrales', precio: 3000, categoria: 'snacks', imagen_url: '/Imagenes/Snacks/Tostadas Integrales.jpeg' },
      { id: 'maranones', nombre: 'Marañones', precio: 4000, categoria: 'snacks', imagen_url: '/Imagenes/Snacks/Marañones.jpeg' },
    ],
  },
  ropa: {
    icon: Shirt,
    title: 'ROPA',
    items: [
      { id: 'camisa', nombre: 'Camisa Fitman', precio: 45000, categoria: 'ropa', imagen_url: '/Imagenes/Ropa/Camisa.jpeg', colores: ['#DC2626', '#1a1a2e', '#FFFFFF'], tallas: ['S', 'M', 'L', 'XL'] },
      { id: 'pantaloneta', nombre: 'Pantaloneta Fitman', precio: 35000, categoria: 'ropa', imagen_url: '/Imagenes/Ropa/Pantaloneta.jpeg', colores: ['#1a1a2e', '#DC2626', '#374151'], tallas: ['S', 'M', 'L', 'XL'] },
      { id: 'conjunto', nombre: 'Conjunto Fit + Falda', precio: 60000, categoria: 'ropa', imagen_url: '/Imagenes/Ropa/Conjunto Mujer.jpeg', colores: ['#e11d48', '#1a1a2e', '#DC2626'], tallas: ['S', 'M', 'L'] },
      { id: 'medias', nombre: 'Medias Fitman', precio: 20000, categoria: 'ropa', imagen_url: '/Imagenes/Ropa/Medias.jpeg', colores: ['#FFFFFF', '#1a1a2e', '#DC2626'], tallas: ['S', 'M', 'L'] },
    ],
  },
}

function formatPrice(price: number) {
  return '$ ' + price.toLocaleString('es-CO')
}

function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCartStore()
  const [selectedColor, setSelectedColor] = useState(product.colores?.[0] || '')
  const [selectedTalla, setSelectedTalla] = useState('')
  const [showAdded, setShowAdded] = useState(false)

  const handleAdd = () => {
    const item: Omit<CartItem, 'cantidad'> = {
      id: product.id,
      nombre: product.nombre,
      precio: product.precio,
      categoria: product.categoria,
      imagen_url: product.imagen_url,
      ...(product.categoria === 'ropa' && {
        color: selectedColor,
        talla: selectedTalla,
      }),
    }
    addItem(item)
    setShowAdded(true)
    setTimeout(() => setShowAdded(false), 1200)
  }

  return (
    <div className="bg-white border-3 border-secondary overflow-hidden transition-all shadow-comic-sm hover:translate-y-[-6px] hover:-rotate-[0.5deg] hover:shadow-[6px_6px_0_var(--navy)] group">
      {/* Image */}
      <div className="relative h-[200px] bg-gray-100 flex items-center justify-center overflow-hidden border-b-3 border-secondary">
        {product.imagen_url ? (
          <div className="relative w-full h-full">
            <Image
              src={product.imagen_url}
              alt={product.nombre}
              fill
              className="object-cover transition-transform duration-400 group-hover:scale-110"
            />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-gray-100 flex items-center justify-center">
            <span className="text-6xl opacity-50">
              {product.categoria === 'snacks' ? '🥜' : product.categoria === 'ropa' ? '👕' : '💊'}
            </span>
          </div>
        )}
        
        {product.badge && (
          <span className="absolute top-3 left-3 bg-primary text-white font-label font-bold text-[0.65rem] tracking-[2px] px-3 py-1 border-2 border-secondary">
            {product.badge}
          </span>
        )}

        {/* Added overlay */}
        {showAdded && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/80 animate-[fadeIn_0.2s_ease]">
            <span className="font-display text-2xl text-accent [text-shadow:2px_2px_0_var(--navy)]">
              AGREGADO!
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <h4 className="font-heading font-extrabold text-base text-secondary mb-1">
          {product.nombre}
        </h4>
        <span className="font-display text-2xl text-primary tracking-[1px] block mb-3">
          {formatPrice(product.precio)}
        </span>

        {/* Ropa options */}
        {product.categoria === 'ropa' && product.colores && product.tallas && (
          <div className="flex flex-col gap-3 mb-3">
            {/* Color selector */}
            <div className="flex items-center gap-2">
              <span className="font-label text-xs text-gray-500">Color:</span>
              <div className="flex gap-1">
                {product.colores.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-6 h-6 border-2 transition-all ${
                      selectedColor === color ? 'border-secondary scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </div>
            
            {/* Talla selector */}
            <div className="flex items-center gap-2">
              <span className="font-label text-xs text-gray-500">Talla:</span>
              <div className="flex gap-1">
                {product.tallas.map((talla) => (
                  <button
                    key={talla}
                    onClick={() => setSelectedTalla(talla)}
                    className={`w-7 h-7 font-label text-xs font-bold border-2 transition-all ${
                      selectedTalla === talla 
                        ? 'border-secondary bg-secondary text-white' 
                        : 'border-gray-300 text-gray-600 hover:border-secondary'
                    }`}
                  >
                    {talla}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Add button */}
        <button
          onClick={handleAdd}
          disabled={product.categoria === 'ropa' && !selectedTalla}
          className="w-full font-label font-bold text-[0.8rem] tracking-[1.5px] text-white bg-primary py-3 px-4 border-2 border-secondary shadow-[2px_2px_0_var(--navy)] transition-all hover:bg-red-dark hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_var(--navy)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_var(--navy)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          AGREGAR
        </button>
      </div>
    </div>
  )
}

export function Productos() {
  return (
    <section id="productos" className="bg-white relative py-20">
      <div className="max-w-[1300px] mx-auto px-8">
        <SectionHeader 
          label="TIENDA FITMANIA" 
          title="NUESTROS" 
          titleAccent="PRODUCTOS" 
        />

        {Object.entries(productos).map(([key, category]) => {
          const Icon = category.icon
          return (
            <div key={key} className="mb-14 last:mb-0">
              <h3 className="font-display text-[1.8rem] text-secondary tracking-[2px] flex items-center gap-3 mb-6 pb-3 border-b-3 border-primary">
                <Icon className="w-6 h-6" />
                {category.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {category.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </section>
  )
}
