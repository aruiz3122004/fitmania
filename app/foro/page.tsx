'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { SectionHeader } from '@/components/ui/section-header'
import { useAuthStore } from '@/lib/store'
import { db, storage } from '@/lib/firebase'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import {
  Heart,
  MessageCircle,
  Share2,
  Flag,
  Send,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  ImageIcon,
} from 'lucide-react'

type ForumComment = {
  id: string
  autor_username: string
  contenido: string
  created_at: Date
}

type ForumPost = {
  id: string
  autor_id: string
  autor_username: string
  autor_avatar: string
  contenido: string
  imagen_url: string | null
  likes: string[]
  comentarios: ForumComment[]
  created_at: Date
}

const noticias = [
  {
    id: 1,
    imagen: '/images/gym1.jpg',
    titulo: 'Nueva zona de CrossFit',
    descripcion: 'Inauguramos nuestra nueva area de entrenamiento CrossFit con equipos de ultima generacion.',
  },
  {
    id: 2,
    imagen: '/images/gym2.jpg',
    titulo: 'Torneo de Fuerza 2026',
    descripcion: 'Participa en nuestro proximo torneo de levantamiento de pesas. Premios increibles!',
  },
  {
    id: 3,
    imagen: '/Imagenes/Fitmania Animado.jpeg',
    titulo: 'Clases de Yoga',
    descripcion: 'Nuevas clases de yoga todos los sabados a las 8AM. Relaja cuerpo y mente.',
  },
]

