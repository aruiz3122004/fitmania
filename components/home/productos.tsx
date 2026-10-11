'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { SectionHeader } from '@/components/ui/section-header'
import { useCartStore, type CartItem } from '@/lib/store'
import { 
  Pill, 
  Cookie, 
  Shirt, 
  Plus, 
  Dumbbell, 
  Flame, 
  Heart, 
  Zap, 
  Award,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'

interface Product {
  id: string
  nombre: string
  precio: number
  categoria: string
  imagen_url?: string
  badge?: string
  colores?: string[]
  tallas?: string[]
  stock: number
}

const CATEGORY_ICONS: Record<string, any> = {
  suplementos: Pill,
  snacks: Cookie,
  ropa: Shirt,
  entrenamiento: Dumbbell,
  ofertas: Flame,
  salud: Heart,
  energia: Zap,
  premiun: Award
};

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
      categoria: product.categoria as any,
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

  const isOutOfStock = product.stock <= 0;

  return (
    <div className={cn("bg-white border-3 border-secondary overflow-hidden transition-all shadow-comic-sm group relative", !isOutOfStock && "hover:translate-y-[-6px] hover:-rotate-[0.5deg] hover:shadow-[6px_6px_0_var(--navy)]")}>
      {/* Image */}
      <div className="relative h-[200px] bg-gray-100 flex items-center justify-center overflow-hidden border-b-3 border-secondary">
        {product.imagen_url ? (
          <div className="relative w-full h-full">
            <Image
              src={product.imagen_url}
              alt={product.nombre}
              fill
              className={cn("object-cover transition-transform duration-400", !isOutOfStock && "group-hover:scale-110")}
            />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-gray-100 flex items-center justify-center">
            <span className="text-6xl opacity-50">
              {product.categoria === 'snacks' ? '🥜' : product.categoria === 'ropa' ? '👕' : '💊'}
            </span>
          </div>
        )}
        
        {product.badge && !isOutOfStock && (
          <span className="absolute top-3 left-3 bg-primary text-white font-label font-bold text-[0.65rem] tracking-[2px] px-3 py-1 border-2 border-secondary z-10">
            {product.badge}
          </span>
        )}

        {isOutOfStock && (
           <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <span className="bg-white border-2 border-black px-4 py-2 font-black italic text-red-600 rotate-[-5deg] shadow-[4px_4px_0_0_rgba(0,0,0,1)]">AGOTADO</span>
           </div>
        )}

        {/* Added overlay */}
        {showAdded && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/80 animate-[fadeIn_0.2s_ease] z-20">
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
        {product.categoria === 'ropa' && product.colores && product.colores.length > 0 && product.tallas && product.tallas.length > 0 && !isOutOfStock && (
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
          disabled={isOutOfStock || (product.categoria === 'ropa' && !selectedTalla)}
          className="w-full font-label font-bold text-[0.8rem] tracking-[1.5px] text-white bg-primary py-3 px-4 border-2 border-secondary shadow-[2px_2px_0_var(--navy)] transition-all hover:bg-red-dark hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_var(--navy)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_var(--navy)] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {isOutOfStock ? 'SIN STOCK' : 'AGREGAR'}
        </button>
      </div>
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export function Productos() {
  const [groupedProducts, setGroupedProducts] = useState<Record<string, Product[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simplificamos la consulta para evitar errores de índices compuestos faltantes
    const q = query(collection(db, 'products'), orderBy('nombre', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const grouped: Record<string, Product[]> = {};
      snapshot.forEach((doc) => {
        const data = doc.data() as Product;
        const prod = { ...data, id: doc.id };
        if (!grouped[prod.categoria]) {
          grouped[prod.categoria] = [];
        }
        grouped[prod.categoria].push(prod);
      });
      setGroupedProducts(grouped);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching products:", err);
      setError("No se pudieron cargar los productos.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="font-display text-2xl text-secondary tracking-widest italic animate-pulse">CARGANDO Battle Shop...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
        <p className="font-display text-2xl text-secondary">{error}</p>
      </div>
    );
  }

  const categories = Object.keys(groupedProducts);

  return (
    <section id="productos" className="bg-white relative py-20">
      <div className="max-w-[1300px] mx-auto px-8">
        <SectionHeader 
          label="TIENDA FITMANIA" 
          title="NUESTROS" 
          titleAccent="PRODUCTOS" 
        />

        {categories.length === 0 ? (
          <div className="text-center py-20 border-4 border-black border-dashed rounded-[2rem] opacity-20">
             <p className="font-display text-4xl text-zinc-300 italic uppercase">Próximamente nuevas existencias...</p>
          </div>
        ) : categories.map((catKey) => {
          const Icon = CATEGORY_ICONS[catKey] || Pill;
          const items = groupedProducts[catKey];
          return (
            <div key={catKey} className="mb-14 last:mb-0">
              <h3 className="font-display text-[1.8rem] text-secondary tracking-[2px] flex items-center gap-3 mb-6 pb-3 border-b-3 border-primary uppercase">
                <Icon className="w-6 h-6 text-primary" />
                {catKey}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {items.map((product) => (
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
