'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { ShoppingCart, User, Menu, X } from 'lucide-react'
import { useCartStore, useAuthStore, useUIStore } from '@/lib/store'
import { UserDropdown } from './user-dropdown'
import { FitAvatar } from '@/components/ui/fit-avatar'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { getAvatarUrlById } from '@/lib/avatar-utils'

const navLinks = [
  { href: '/', label: 'Inicio' },
  { href: '/tienda', label: 'Tienda' },
  { href: '/planes', label: 'Planes' },
  { href: '/foro', label: 'Foro' },
  { href: '/entrenadores', label: 'Entrenadores' },
  { href: '/pqrs', label: 'PQRS' },
]

export function Topbar() {
  const pathname = usePathname()
  const cartCount = useCartStore((state) =>
    state.items.reduce((count, item) => count + item.cantidad, 0),
  )
  const { user, isAuthenticated, setUser } = useAuthStore()
  const { isMobileMenuOpen, setMobileMenuOpen, isUserDropdownOpen, setUserDropdownOpen } = useUIStore()
  const [scrolled, setScrolled] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false)
      }
    }

    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isUserDropdownOpen, setUserDropdownOpen])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        return
      }

      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      const raw = userDoc.data()
      const avatarId = raw?.avatar || 'fitman'
      // If user has a default avatar, always resolve URL from code (not stale Firestore cache)
      const resolvedUrl = getAvatarUrlById(avatarId)
      const photoURL = resolvedUrl || raw?.photoURL || getAvatarUrlById('fitman')

      setUser({
        uid: firebaseUser.uid,
        username: raw?.username || firebaseUser.email?.split('@')[0] || 'Usuario',
        email: firebaseUser.email || raw?.email || '',
        gender: raw?.gender,
        avatar: avatarId,
        photoURL: photoURL,
        peso: raw?.peso,
        altura: raw?.altura,
        plan: raw?.plan
          ? {
            ...raw.plan,
            inicio: raw.plan.inicio?.toDate?.() || new Date(raw.plan.inicio),
            expira: raw.plan.expira?.toDate?.() || new Date(raw.plan.expira),
          }
          : null,
      })
    })

    return () => unsubscribe()
  }, [setUser])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-primary border-b-4 border-secondary transition-shadow duration-300 ${scrolled ? 'shadow-[0_4px_30px_rgba(0,0,0,0.4)]' : 'shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
        }`}
    >
      {/* Helper component for calculating remaining days */}
      {(() => {
        const getDaysRemaining = () => {
          if (!user?.plan?.expira) return null
          const now = new Date()
          const expira = new Date(user.plan.expira)
          const diff = Math.ceil((expira.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          return diff > 0 ? diff : 0
        }
        const daysRemaining = getDaysRemaining()
        const isPremium = !!(user?.plan && daysRemaining !== null && daysRemaining > 0)

        return (
          <div className="max-w-[1400px] mx-auto flex items-center justify-between px-8 h-[72px]">
            {/* Logo */}
            <Link
              href="/"
              onClick={() => {
                setMobileMenuOpen(false)
                setUserDropdownOpen(false)
              }}
              className="flex items-center gap-3 transition-transform hover:scale-[1.03]"
            >
              <FitAvatar
                src="/Imagenes/Avatares/FitmanNEW.png"
                alt="Fitmania logo"
                size={50}
                borderWidth="border-3"
                borderColor="border-white"
                bgColor="bg-secondary"
                circleClassName="shadow-[0_0_0_2px_var(--navy)]"
              />
              <div className="flex flex-col">
                <span className="font-display text-[1.8rem] text-white tracking-[2px] leading-none [text-shadow:2px_2px_0_var(--navy)]">
                  FIT<span className="text-accent">MANIA</span>
                </span>
                <span className="font-label text-[0.65rem] text-white/85 tracking-[1.5px] uppercase">
                  Tu Pasion. Tu Fuerza.
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`font-heading font-bold text-[0.9rem] text-white px-4 py-2 uppercase tracking-[1px] relative transition-all border-2 border-transparent hover:bg-black/15 hover:border-white/20 ${pathname === link.href ? 'after:scale-x-100' : 'after:scale-x-0'
                    } after:content-[''] after:absolute after:bottom-[2px] after:left-1/2 after:-translate-x-1/2 after:w-[70%] after:h-[3px] after:bg-accent after:transition-transform hover:after:scale-x-100`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link
                href="/carrito"
                className="relative text-white p-2 transition-transform hover:scale-115 hover:-rotate-5"
                aria-label="Carrito de compras"
              >
                <ShoppingCart className="w-6 h-6" strokeWidth={2.5} />
                {cartCount > 0 && (
                  <span className="absolute -top-[2px] -right-1 bg-accent text-secondary font-label font-bold text-[0.65rem] w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-secondary">
                    {cartCount}
                  </span>
                )}
              </Link>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen(!isUserDropdownOpen)}
                  className="text-white p-2 transition-transform hover:scale-115"
                  aria-label="Mi cuenta"
                >
                  {isAuthenticated && user?.photoURL ? (
                    <FitAvatar
                      src={user.photoURL}
                      alt="Avatar"
                      size={28}
                      borderColor="border-white"
                      bgColor="bg-primary"
                      isPremium={isPremium}
                    />
                  ) : (
                    <User className="w-7 h-7" strokeWidth={2.5} />
                  )}
                </button>
                {isUserDropdownOpen && <UserDropdown />}
              </div>

              {/* Hamburger */}
              <button
                className="lg:hidden flex flex-col gap-[5px] p-2"
                onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6 text-white" />
                ) : (
                  <Menu className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          </div>
        )
      })()}

      {/* Mobile Menu */}
      {(() => {
        const getDaysRemaining = () => {
          if (!user?.plan?.expira) return null
          const now = new Date()
          const expira = new Date(user.plan.expira)
          const diff = Math.ceil((expira.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          return diff > 0 ? diff : 0
        }
        const daysRemaining = getDaysRemaining()
        const isPremium = !!(user?.plan && daysRemaining !== null && daysRemaining > 0)

        return (
          <div
            className={`lg:hidden flex flex-col bg-red-dark border-t-3 border-secondary overflow-hidden transition-[max-height] duration-400 ${isMobileMenuOpen ? 'max-h-[800px]' : 'max-h-0'
              }`}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="font-heading font-bold text-base text-white px-8 py-4 uppercase tracking-[1px] border-b-2 border-white/10 transition-colors hover:bg-black/20"
              >
                {link.label}
              </Link>
            ))}
            {/* Mobile User/Login item */}
            {!isAuthenticated ? (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="font-heading font-bold text-base text-accent px-8 py-4 uppercase tracking-[1px] border-b-2 border-white/10 transition-colors hover:bg-black/20 flex items-center gap-2"
              >
                <User className="w-5 h-5" strokeWidth={2.5} /> Iniciar Sesion / Registrarse
              </Link>
            ) : (
              <div className="flex flex-col border-b-2 border-white/10">
                <div className="px-8 py-4 flex items-center gap-3">
                  {user?.photoURL ? (
                    <FitAvatar
                      src={user.photoURL}
                      alt="Avatar"
                      size={32}
                      borderColor="border-white"
                      bgColor="bg-primary"
                      isPremium={isPremium}
                    />
                  ) : (
                    <User className="w-8 h-8 text-white" strokeWidth={2.5} />
                  )}
                  <div className="flex flex-col">
                    <span className="font-heading font-bold text-base text-white uppercase">{user?.username}</span>
                    <span className="font-label text-xs text-white/70">{user?.email}</span>
                  </div>
                </div>
                <Link
                  href="/perfil"
                  onClick={() => setMobileMenuOpen(false)}
                  className="font-heading font-bold text-[0.9rem] text-accent px-8 py-3 uppercase tracking-[1px] transition-colors hover:bg-black/20"
                >
                  Configuracion
                </Link>
              </div>
            )}
          </div>
        )
      })()}
    </header>
  )
}
