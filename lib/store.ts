import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string
  nombre: string
  precio: number
  cantidad: number
  imagen_url?: string
  categoria: 'suplementos' | 'snacks' | 'ropa'
  color?: string
  talla?: string
}

export interface User {
  uid: string
  username: string
  email: string
  gender?: string
  avatar: string
  photoURL?: string
  peso?: number
  altura?: number
  plan?: {
    nombre: string
    precio: number
    dias_total: number
    inicio: Date
    expira: Date
  } | null
}

interface CartStore {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'cantidad'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, cantidad: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

function getImagenUrlForCartItem(item: Pick<CartItem, 'id' | 'categoria'>): string | undefined {
  if (item.categoria === 'suplementos') {
    switch (item.id) {
      case 'creatina':
        return '/Imagenes/suplementos/creatina_mono.png'
      case 'proteina':
        return '/Imagenes/suplementos/proteina.png'
      case 'aminoacidos':
        return '/Imagenes/suplementos/aminoacidos.png'
      case 'citrato':
        return '/Imagenes/suplementos/citrato_magnesio.png'
      default:
        return undefined
    }
  }

  if (item.categoria === 'snacks') {
    switch (item.id) {
      case 'granola':
        return '/Imagenes/Snacks/granola.jpeg'
      case 'yogurt':
        return '/Imagenes/Snacks/yogurt griego.jpeg'
      case 'tostadas':
        return '/Imagenes/Snacks/Tostadas Integrales.jpeg'
      case 'maranones':
        return '/Imagenes/Snacks/Snacks.jpeg'
      default:
        return undefined
    }
  }

  if (item.categoria === 'ropa') {
    switch (item.id) {
      case 'camisa':
        return '/Imagenes/Ropa/Camisa.jpeg'
      case 'pantaloneta':
        return '/Imagenes/Ropa/Pantaloneta.jpeg'
      case 'conjunto':
        return '/Imagenes/Ropa/Conjunto Mujer.jpeg'
      case 'medias':
        return '/Imagenes/Ropa/Medias.jpeg'
      default:
        return undefined
    }
  }

  return undefined
}

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  updateUser: (updates: Partial<User>) => void
  logout: () => void
}

interface UIStore {
  isMobileMenuOpen: boolean
  isUserDropdownOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  setUserDropdownOpen: (open: boolean) => void
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        set((state) => {
          const existingItem = state.items.find(
            (i) => i.id === item.id && i.color === item.color && i.talla === item.talla
          )
          if (existingItem) {
            return {
              items: state.items.map((i) =>
                i.id === item.id && i.color === item.color && i.talla === item.talla
                  ? { ...i, cantidad: i.cantidad + 1 }
                  : i
              ),
            }
          }
          return { items: [...state.items, { ...item, cantidad: 1 }] }
        })
      },
      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }))
      },
      updateQuantity: (id, cantidad) => {
        if (cantidad <= 0) {
          get().removeItem(id)
          return
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, cantidad } : i
          ),
        }))
      },
      clearCart: () => set({ items: [] }),
      getTotal: () => {
        return get().items.reduce((total, item) => total + item.precio * item.cantidad, 0)
      },
      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.cantidad, 0)
      },
    }),
    {
      name: 'fitmania-cart',
      version: 2,
      migrate: (persistedState: any) => {
        const items: CartItem[] = Array.isArray(persistedState?.items) ? persistedState.items : []
        return {
          ...persistedState,
          items: items.map((item) => {
            const mapped = getImagenUrlForCartItem(item)
            return mapped ? { ...item, imagen_url: mapped } : item
          }),
        }
      },
      onRehydrateStorage: () => (state?: CartStore) => {
        if (!state) return
        state.items = state.items.map((item) => {
          const mapped = getImagenUrlForCartItem(item)
          // Si ya existía una imagen pero apuntaba a rutas viejas, la reemplazamos.
          return mapped ? { ...item, imagen_url: mapped } : item
        })
      },
    }
  )
)

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
          isAuthenticated: !!state.user,
        })),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'fitmania-auth',
    }
  )
)

export const useUIStore = create<UIStore>()((set) => ({
  isMobileMenuOpen: false,
  isUserDropdownOpen: false,
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  setUserDropdownOpen: (open) => set({ isUserDropdownOpen: open }),
}))
