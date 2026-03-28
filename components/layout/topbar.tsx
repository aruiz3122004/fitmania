'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ShoppingCart, User, Menu, X } from 'lucide-react'
import { useCartStore, useAuthStore, useUIStore } from '@/lib/store'
import { UserDropdown } from './user-dropdown'
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
      setUser({
        uid: firebaseUser.uid,
        username: raw?.username || firebaseUser.email?.split('@')[0] || 'Usuario',
        email: firebaseUser.email || raw?.email || '',
        gender: raw?.gender,
        avatar: raw?.avatar || 'fitman',
        photoURL: raw?.photoURL || getAvatarUrlById(raw?.avatar || 'fitman'),
        peso: raw?.peso,
        altura: raw?.altura,
        plan: raw?.plan || null,
      })
    })

    return () => unsubscribe()
  }, [setUser])

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 bg-primary border-b-4 border-secondary transition-shadow duration-300 ${
        scrolled ? 'shadow-[0_4px_30px_rgba(0,0,0,0.4)]' : 'shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      }`}
    >
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-8 h-[72px]">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 transition-transform hover:scale-[1.03]">
          <div className="w-[50px] h-[50px] rounded-full border-3 border-white bg-secondary overflow-hidden shadow-[0_0_0_2px_var(--navy)]">
            <Image
              src="/Imagenes/Fitmania logo .jpeg"
              alt="Fitmania logo"
              width={50}
              height={50}
              className="w-full h-full object-cover"
            />
          </div>
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
              className={`font-heading font-bold text-[0.9rem] text-white px-4 py-2 uppercase tracking-[1px] relative transition-all border-2 border-transparent hover:bg-black/15 hover:border-white/20 ${
                pathname === link.href ? 'after:scale-x-100' : 'after:scale-x-0'
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

          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!isUserDropdownOpen)}
              className="text-white p-2 transition-transform hover:scale-115"
              aria-label="Mi cuenta"
            >
              {isAuthenticated && user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Avatar" 
                  className="w-7 h-7 rounded-full border-2 border-white object-cover"
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

      {/* Mobile Menu */}
      <div 
        className={`lg:hidden flex flex-col bg-red-dark border-t-3 border-secondary overflow-hidden transition-[max-height] duration-400 ${
          isMobileMenuOpen ? 'max-h-[400px]' : 'max-h-0'
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
      </div>
    </header>
  )
}
