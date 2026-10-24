'use client'

import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

/**
 * Avatar actual de cada autor del foro (F1-09).
 *
 * La foto del autor se lee de `public_profiles/{uid}` (nombre y foto, lectura pública)
 * en lugar de copiarse en cada post y comentario: cambiar la foto es una sola
 * escritura. Caché en memoria por uid: una lectura por autor y por sesión. Si el
 * perfil público no existe o no se puede leer, se usa el avatar guardado en el post.
 */
const cache = new Map<string, Promise<string | null>>()

function fetchAvatar(uid: string): Promise<string | null> {
  let pending = cache.get(uid)
  if (!pending) {
    pending = getDoc(doc(db, 'public_profiles', uid))
      .then((snap) => (snap.exists() ? (snap.data().photoURL as string) || null : null))
      .catch(() => null)
    cache.set(uid, pending)
  }
  return pending
}

/**
 * Cambia nombre, avatar o foto propios vía /api/me/profile: el servidor actualiza
 * `users` y `public_profiles` juntos. Devuelve la foto resultante.
 */
export async function saveMyProfile(updates: { username?: string; avatar?: string; photoURL?: string }): Promise<string | null> {
  const user = auth.currentUser
  if (!user) throw new Error('Debes iniciar sesión.')
  const res = await fetch('/api/me/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(updates),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el perfil.')
  cache.delete(user.uid)
  return data.photoURL ?? null
}

/** Mapa uid → foto actual de los autores indicados (los que no tienen, no aparecen). */
export function useAuthorAvatars(uids: (string | null | undefined)[]): Record<string, string> {
  const key = useMemo(() => [...new Set(uids.filter(Boolean) as string[])].sort().join(','), [uids])
  const [avatars, setAvatars] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const ids = key.split(',')
    Promise.all(ids.map(async (uid) => [uid, await fetchAvatar(uid)] as const)).then((pairs) => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const [uid, url] of pairs) if (url) next[uid] = url
      setAvatars(next)
    })
    return () => { cancelled = true }
  }, [key])

  return avatars
}