function formatDate(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (hours < 1) return 'Hace un momento'
  if (hours < 24) return `Hace ${hours}h`
  if (days < 7) return `Hace ${days}d`
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function NewsSlider() {
  const [current, setCurrent] = useState(0)
  const next = () => setCurrent((c) => (c + 1) % noticias.length)
  const prev = () => setCurrent((c) => (c - 1 + noticias.length) % noticias.length)

  return (
    <div className="relative bg-secondary border-3 border-secondary shadow-comic mb-10 overflow-hidden">
      <div className="relative h-[300px] md:h-[350px]">
        {noticias.map((noticia, index) => (
          <div
            key={noticia.id}
            className={`absolute inset-0 transition-opacity duration-500 ${index === current ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${noticia.imagen})`, backgroundColor: '#1a1a2e' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/70 to-transparent" />
            <div className="absolute inset-0 flex items-center px-8 md:px-16">
              <div className="max-w-lg">
                <span className="inline-block font-label font-bold text-xs text-navy bg-accent px-3 py-1 tracking-wider uppercase border-2 border-navy mb-4">NOTICIAS</span>
                <h3 className="font-display text-3xl md:text-4xl text-white tracking-wider mb-3 [text-shadow:2px_2px_0_var(--navy)]">{noticia.titulo}</h3>
                <p className="font-body text-white/90 text-base">{noticia.descripcion}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/20 border-2 border-white text-white hover:bg-primary transition-colors">
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/20 border-2 border-white text-white hover:bg-primary transition-colors">
        <ChevronRight className="w-6 h-6" />
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {noticias.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrent(index)}
            className={`w-3 h-3 border-2 border-white transition-all ${index === current ? 'bg-accent' : 'bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  )
}

function PostCard({
  post,
  onLike,
  onAddComment,
}: {
  post: ForumPost
  onLike: (id: string) => void
  onAddComment: (id: string, content: string) => Promise<void>
}) {
  const { user, isAuthenticated } = useAuthStore()
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [isCommenting, setIsCommenting] = useState(false)
  const isLiked = user ? post.likes.includes(user.uid) : false

  const handleComment = async () => {
    const content = newComment.trim()
    if (!content || isCommenting) return
    setIsCommenting(true)
    try {
      await onAddComment(post.id, content)
      setNewComment('')
    } finally {
      setIsCommenting(false)
    }
  }

  return (
    <div className="bg-white border-3 border-secondary shadow-comic-sm mb-6">
      <div className="flex items-center gap-3 p-4 border-b-2 border-gray-200">
        <div className="w-12 h-12 rounded-full border-3 border-secondary overflow-hidden bg-gray-100">
          {post.autor_avatar ? (
            <Image src={post.autor_avatar} alt={post.autor_username} width={48} height={48} className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <UserCircle className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>
        <div>
          <h4 className="font-label font-bold text-sm text-secondary">{post.autor_username}</h4>
          <span className="font-label text-xs text-gray-400">{formatDate(post.created_at)}</span>
        </div>
      </div>

      <div className="p-4">
        <p className="font-body text-gray-700 leading-relaxed mb-4">{post.contenido}</p>
        {post.imagen_url && (
          <div className="relative w-full h-[300px] border-3 border-secondary overflow-hidden mb-4">
            <Image src={post.imagen_url} alt="Post image" fill className="object-cover" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 px-4 py-3 border-t-2 border-gray-200">
        <button
          onClick={() => onLike(post.id)}
          className={`flex items-center gap-2 font-label text-sm transition-colors ${isLiked ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}
        >
          <Heart className={`w-5 h-5 ${isLiked ? 'fill-primary' : ''}`} />
          <span>{post.likes.length}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 font-label text-sm text-gray-500 hover:text-secondary transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          <span>{post.comentarios.length}</span>
        </button>
        <button className="flex items-center gap-2 font-label text-sm text-gray-500 hover:text-secondary transition-colors">
          <Share2 className="w-5 h-5" />
        </button>
        <button className="flex items-center gap-2 font-label text-sm text-gray-500 hover:text-red-dark transition-colors ml-auto">
          <Flag className="w-5 h-5" />
        </button>
      </div>

      {showComments && (
        <div className="border-t-2 border-gray-200 bg-gray-50 p-4">
          {post.comentarios.map((comment) => (
            <div key={comment.id} className="flex gap-3 mb-4 last:mb-0">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <div className="bg-white p-3 border-2 border-gray-200">
                  <span className="font-label font-bold text-xs text-secondary">{comment.autor_username}</span>
                  <p className="font-body text-sm text-gray-700">{comment.contenido}</p>
                </div>
                <span className="font-label text-xs text-gray-400 mt-1 block">{formatDate(comment.created_at)}</span>
              </div>
            </div>
          ))}

          {isAuthenticated && (
            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="font-label font-bold text-xs text-white">{user?.username?.charAt(0) || 'U'}</span>
              </div>
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribe un comentario..."
                  className="flex-1 font-body text-sm px-3 py-2 border-2 border-gray-200 focus:border-primary outline-none"
                />
                <button
                  onClick={handleComment}
                  disabled={isCommenting || !newComment.trim()}
                  className="px-4 bg-primary text-white border-2 border-secondary hover:bg-red-dark transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CreatePostForm({ onPublish }: { onPublish: (content: string, file: File | null) => Promise<void> }) {
  const { user, isAuthenticated } = useAuthStore()
  const [content, setContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)

  const handlePublish = async () => {
    const text = content.trim()
    if (!text || isPublishing) return
    setIsPublishing(true)
    try {
      await onPublish(text, selectedFile)
      setContent('')
      setSelectedFile(null)
    } finally {
      setIsPublishing(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-white border-3 border-secondary shadow-comic-sm p-6 mb-8 text-center">
        <p className="font-body text-gray-500 mb-4">Inicia sesion para publicar en el foro</p>
        <a href="/login" className="inline-block font-label font-bold text-sm text-white bg-primary px-6 py-2 border-2 border-secondary shadow-comic-sm transition-all hover:bg-red-dark">
          INICIAR SESION
        </a>
      </div>
    )
  }

  return (
    <div className="bg-white border-3 border-secondary shadow-comic-sm p-6 mb-8">
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-full border-3 border-secondary overflow-hidden bg-primary flex items-center justify-center flex-shrink-0">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-lg text-white">{user?.username?.charAt(0) || 'U'}</span>
          )}
        </div>
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Comparte tu experiencia de entrenamiento..."
            className="w-full font-body text-gray-700 p-3 border-2 border-gray-200 focus:border-primary outline-none resize-none"
            rows={3}
          />
          <div className="flex items-center justify-between mt-3">
            <label className="flex items-center gap-2 font-label text-sm text-gray-500 hover:text-primary transition-colors cursor-pointer">
              <ImageIcon className="w-5 h-5" />
              <span>{selectedFile ? selectedFile.name : 'Agregar imagen'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              onClick={handlePublish}
              disabled={!content.trim() || isPublishing}
              className="font-label font-bold text-sm text-white bg-primary px-6 py-2 border-2 border-secondary shadow-comic-sm transition-all hover:bg-red-dark hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_var(--navy)] disabled:opacity-50"
            >
              {isPublishing ? 'PUBLICANDO...' : 'PUBLICAR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ForoPage() {
  const { user } = useAuthStore()
  const [posts, setPosts] = useState<ForumPost[]>([])

  useEffect(() => {
    const postsRef = collection(db, 'posts')
    const postsQuery = query(postsRef, orderBy('created_at', 'desc'))
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const data: ForumPost[] = snapshot.docs.map((docItem) => {
        const raw = docItem.data() as any
        return {
          id: docItem.id,
          autor_id: raw.autor_id,
          autor_username: raw.autor_username,
          autor_avatar: raw.autor_avatar || '',
          contenido: raw.contenido || '',
          imagen_url: raw.imagen_url || null,
          likes: Array.isArray(raw.likes) ? raw.likes : [],
          comentarios: Array.isArray(raw.comentarios)
            ? raw.comentarios.map((c: any) => ({
                id: c.id,
                autor_username: c.autor_username,
                contenido: c.contenido,
                created_at: c.created_at?.toDate ? c.created_at.toDate() : new Date(),
              }))
            : [],
          created_at: raw.created_at?.toDate ? raw.created_at.toDate() : new Date(),
        }
      })
      setPosts(data)
    })

    return () => unsubscribe()
  }, [])

  const handleLike = async (postId: string) => {
    if (!user?.uid) return
    const post = posts.find((p) => p.id === postId)
    if (!post) return

    const postRef = doc(db, 'posts', postId)
    const hasLiked = post.likes.includes(user.uid)
    await updateDoc(postRef, {
      likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
    })
  }

  const handlePublish = async (content: string, file: File | null) => {
    if (!user?.uid) return

    let imageUrl: string | null = null
    if (file) {
      const extension = file.name.split('.').pop() || 'jpg'
      const fileRef = ref(storage, `posts/${user.uid}/${Date.now()}.${extension}`)
      await uploadBytes(fileRef, file)
      imageUrl = await getDownloadURL(fileRef)
    }

    await addDoc(collection(db, 'posts'), {
      autor_id: user.uid,
      autor_username: user.username,
      autor_avatar: user.photoURL || '',
      contenido: content,
      imagen_url: imageUrl,
      likes: [],
      comentarios: [],
      created_at: serverTimestamp(),
    })
  }

  const handleAddComment = async (postId: string, content: string) => {
    if (!user?.uid) return
    const postRef = doc(db, 'posts', postId)
    await updateDoc(postRef, {
      comentarios: arrayUnion({
        id: `${user.uid}-${Date.now()}`,
        autor_username: user.username,
        contenido: content,
        created_at: new Date(),
      }),
    })
  }

  return (
    <main>
      <Topbar />

      <section className="mt-[72px] min-h-screen bg-muted py-16">
        <div className="max-w-[900px] mx-auto px-8">
          <SectionHeader label="COMUNIDAD FITMANIA" title="NUESTRO" titleAccent="FORO" />
          <NewsSlider />
          <CreatePostForm onPublish={handlePublish} />
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onLike={handleLike} onAddComment={handleAddComment} />
          ))}
        </div>
      </section>

      <Footer />
    </main>
  )
}
