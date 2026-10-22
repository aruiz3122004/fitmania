'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { getAvatarUrlById } from '@/lib/avatar-utils'
import { useAuthStore } from '@/lib/store'

interface AuthContextType {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const setEnrichedUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    let unsubProfile: (() => void) | null = null

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
      unsubProfile?.()
      unsubProfile = null

      if (!firebaseUser) {
        setEnrichedUser(null)
        return
      }

      // F2-17: el perfil se lee de Firestore en tiempo real (no de localStorage), así
      // una renovación confirmada por el webhook se refleja sin recargar.
      unsubProfile = onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        (userDoc) => {
          const raw = userDoc.data()
          const avatarId = raw?.avatar || 'fitman'
          // `photoURL` manda: lo escriben tanto la foto subida como el selector de avatares.
          // Antes ganaba el avatar predeterminado y la foto subida nunca se veía.
          const photoURL = raw?.photoURL || getAvatarUrlById(avatarId) || getAvatarUrlById('fitman')

          setEnrichedUser({
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
        },
        (error) => {
          console.error('Error al cargar perfil desde Firestore:', error)
          setEnrichedUser({
            uid: firebaseUser.uid,
            username: firebaseUser.email?.split('@')[0] || 'Usuario',
            email: firebaseUser.email || '',
            avatar: 'fitman',
            photoURL: getAvatarUrlById('fitman'),
            plan: null,
          })
        }
      )
    })

    return () => {
      unsubProfile?.()
      unsub()
    }
  }, [setEnrichedUser])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}