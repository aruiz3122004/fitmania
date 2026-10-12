'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
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
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)

      if (!firebaseUser) {
        setEnrichedUser(null)
        return
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        const raw = userDoc.data()
        const avatarId = raw?.avatar || 'fitman'
        const resolvedUrl = getAvatarUrlById(avatarId)
        const photoURL = resolvedUrl || raw?.photoURL || getAvatarUrlById('fitman')

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
      } catch (error) {
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
    })

    return () => unsub()
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