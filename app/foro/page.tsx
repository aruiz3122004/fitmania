'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { SectionHeader } from '@/components/ui/section-header'
import { EmailVerificationBanner } from '@/components/auth/email-verification-banner'
import { useAuthorAvatars } from '@/lib/author-profiles'
import { useAuthStore } from '@/lib/store'
import { FitAvatar } from '@/components/ui/fit-avatar'
import { PostSkeleton } from '@/components/ui/comic-skeleton'
import { planTier, PLAN_TIERS, type PlanTier } from '@/lib/plan-theme'
import { checkForumRate, formatCountdown, remainingForumPosts, FORUM_BURST, type ForumRate } from '@/lib/forum-rate'
import { auth, db } from '@/lib/firebase'
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
  deleteDoc,
  where,
  limit,
  writeBatch,
  getCountFromServer,
  getDocs,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData
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
  Video,
  Trash2,
  Pencil,
  Check,
  X,
  Clock,
} from 'lucide-react'

type ForumComment = {
  id: string
  autor_id: string
  autor_username: string
  autor_avatar?: string
  autor_is_premium?: boolean
  autor_plan_tier?: string | null
  contenido: string
  created_at: Date
  /** Comentario antiguo guardado en el array `comentarios` del post (antes de F1-07). */
  legacy?: boolean
}

type ForumPost = {
  id: string
  autor_id: string
  autor_username: string
  autor_avatar: string
  autor_is_premium?: boolean
  autor_plan_tier?: string | null
  contenido: string
  imagen_url: string | null
  tipo_recurso?: 'image' | 'video'
  likes: string[]
  comentarios: ForumComment[]
  created_at: Date
}

type Noticia = { id: string; imagen: string | null; titulo: string; descripcion: string }

// F3-16: las noticias se administran desde el panel (colección `news`). Estas se
// muestran solo si todavía no hay ninguna publicada.

// Marco del autor en el foro: el guardado en el post o, para posts antiguos propios, el del plan actual.
function authorTier(stored: unknown, ownPlan?: { planId?: string | null; nombre?: string | null } | null): PlanTier {
  if (typeof stored === 'string' && (PLAN_TIERS as string[]).includes(stored)) return stored as PlanTier
  return ownPlan ? planTier(ownPlan) : 'estandar'
}

