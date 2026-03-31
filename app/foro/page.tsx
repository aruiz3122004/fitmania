'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { SectionHeader } from '@/components/ui/section-header'
import { useAuthStore } from '@/lib/store'
import { FitAvatar } from '@/components/ui/fit-avatar'
import { db } from '@/lib/firebase'
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
import { uploadToCloudinary } from '@/services/cloudinary'
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
  autor_id: string
  autor_username: string
  autor_avatar?: string
  autor_is_premium?: boolean
  contenido: string
  created_at: Date
}

type ForumPost = {
  id: string
  autor_id: string
  autor_username: string
  autor_avatar: string
  autor_is_premium?: boolean
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
    imagen: '/images/gym3.jpg',
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
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportStatus, setReportStatus] = useState<'idle' | 'success'>('idle')
  const reportOptions = ['Terrorismo', 'Discurso de odio', 'Racismo', 'Desnudos', 'Otro']
  const isLiked = user ? post.likes.includes(user.uid) : false

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Fitmania Foro',
          text: `Mira esta publicacion de ${post.autor_username}: ${post.contenido}`,
          url: window.location.href,
        })
      } catch (err) {
        console.log('Error compartiendo', err)
      }
    } else {
      alert('Tu navegador no soporta la funcion nativa de compartir.')
    }
  }

  const handleReport = async () => {
    if (!reportReason || !user) return

    try {
      await addDoc(collection(db, 'reportes'), {
        reportante: user.username,
        reportante_id: user.uid,
        publicacion_id: post.id,
        autor_publicacion: post.autor_username,
        motivo: reportReason,
        fecha_publicacion: post.created_at,
        fecha_reporte: new Date()
      })

      console.log(`Email mock a: administrador@fitmania.com\nAsunto: Reporte de publicacion\nMensaje: El usuario ${user.username} ha reportado la publicacion de ${post.autor_username} subida el ${post.created_at}. Motivo: ${reportReason}`)
      setReportStatus('success')
    } catch (err) {
      console.error('Error al guardar reporte:', err)
    }

    setTimeout(() => {
      setShowReport(false)
      setReportStatus('idle')
      setReportReason('')
    }, 3000)
  }

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
        {(() => {
          const currentUserIsPremium = !!(user?.plan && new Date(user.plan.expira) > new Date())
          const isPostPremium = post.autor_is_premium || (user?.uid === post.autor_id && currentUserIsPremium)
          return (
            <FitAvatar
              src={post.autor_avatar || null}
              alt={post.autor_username}
              size={48}
              borderWidth="border-3"
              borderColor="border-secondary"
              bgColor="bg-primary"
              isPremium={isPostPremium}
              fallback={<UserCircle className="w-8 h-8 text-gray-400" />}
            />
          )
        })()}
        <div>
          <h4 className="font-label font-bold text-sm text-secondary">{post.autor_username}</h4>
          <span className="font-label text-xs text-gray-400">{formatDate(post.created_at)}</span>
        </div>
      </div>

      <div className="p-4">
        <p className="font-body text-gray-700 leading-relaxed mb-4">{post.contenido}</p>
        {post.imagen_url && (
          <div className="relative w-full h-[400px] border-3 border-secondary overflow-hidden mb-4 bg-gray-50/50">
            <Image
              src={post.imagen_url}
              alt="Post image"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 px-4 py-3 border-t-2 border-gray-200">
        <button onClick={() => onLike(post.id)}
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
        <button onClick={handleShare} className="flex items-center gap-2 font-label text-sm text-gray-500 hover:text-secondary transition-colors">
          <Share2 className="w-5 h-5" />
        </button>
        <button 
          onClick={() => {
            if (!isAuthenticated) {
              alert('Debes iniciar sesión para reportar una publicación.')
              return
            }
            setShowReport(true)
          }} 
          className="flex items-center gap-2 font-label text-sm text-gray-500 hover:text-red-dark transition-colors ml-auto"
        >
          <Flag className="w-5 h-5" />
        </button>
      </div>

      {showReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-3 border-secondary p-6 w-full max-w-md shadow-comic">
            {reportStatus === 'success' ? (
              <div className="text-center py-4">
                <h3 className="font-display text-xl text-green-600 mb-2">¡Reporte Enviado!</h3>
                <p className="font-body text-gray-600">Gracias por denunciar, estaremos revisando su solicitud.</p>
              </div>
            ) : (
              <>
                <h3 className="font-display text-xl text-secondary mb-4 tracking-wider">REPORTAR PUBLICACION</h3>
                <p className="font-body text-sm text-gray-600 mb-4">Selecciona el motivo de tu denuncia:</p>
                <div className="flex flex-col gap-2 mb-6">
                  {reportOptions.map(opt => (
                    <label key={opt} className="flex items-center gap-2 font-label text-sm cursor-pointer hover:bg-gray-50 p-2 border-2 border-transparent hover:border-gray-200 transition-colors">
                      <input type="radio" name="report_reason" value={opt} checked={reportReason === opt} onChange={(e) => setReportReason(e.target.value)} className="accent-primary w-4 h-4" />
                      {opt}
                    </label>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowReport(false)} className="flex-1 py-2 border-2 border-secondary font-label font-bold text-sm hover:bg-gray-100 transition-all hover:-translate-y-1 hover:shadow-comic-sm">CANCELAR</button>
                  <button onClick={handleReport} disabled={!reportReason} className="flex-1 py-2 bg-primary text-white border-2 border-secondary font-label font-bold text-sm hover:bg-red-dark transition-all hover:-translate-y-1 hover:shadow-comic-sm disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none">ENVIAR</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showComments && (
        <div className="border-t-2 border-gray-200 bg-gray-50 p-4">
          {post.comentarios.map((comment) => {
            // If the comment doesn't have a stored avatar, fall back to the current user's photo (for old comments)
            const commentAvatar = comment.autor_avatar || (user?.username === comment.autor_username ? user?.photoURL : null) || null
            // Premium detection: use stored value, but also check if comment is from current premium user (for old comments without the field)
            const currentUserIsPremium = !!(user?.plan && new Date(user.plan.expira) > new Date())
            const isCommentPremium = comment.autor_is_premium || (user?.username === comment.autor_username && currentUserIsPremium)
            return (
            <div key={comment.id} className="flex gap-3 mb-4 last:mb-0">
              <FitAvatar
                src={commentAvatar}
                alt={comment.autor_username}
                size={34}
                borderColor="border-secondary"
                bgColor="bg-primary"
                isPremium={isCommentPremium}
                fallback={
                  <span className="font-label font-bold text-xs text-white">
                    {comment.autor_username?.charAt(0) || 'U'}
                  </span>
                }
              />
              <div className="flex-1">
                <div className="bg-white p-3 border-2 border-gray-200">
                  <span className="font-label font-bold text-xs text-secondary">{comment.autor_username}</span>
                  <p className="font-body text-sm text-gray-700">{comment.contenido}</p>
                </div>
                <span className="font-label text-xs text-gray-400 mt-1 block">{formatDate(comment.created_at)}</span>
              </div>
            </div>
            )
          })}

          {isAuthenticated && (
            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
              <FitAvatar
                src={user?.photoURL}
                alt={user?.username || 'Avatar'}
                size={34}
                borderColor="border-secondary"
                bgColor="bg-primary"
                isPremium={!!(user?.plan && new Date(user.plan.expira) > new Date())}
                fallback={
                  <span className="font-label font-bold text-xs text-white">
                    {user?.username?.charAt(0) || 'U'}
                  </span>
                }
              />
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
        <FitAvatar
          src={user?.photoURL}
          alt="Avatar"
          size={48}
          borderWidth="border-3"
          borderColor="border-secondary"
          bgColor="bg-primary"
          isPremium={!!(user?.plan && new Date(user.plan.expira) > new Date())}
          fallback={<span className="font-display text-lg text-white">{user?.username?.charAt(0) || 'U'}</span>}
        />
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
          autor_is_premium: !!raw.autor_is_premium,
          contenido: raw.contenido || '',
          imagen_url: raw.imagen_url || null,
          likes: Array.isArray(raw.likes) ? raw.likes : [],
          comentarios: Array.isArray(raw.comentarios)
            ? raw.comentarios.map((c: any) => ({
              id: c.id,
              autor_id: c.autor_id || '',
              autor_username: c.autor_username,
              autor_avatar: c.autor_avatar || '',
              autor_is_premium: !!c.autor_is_premium,
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
      const resultado = await uploadToCloudinary(file)
      imageUrl = resultado.url  // URL pública de Cloudinary
    }

    const isPremium = !!(user?.plan && new Date(user.plan.expira) > new Date())

    await addDoc(collection(db, 'posts'), {
      autor_id: user.uid,
      autor_username: user.username,
      autor_avatar: user.photoURL || '',
      autor_is_premium: isPremium,
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
    const isPremium = !!(user?.plan && new Date(user.plan.expira) > new Date())

    await updateDoc(postRef, {
      comentarios: arrayUnion({
        id: `${user.uid}-${Date.now()}`,
        autor_id: user.uid,
        autor_username: user.username,
        autor_avatar: user.photoURL || '',
        autor_is_premium: isPremium,
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
