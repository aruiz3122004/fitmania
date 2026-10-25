'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { ArrowLeft, Inbox, X } from 'lucide-react'
import { db } from '@/lib/firebase'

export interface SandboxMail {
  id: string
  subject: string
  html: string
  createdAt: Date
}

/** Correos que la app "envió" al visitante (en el sandbox no sale ninguno). */
export function useSandboxMail(email: string | null): SandboxMail[] {
  const [mails, setMails] = useState<SandboxMail[]>([])
  useEffect(() => {
    if (!email) { setMails([]); return }
    // Sin orderBy para no exigir un índice compuesto: son pocos y se ordenan aquí.
    return onSnapshot(
      query(collection(db, 'sandbox_mail'), where('to', '==', email.toLowerCase())),
      (snap) => {
        setMails(
          snap.docs
            .map((d) => {
              const raw = d.data()
              return { id: d.id, subject: String(raw.subject || ''), html: String(raw.html || ''), createdAt: raw.createdAt?.toDate?.() ?? new Date() }
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        )
      },
      () => setMails([])
    )
  }, [email])
  return mails
}

export function SandboxMailbox({ mails, onClose }: { mails: SandboxMail[]; onClose: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = mails.find((m) => m.id === openId) ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-secondary/50" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Buzón del sandbox"
        className="h-full w-full max-w-[660px] bg-white border-l-4 border-secondary flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 bg-lime-300 border-b-4 border-secondary px-4 py-3">
          {open ? (
            <button type="button" onClick={() => setOpenId(null)} aria-label="Volver a la lista" className="p-1 hover:bg-black/10">
              <ArrowLeft className="w-5 h-5 text-secondary" />
            </button>
          ) : (
            <Inbox className="w-5 h-5 text-secondary" aria-hidden />
          )}
          <h2 className="flex-1 font-display text-2xl tracking-wider text-secondary truncate">
            {open ? open.subject : 'BUZÓN DEL SANDBOX'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar buzón" className="p-1 hover:bg-black/10">
            <X className="w-5 h-5 text-secondary" />
          </button>
        </header>

        {open ? (
          // El HTML del correo va aislado: sin scripts ni acceso a la página.
          <iframe title={open.subject} sandbox="" srcDoc={open.html} className="flex-1 w-full bg-white" />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <p className="px-4 py-3 font-body text-xs text-gray-600 bg-lime-50 border-b-2 border-lime-200">
              En el sandbox ningún correo sale a internet: recibos, recordatorios y códigos de verificación llegan aquí.
            </p>
            {mails.length === 0 ? (
              <p className="p-8 text-center font-body text-sm text-gray-500">
                Aún no tienes correos. Compra un plan o activa la verificación en dos pasos para ver uno.
              </p>
            ) : (
              <ul>
                {mails.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(m.id)}
                      className="w-full text-left px-4 py-3 border-b-2 border-gray-100 hover:bg-lime-50 transition-colors"
                    >
                      <span className="block font-label font-bold text-sm text-secondary truncate">{m.subject}</span>
                      <span className="block font-body text-xs text-gray-500">
                        {m.createdAt.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