const NOTICIAS_RESPALDO: Noticia[] = [
  {
    id: 'respaldo-1',
    imagen: '/Imagenes/Fitmania%20Gym.jpeg',
    titulo: 'Bienvenido a FITMANIA',
    descripcion: 'Entrena con los mejores equipos y entrenadores de Barranquilla.',
  },
  {
    id: 'respaldo-2',
    imagen: '/Imagenes/Tienda%20Fitmania.jpeg',
    titulo: 'Visita nuestra tienda',
    descripcion: 'Suplementos, snacks saludables y ropa deportiva para tu rutina.',
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
  const [noticias, setNoticias] = useState<Noticia[]>(NOTICIAS_RESPALDO)

  useEffect(() => {
    fetch('/api/public/news')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setNoticias(data)
          setCurrent(0)
        }
      })
      .catch(() => {})
  }, [])

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
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: noticia.imagen ? `url(${noticia.imagen})` : undefined, backgroundColor: '#1a1a2e' }} />
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
  onDeletePost,
  onDeleteComment,
  onEditComment,
  onEditPost,
}: {
  post: ForumPost
  onLike: (id: string) => void
  onAddComment: (id: string, content: string) => Promise<void>
  onDeletePost: (id: string) => Promise<void>
  onDeleteComment: (postId: string, commentId: string) => Promise<void>
  onEditComment: (postId: string, commentId: string, newContent: string) => Promise<void>
  onEditPost: (postId: string, newContent: string) => Promise<void>
}) {
  const { user, isAuthenticated } = useAuthStore()
  const [showComments, setShowComments] = useState(false)
  // F1-07: los comentarios viven en posts/{id}/comments (cada autor edita/borra los suyos).
  // Los antiguos del array embebido se siguen mostrando hasta migrarlos.
  const [subComments, setSubComments] = useState<ForumComment[]>([])
  const [subCount, setSubCount] = useState<number | null>(null)

  useEffect(() => {
    // Conteo barato (agregación) sin descargar los comentarios.
    getCountFromServer(collection(db, 'posts', post.id, 'comments'))
      .then((snap) => setSubCount(snap.data().count))
      .catch(() => setSubCount(0))
  }, [post.id])

  useEffect(() => {
    if (!showComments) return
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('created_at', 'asc'), limit(200))
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const c = d.data() as any
        return {
          id: d.id,
          autor_id: c.autor_id || '',
          autor_username: c.autor_username,
          autor_avatar: c.autor_avatar || '',
          autor_is_premium: !!c.autor_is_premium,
          autor_plan_tier: c.autor_plan_tier ?? null,
          contenido: c.contenido || '',
          created_at: c.created_at?.toDate ? c.created_at.toDate() : new Date(),
        }
      })
      setSubComments(list)
      setSubCount(list.length)
    })
  }, [showComments, post.id])

  const allComments: ForumComment[] = [...post.comentarios.map((c) => ({ ...c, legacy: true })), ...subComments]
  // F1-09: foto actual de cada autor (perfil público); si no hay, la guardada en el post.
  const authorAvatars = useAuthorAvatars([post.autor_id, ...allComments.map((c) => c.autor_id)])
  const commentCount = post.comentarios.length + (subCount ?? 0)
  const [newComment, setNewComment] = useState('')
  const [isCommenting, setIsCommenting] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportStatus, setReportStatus] = useState<'idle' | 'success'>('idle')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [isUpdatingComment, setIsUpdatingComment] = useState(false)
  const [isEditingPost, setIsEditingPost] = useState(false)
  const [editingPostContent, setEditingPostContent] = useState('')
  const [isUpdatingPost, setIsUpdatingPost] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [commentToDelete, setCommentToDelete] = useState<{ postId: string; commentId: string } | null>(null)
  const [authRequiredMsg, setAuthRequiredMsg] = useState<{ title: string; message: string } | null>(null)

  const reportOptions = ['Terrorismo', 'Discurso de odio', 'Racismo', 'Desnudos', 'Otro']
  const isLiked = user ? post.likes.includes(user.uid) : false
  const isAuthor = user?.uid === post.autor_id

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
      // El servidor registra el reporte (datos del post y del socio, sin duplicados).
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('sin sesión')
      const res = await fetch('/api/forum/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ postId: post.id, motivo: reportReason }),
      })
      if (!res.ok) throw new Error('reporte')

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
    } catch (err: any) {
      alert(
        err?.code === 'permission-denied'
          ? 'No se pudo comentar. Verifica tu correo (revisa tu bandeja o reenvía el enlace desde tu perfil).'
          : 'No se pudo enviar el comentario. Intenta de nuevo.'
      )
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
              src={authorAvatars[post.autor_id] || post.autor_avatar || null}
              alt={post.autor_username}
              size={48}
              borderWidth="border-3"
              borderColor="border-secondary"
              bgColor="bg-primary"
              isPremium={isPostPremium}
              tier={authorTier(post.autor_plan_tier, user?.uid === post.autor_id ? user?.plan : null)}
              fallback={<UserCircle className="w-8 h-8 text-gray-400" />}
            />
          )
        })()}
        <div className="flex-1 min-w-0">
          <h4 className="font-label font-bold text-sm text-secondary truncate">{post.autor_username}</h4>
          <span className="font-label text-xs text-gray-400">{formatDate(post.created_at)}</span>
        </div>
        {isAuthor && (
          <div className="flex gap-1">
            {!isEditingPost && (
              <button 
                onClick={() => {
                  setIsEditingPost(true)
                  setEditingPostContent(post.contenido)
                }}
                className="p-2 text-gray-400 hover:text-secondary transition-colors"
                title="Editar publicación"
              >
                <Pencil className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-gray-400 hover:text-primary transition-colors"
              title="Eliminar publicación"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <div className="p-4">
        {isEditingPost ? (
          <div className="mb-4">
            <textarea
              value={editingPostContent}
              onChange={(e) => setEditingPostContent(e.target.value)}
              className="w-full font-body text-gray-700 p-3 border-3 border-secondary outline-none focus:border-primary resize-none shadow-comic-sm bg-gray-50"
              rows={4}
            />
            <div className="flex justify-end gap-3 mt-3">
              <button 
                onClick={() => setIsEditingPost(false)}
                className="px-4 py-2 border-2 border-secondary font-label font-bold text-xs hover:bg-gray-100 transition-all hover:shadow-comic-sm"
              >
                CANCELAR
              </button>
              <button 
                onClick={async () => {
                  setIsUpdatingPost(true)
                  await onEditPost(post.id, editingPostContent)
                  setIsEditingPost(false)
                  setIsUpdatingPost(false)
                }}
                disabled={isUpdatingPost || !editingPostContent.trim()}
                className="px-4 py-2 bg-primary text-white border-2 border-secondary font-label font-bold text-xs hover:bg-red-dark transition-all hover:-translate-y-0.5 hover:shadow-comic-sm disabled:opacity-50"
              >
                {isUpdatingPost ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
              </button>
            </div>
          </div>
        ) : (
          <p className="font-body text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap">{post.contenido}</p>
        )}
        {post.imagen_url && (
          <div className="relative w-full h-[400px] border-3 border-secondary overflow-hidden mb-4 bg-black flex items-center justify-center">
            {post.tipo_recurso === 'video' ? (
              <video
                src={post.imagen_url}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <Image
                src={post.imagen_url}
                alt="Post content"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 px-4 py-3 border-t-2 border-gray-200">
        <button onClick={() => {
            if (!isAuthenticated) {
              setAuthRequiredMsg({
                title: '¡ALTO AHÍ HÉROE!',
                message: 'Debes tener una cuenta para reaccionar a esta publicación.'
              })
              return
            }
            onLike(post.id)
          }}
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
          <span>{commentCount}</span>
        </button>
        <button onClick={handleShare} className="flex items-center gap-2 font-label text-sm text-gray-500 hover:text-secondary transition-colors">
          <Share2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            if (!isAuthenticated) {
              setAuthRequiredMsg({
                title: 'ACCESO RESTRINGIDO',
                message: 'Debes iniciar sesión para reportar una publicación.'
              })
              return
            }
            setShowReport(true)
          }}
          className="flex items-center gap-2 font-label text-sm text-gray-500 hover:text-red-dark transition-colors ml-auto"
        >
          <Flag className="w-5 h-5" />
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white border-4 border-secondary p-8 w-full max-w-sm shadow-comic relative overflow-hidden text-center sm:text-left">
            {/* Superhero style decoration */}
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary border-4 border-secondary rotate-45" />
            <div className="absolute -left-4 -bottom-4 w-12 h-12 bg-accent border-4 border-secondary rotate-12" />
            
            <div className="relative">
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary rounded-full border-3 border-secondary flex items-center justify-center text-white shadow-comic-sm shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="font-display text-2xl text-secondary tracking-tighter italic font-black uppercase">
                  ¿BORRAR POST?
                </h3>
              </div>
              
              <p className="font-body text-gray-600 mb-8 leading-tight">
                ¡Atención! Estás a punto de eliminar esta publicación para siempre. ¿Deseas proceder?
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 border-3 border-secondary font-label font-bold text-sm tracking-wider hover:bg-gray-100 transition-all hover:-translate-y-1 active:translate-y-0 hover:shadow-comic-sm"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={async () => {
                    await onDeletePost(post.id)
                    setShowDeleteConfirm(false)
                  }}
                  className="flex-1 py-3 bg-primary text-white border-3 border-secondary font-label font-bold text-sm tracking-wider hover:bg-red-dark transition-all hover:-translate-y-1 active:translate-y-0 hover:shadow-comic-sm"
                >
                  ¡ELIMINAR!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {commentToDelete && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[101] flex items-center justify-center p-4">
          <div className="bg-white border-4 border-secondary p-8 w-full max-w-sm shadow-comic relative overflow-hidden text-center sm:text-left">
            {/* Superhero style decoration */}
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary border-4 border-secondary rotate-45" />
            <div className="absolute -left-4 -bottom-4 w-12 h-12 bg-accent border-4 border-secondary rotate-12" />
            
            <div className="relative">
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary rounded-full border-3 border-secondary flex items-center justify-center text-white shadow-comic-sm shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="font-display text-2xl text-secondary tracking-tighter italic font-black uppercase">
                  ¿BORRAR COMENTARIO?
                </h3>
              </div>
              
              <p className="font-body text-gray-600 mb-8 leading-tight">
                ¡Cuidado héroe! ¿Estás seguro de que quieres eliminar este comentario? Esta acción no se puede deshacer.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setCommentToDelete(null)}
                  className="flex-1 py-3 border-3 border-secondary font-label font-bold text-sm tracking-wider hover:bg-gray-100 transition-all hover:-translate-y-1 active:translate-y-0 hover:shadow-comic-sm"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={async () => {
                    await onDeleteComment(commentToDelete.postId, commentToDelete.commentId)
                    setCommentToDelete(null)
                  }}
                  className="flex-1 py-3 bg-primary text-white border-3 border-secondary font-label font-bold text-sm tracking-wider hover:bg-red-dark transition-all hover:-translate-y-1 active:translate-y-0 hover:shadow-comic-sm"
                >
                  ¡ELIMINAR!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
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

      {authRequiredMsg && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white border-4 border-secondary p-8 w-full max-w-sm shadow-comic relative overflow-hidden text-center sm:text-left">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary border-4 border-secondary rotate-45" />
            <div className="absolute -left-4 -bottom-4 w-12 h-12 bg-accent border-4 border-secondary rotate-12" />
            
            <div className="relative">
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary rounded-full border-3 border-secondary flex items-center justify-center text-white shadow-comic-sm shrink-0">
                  <UserCircle className="w-6 h-6" />
                </div>
                <h3 className="font-display text-xl text-secondary tracking-tighter italic font-black uppercase">
                  {authRequiredMsg.title}
                </h3>
              </div>
              
              <p className="font-body text-gray-600 mb-8 leading-tight">
                {authRequiredMsg.message}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setAuthRequiredMsg(null)}
                  className="flex-1 py-3 border-3 border-secondary font-label font-bold text-sm tracking-wider hover:bg-gray-100 transition-all hover:-translate-y-1 active:translate-y-0 hover:shadow-comic-sm"
                >
                  ENTENDIDO
                </button>
                <a 
                  href="/login"
                  className="flex-1 py-3 bg-primary text-white border-3 border-secondary text-center font-label font-bold text-sm tracking-wider hover:bg-red-dark transition-all hover:-translate-y-1 active:translate-y-0 hover:shadow-comic-sm"
                >
                  INICIAR SESIÓN
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {showComments && (
        <div className="border-t-2 border-gray-200 bg-gray-50 p-4">
          {allComments.map((comment) => {
            // If the comment doesn't have a stored avatar, fall back to the current user's photo (for old comments)
            const commentAvatar = authorAvatars[comment.autor_id] || comment.autor_avatar || (user?.username === comment.autor_username ? user?.photoURL : null) || null
            // Premium detection: use stored value, but also check if comment is from current premium user (for old comments without the field)
            const currentUserIsPremium = !!(user?.plan && new Date(user.plan.expira) > new Date())
            const isCommentPremium = comment.autor_is_premium || (user?.username === comment.autor_username && currentUserIsPremium)
            const isCommentAuthor = user?.uid === comment.autor_id
            const canDeleteComment = comment.legacy ? isAuthor : (isCommentAuthor || isAuthor)
            const canEditComment = isCommentAuthor && (!comment.legacy || isAuthor)
            const isEditing = editingCommentId === comment.id

            return (
              <div key={comment.id} className="flex gap-3 mb-4 last:mb-0">
                <FitAvatar
                  src={commentAvatar}
                  alt={comment.autor_username}
                  size={34}
                  borderColor="border-secondary"
                  bgColor="bg-primary"
                  isPremium={isCommentPremium}
                  tier={authorTier(comment.autor_plan_tier, isCommentAuthor ? user?.plan : null)}
                  fallback={
                    <span className="font-label font-bold text-xs text-white">
                      {comment.autor_username?.charAt(0) || 'U'}
                    </span>
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="bg-white p-3 border-2 border-gray-200 relative group">
                    <span className="font-label font-bold text-xs text-secondary">{comment.autor_username}</span>
                    {isEditing ? (
                      <div className="mt-2">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full font-body text-sm p-2 border-2 border-gray-200 outline-none focus:border-primary resize-none"
                          rows={2}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => setEditingCommentId(null)}
                            className="p-1 text-gray-400 hover:text-secondary"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              setIsUpdatingComment(true)
                              await onEditComment(post.id, comment.id, editingContent)
                              setEditingCommentId(null)
                              setIsUpdatingComment(false)
                            }}
                            disabled={isUpdatingComment || !editingContent.trim()}
                            className="p-1 text-primary hover:text-red-dark disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="font-body text-sm text-gray-700 break-words overflow-hidden [overflow-wrap:anywhere]">{comment.contenido}</p>
                    )}

                    {/* Management Buttons */}
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      {canEditComment && !isEditing && (
                        <button
                          onClick={() => {
                            setEditingCommentId(comment.id)
                            setEditingContent(comment.contenido)
                          }}
                          className="p-1 text-gray-400 hover:text-secondary"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteComment && !isEditing && (
                        <button
                          onClick={() => setCommentToDelete({ postId: post.id, commentId: comment.id })}
                          className="p-1 text-gray-400 hover:text-primary transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
                tier={planTier(user?.plan)}
                fallback={
                  <span className="font-label font-bold text-xs text-white">
                    {user?.username?.charAt(0) || 'U'}
                  </span>
                }
              />
              <div className="flex-1 min-w-0 flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribe un comentario..."
                  maxLength={1000}
                  className="flex-1 min-w-0 font-body text-sm px-3 py-2 border-2 border-gray-200 focus:border-primary outline-none"
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

function CreatePostForm({ onPublish, rate }: { onPublish: (content: string, file: File | null) => Promise<void>; rate: ForumRate | null }) {
  const { user, isAuthenticated } = useAuthStore()
  const [content, setContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const rateCheck = checkForumRate(rate, new Date(now))
  const cooldownMs = rateCheck.allowed ? 0 : rateCheck.retryAt.getTime() - now
  const remaining = remainingForumPosts(rate, new Date(now))

  // Cuenta regresiva: solo late mientras dura la pausa.
  useEffect(() => {
    if (rateCheck.allowed) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [rateCheck.allowed])

  // Cleanup object URL when component unmounts or file changes
  useEffect(() => {
    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile)
      setFilePreview(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    } else {
      setFilePreview(null)
    }
  }, [selectedFile])

  const handlePublish = async () => {
    const text = content.trim()
    if (!text || isPublishing || cooldownMs > 0) return
    setIsPublishing(true)
    setPublishError('')
    try {
      await onPublish(text, selectedFile)
      setContent('')
      setSelectedFile(null)
      setFilePreview(null)
    } catch (err: any) {
      // Las reglas exigen correo verificado, máx. 2000 caracteres (F1-06 / F1-07) y la
      // pausa antispam. Si el reloj del equipo va adelantado, la pausa puede no haber
      // terminado aún en el servidor.
      setPublishError(
        err?.code === 'permission-denied'
          ? remaining <= 1
            ? 'No se pudo publicar. Si acabas de cumplir la pausa, espera unos segundos y vuelve a intentarlo; si no, verifica tu correo.'
            : 'No se pudo publicar. Verifica tu correo (revisa tu bandeja o reenvía el enlace desde tu perfil).'
          : err?.message || 'No se pudo publicar. Intenta de nuevo.'
      )
    } finally {
      setIsPublishing(false)
      setNow(Date.now())
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
    <div className="bg-white border-3 border-secondary shadow-comic-sm p-4 sm:p-6 mb-8">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex sm:block justify-center">
          <FitAvatar
            src={user?.photoURL}
            alt="Avatar"
            size={48}
            borderWidth="border-3"
            borderColor="border-secondary"
            bgColor="bg-primary"
            isPremium={!!(user?.plan && new Date(user.plan.expira) > new Date())}
            tier={planTier(user?.plan)}
            fallback={<span className="font-display text-lg text-white">{user?.username?.charAt(0) || 'U'}</span>}
          />
        </div>
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Comparte tu experiencia de entrenamiento..."
            className="w-full font-body text-gray-700 p-3 border-2 border-gray-200 focus:border-primary outline-none resize-none"
            rows={3}
            maxLength={2000}
          />
          {publishError && cooldownMs <= 0 && (
            <p role="alert" className="mt-2 font-label text-xs font-bold text-primary">{publishError}</p>
          )}
          {cooldownMs > 0 ? (
            <div role="status" className="mt-2 flex items-start gap-2 bg-accent/20 border-2 border-secondary px-3 py-2">
              <Clock className="w-4 h-4 mt-0.5 shrink-0 text-secondary" aria-hidden />
              <p className="font-body text-xs text-secondary leading-snug">
                <span className="font-bold">¡Pausa de {formatCountdown(cooldownMs)}!</span> Publicaste {FORUM_BURST} veces seguidas.
                Así el foro se mantiene tranquilo para todos; puedes seguir comentando y reaccionando.
              </p>
            </div>
          ) : remaining < FORUM_BURST && (
            <p className="mt-1 font-body text-[0.7rem] text-gray-500">
              Te {remaining === 1 ? 'queda 1 publicación' : `quedan ${remaining} publicaciones`} antes de una pausa de 5 minutos.
            </p>
          )}
          
          {filePreview && (
            <div className="relative mt-2 inline-block">
              {selectedFile?.type.startsWith('video/') ? (
                <video src={filePreview} className="h-24 w-24 object-cover border-2 border-secondary rounded" />
              ) : (
                <img src={filePreview} alt="Preview" className="h-24 w-24 object-cover border-2 border-secondary rounded" />
              )}
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="absolute -top-2 -right-2 bg-primary text-white rounded-full p-1 border-2 border-secondary hover:bg-red-dark transition-colors"
                title="Quitar archivo"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mt-3">
            <label className="flex items-center gap-2 font-label text-sm text-gray-500 hover:text-primary transition-colors cursor-pointer min-w-0">
              {selectedFile?.type.startsWith('video/') ? (
                <Video className="w-5 h-5 text-primary shrink-0" />
              ) : (
                <ImageIcon className="w-5 h-5 shrink-0" />
              )}
              <span className="truncate max-w-[200px]">
                {selectedFile ? selectedFile.name : 'Agregar imagen o video'}
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              onClick={handlePublish}
              disabled={!content.trim() || isPublishing || cooldownMs > 0}
              className="font-label font-bold text-sm text-white bg-primary px-6 py-3 sm:py-2 border-2 border-secondary shadow-comic-sm transition-all hover:bg-red-dark hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_var(--navy)] disabled:opacity-50"
            >
              {isPublishing ? 'PUBLICANDO...' : cooldownMs > 0 ? `ESPERA ${formatCountdown(cooldownMs)}` : 'PUBLICAR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ForoPage() {
  const { user } = useAuthStore()
  // F2-22: la primera página se escucha en tiempo real; las demás se piden con cursor
  // (`startAfter`) al navegar. Páginas de 10 para no saturar la vista ni las lecturas.
  const PAGE_SIZE = 10
  const [page, setPage] = useState(0)
  const [livePosts, setLivePosts] = useState<ForumPost[]>([])
  const [liveHasMore, setLiveHasMore] = useState(false)
  const [pagePosts, setPagePosts] = useState<ForumPost[]>([])
  const [pageHasMore, setPageHasMore] = useState(false)
  const [loadingPage, setLoadingPage] = useState(false)
  const [postsLoaded, setPostsLoaded] = useState(false)
  // Último documento de cada página: cursores[i] abre la página i + 1.
  const cursorsRef = useRef<QueryDocumentSnapshot<DocumentData>[]>([])
  const listTopRef = useRef<HTMLDivElement>(null)
  const [rate, setRate] = useState<ForumRate | null>(null)
  const toForumPost = (docItem: QueryDocumentSnapshot<DocumentData>): ForumPost => {
    const raw = docItem.data() as any
    return {
      id: docItem.id,
      autor_id: raw.autor_id,
      autor_username: raw.autor_username,
      autor_avatar: raw.autor_avatar || '',
      autor_is_premium: !!raw.autor_is_premium,
      autor_plan_tier: raw.autor_plan_tier ?? null,
      contenido: raw.contenido || '',
      imagen_url: raw.imagen_url || null,
      tipo_recurso: raw.tipo_recurso || 'image',
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
  }

  const baseQuery = () => {
    // Límite de 30 días para no cargar publicaciones antiguas.
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return [collection(db, 'posts'), where('created_at', '>=', thirtyDaysAgo), orderBy('created_at', 'desc')] as const
  }

  useEffect(() => {
    const [ref, ...constraints] = baseQuery()
    // Se pide uno extra para saber si existe una página siguiente.
    const unsubscribe = onSnapshot(query(ref, ...constraints, limit(PAGE_SIZE + 1)), (snapshot) => {
      const docs = snapshot.docs.slice(0, PAGE_SIZE)
      setLivePosts(docs.map(toForumPost))
      setLiveHasMore(snapshot.docs.length > PAGE_SIZE)
      if (docs.length) cursorsRef.current[0] = docs[docs.length - 1]
      setPostsLoaded(true)
    })
    return () => unsubscribe()
  }, [])

  // Contador antispam propio (lo validan las reglas; aquí solo se muestra).
  useEffect(() => {
    if (!user?.uid) { setRate(null); return }
    return onSnapshot(doc(db, 'forum_rate', user.uid), (snap) => {
      const data = snap.data({ serverTimestamps: 'estimate' })
      setRate(data ? { count: Number(data.count) || 0, last: data.last?.toDate ? data.last.toDate() : null } : null)
    }, () => setRate(null))
  }, [user?.uid])

  const posts = page === 0 ? livePosts : pagePosts
  const hasNextPage = page === 0 ? liveHasMore : pageHasMore

  const goToPage = async (target: number) => {
    if (target < 0 || loadingPage) return
    if (target === 0) {
      setPage(0)
    } else {
      const cursor = cursorsRef.current[target - 1]
      if (!cursor) return
      setLoadingPage(true)
      try {
        const [ref, ...constraints] = baseQuery()
        const snap = await getDocs(query(ref, ...constraints, startAfter(cursor), limit(PAGE_SIZE + 1)))
        const docs = snap.docs.slice(0, PAGE_SIZE)
        if (docs.length) cursorsRef.current[target] = docs[docs.length - 1]
        setPagePosts(docs.map(toForumPost))
        setPageHasMore(snap.docs.length > PAGE_SIZE)
        setPage(target)
      } finally {
        setLoadingPage(false)
      }
    }
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleLike = async (postId: string) => {
    if (!user?.uid) return
    const post = posts.find((p) => p.id === postId)
    if (!post) return

    const postRef = doc(db, 'posts', postId)
    const hasLiked = post.likes.includes(user.uid)
    await updateDoc(postRef, {
      likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
    })
    setPagePosts((prev) => prev.map((p) => p.id !== postId ? p : {
      ...p,
      likes: hasLiked ? p.likes.filter((id) => id !== user.uid) : [...p.likes, user.uid],
    }))
  }

  const handlePublish = async (content: string, file: File | null) => {
    if (!user?.uid) return
    // Antes de subir el archivo: si está en pausa no tiene sentido gastar la subida.
    const check = checkForumRate(rate)
    if (!check.allowed) {
      throw new Error(`Ya publicaste ${FORUM_BURST} veces seguidas. Podrás volver a publicar en ${formatCountdown(check.retryAt.getTime() - Date.now())}.`)
    }

    let imageUrl: string | null = null
    let imagePublicId: string | null = null
    let resourceType: 'image' | 'video' = 'image'
    if (file) {
      const resultado = await uploadToCloudinary(file, 'forum')
      imageUrl = resultado.url
      imagePublicId = resultado.publicId
      resourceType = resultado.resourceType as 'image' | 'video'
    }

    const isPremium = !!(user?.plan && new Date(user.plan.expira) > new Date())

    // El post y el contador van en el mismo lote: las reglas rechazan uno sin el otro.
    const batch = writeBatch(db)
    batch.set(doc(collection(db, 'posts')), {
      autor_id: user.uid,
      autor_username: user.username,
      autor_avatar: user.photoURL || '',
      autor_is_premium: isPremium,
      autor_plan_tier: isPremium ? planTier(user.plan) : null,
      contenido: content,
      imagen_url: imageUrl,
      // F1-25: permite borrar el archivo en Cloudinary cuando se elimine el post.
      imagen_public_id: imagePublicId,
      tipo_recurso: resourceType,
      likes: [],
      comentarios: [],
      created_at: serverTimestamp(),
    })
    batch.set(doc(db, 'forum_rate', user.uid), { count: check.nextCount, last: serverTimestamp() })
    await batch.commit()
  }

  const handleAddComment = async (postId: string, content: string) => {
    if (!user?.uid) return
    const isPremium = !!(user?.plan && new Date(user.plan.expira) > new Date())

    // F1-07: comentario como documento propio (antes arrayUnion en el post).
    await addDoc(collection(db, 'posts', postId, 'comments'), {
      autor_id: user.uid,
      autor_username: user.username,
      autor_avatar: user.photoURL || '',
      autor_is_premium: isPremium,
      autor_plan_tier: isPremium ? planTier(user.plan) : null,
      contenido: content,
      created_at: serverTimestamp(),
    })
  }

  const handleEditPost = async (postId: string, newContent: string) => {
    if (!user?.uid) return
    const postRef = doc(db, 'posts', postId)
    await updateDoc(postRef, {
      contenido: newContent,
    })
  }

  return (
    <main>
      <Topbar />

      <section className="mt-[72px] min-h-screen bg-muted py-16">
        <div className="max-w-[900px] mx-auto px-4 sm:px-8">
          <SectionHeader label="COMUNIDAD FITMANIA" title="NUESTRO" titleAccent="FORO" />
          <EmailVerificationBanner />
          <NewsSlider />
          <CreatePostForm onPublish={handlePublish} rate={rate} />
          <div ref={listTopRef} className="scroll-mt-24" />
          {!postsLoaded && (
            <div aria-busy="true">
              <span role="status" className="sr-only">Cargando publicaciones</span>
              <PostSkeleton />
              <PostSkeleton />
            </div>
          )}
          {postsLoaded && posts.length === 0 && (
            <div className="bg-white border-3 border-dashed border-secondary p-10 text-center mb-6">
              <p className="font-display text-2xl text-secondary tracking-wider mb-2">¡EL FORO ESTÁ EN CALMA!</p>
              <p className="font-body text-sm text-gray-600">No hay publicaciones de los últimos 30 días. Sé el primero en contar cómo va tu entreno.</p>
            </div>
          )}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={handleLike}
              onAddComment={handleAddComment}
              onDeletePost={async (id: string) => {
                // F1-25: el servidor borra el post, sus comentarios y su archivo en Cloudinary.
                const idToken = await auth.currentUser?.getIdToken()
                const res = await fetch(`/api/forum/posts/${encodeURIComponent(id)}`, {
                  method: 'DELETE',
                  headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
                })
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}))
                  alert(data.error || 'No se pudo eliminar la publicación.')
                }
              }}
              onEditPost={handleEditPost}
              onDeleteComment={async (postId: string, commentId: string) => {
                // Comentario heredado (array del post): solo lo modera el autor del post.
                if (post.comentarios.some(c => c.id === commentId)) {
                  await updateDoc(doc(db, 'posts', postId), {
                    comentarios: post.comentarios.filter(c => c.id !== commentId)
                  })
                  return
                }
                await deleteDoc(doc(db, 'posts', postId, 'comments', commentId))
              }}
              onEditComment={async (postId: string, commentId: string, newContent: string) => {
                if (post.comentarios.some(c => c.id === commentId)) {
                  await updateDoc(doc(db, 'posts', postId), {
                    comentarios: post.comentarios.map(c =>
                      c.id === commentId ? { ...c, contenido: newContent } : c
                    )
                  })
                  return
                }
                await updateDoc(doc(db, 'posts', postId, 'comments', commentId), {
                  contenido: newContent,
                  edited_at: serverTimestamp(),
                })
              }}
            />
          ))}
          {postsLoaded && (page > 0 || hasNextPage) && (
            <nav aria-label="Páginas del foro" className="flex items-center justify-center gap-3 mt-10">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page === 0 || loadingPage}
                className="inline-flex items-center gap-1 font-label font-bold text-xs uppercase tracking-widest text-secondary bg-white border-2 border-secondary px-4 py-2 shadow-comic-sm transition-all hover:-translate-y-0.5 hover:text-primary disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:text-secondary"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden /> Anterior
              </button>
              <span aria-live="polite" className="font-display text-xl text-secondary tracking-wider min-w-[110px] text-center">
                {loadingPage ? 'CARGANDO…' : `PÁGINA ${page + 1}`}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={!hasNextPage || loadingPage}
                className="inline-flex items-center gap-1 font-label font-bold text-xs uppercase tracking-widest text-white bg-primary border-2 border-secondary px-4 py-2 shadow-comic-sm transition-all hover:-translate-y-0.5 hover:bg-red-dark disabled:opacity-40 disabled:hover:translate-y-0"
              >
                Siguiente <ChevronRight className="w-4 h-4" aria-hidden />
              </button>
            </nav>
          )}
          {page > 0 && (
            <p className="mt-3 text-center font-body text-xs text-gray-500">
              Las publicaciones nuevas aparecen en la <button type="button" onClick={() => goToPage(0)} className="text-primary font-bold underline">página 1</button>.
            </p>
          )}
        </div>
      </section>

      <Footer />
    </main>
  )
}
