'use client';

import { useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Users, Send, X, Mail } from 'lucide-react';

// F3-21: pestaña "PQRS" extraída de app/fitministration/page.tsx (sin cambios de lógica).
export function PqrsTab({ pqrsList, setPqrsList }: {
  pqrsList: any[];
  setPqrsList: (list: any[]) => void;
}) {
  const [isReplying, setIsReplying] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');

  const handleReplyPqrs = async (pqrs: any) => {
    if (!replyMessage) return;
    const res = await fetch('/api/admin/pqrs/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pqrsId: pqrs.id,
        userEmail: pqrs.userEmail,
        userName: pqrs.userName,
        originalMessage: pqrs.mensaje,
        responseMessage: replyMessage
      })
    });
    if (res.ok) {
      toast.success("Respuesta enviada por Gmail");
      setIsReplying(null);
      setReplyMessage('');
      setPqrsList(pqrsList.map(p => p.id === pqrs.id ? { ...p, estado: 'resuelto' } : p));
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-top-4 duration-500">
      <div className="bg-white p-8 border-4 border-black rounded-[2rem] shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-red-600 mb-2">Buzón de Atención (PQRS)</h2>
        <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Escucha y responde a los integrantes de la comunidad</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {pqrsList.map(pqrs => (
          <div key={pqrs.id} className={`bg-white border-4 border-black rounded-2xl shadow-[8px_8px_0_0_rgba(0,0,0,1)] transition-all ${pqrs.estado === 'resuelto' ? 'opacity-60 bg-zinc-50 shadow-none grayscale' : 'hover:-translate-y-1'}`}>
            <div className="p-6 flex gap-4">
              <div className="w-16 h-16 bg-zinc-100 rounded-full border-3 border-black flex-shrink-0 overflow-hidden relative shadow-[3px_3px_0_0_rgba(0,0,0,1)]">
                {pqrs.avatar || pqrs.photoURL ? (
                  <Image src={pqrs.avatar || pqrs.photoURL} alt="User" fill className="object-cover" />
                ) : (
                  <Users className="p-4 text-zinc-300 w-full h-full" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-black uppercase text-sm">{pqrs.userName || 'Usuario'}</h4>
                    <p className="text-[10px] text-zinc-400 font-bold">{pqrs.userEmail}</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 border-2 border-black rounded ${pqrs.estado === 'resuelto' ? 'bg-green-400' : 'bg-yellow-400'}`}>
                    {pqrs.estado === 'resuelto' ? 'Resuelto' : 'Pendiente'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 font-bold mb-4 uppercase tracking-tighter italic">{pqrs.tipo} - {pqrs.fecha} {pqrs.hora}</p>
                <p className="text-sm font-medium text-zinc-800 bg-zinc-50 p-4 border-2 border-dashed border-zinc-200 rounded-xl mb-4 leading-relaxed">"{pqrs.mensaje}"</p>

                {pqrs.estado !== 'resuelto' ? (
                  isReplying === pqrs.id ? (
                    <div className="space-y-3 bg-red-50 p-4 border-2 border-black rounded-xl">
                      <textarea
                        placeholder="Escribe tu respuesta aquí..."
                        className="w-full bg-white border-2 border-black p-3 rounded-lg outline-none text-sm font-medium focus:ring-4 focus:ring-red-500/10 min-h-[100px] resize-none"
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleReplyPqrs(pqrs)} className="flex-1 bg-black text-white py-3 rounded-lg font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-zinc-800"><Send className="w-3 h-3" /> Enviar Respuesta</button>
                        <button onClick={() => setIsReplying(null)} className="p-3 bg-white border-2 border-black rounded-lg hover:bg-zinc-100"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setIsReplying(pqrs.id)} className="w-full py-4 border-2 border-black rounded-xl font-black text-[10px] uppercase hover:bg-zinc-900 hover:text-white transition-all shadow-[4px_4px_0_0_rgba(0,0,0,1)] active:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"><Mail className="w-4 h-4 inline mr-2" /> Responder via Gmail</button>
                  )
                ) : (
                  <div className="bg-green-50 p-4 border-2 border-green-200 rounded-xl">
                    <p className="text-[10px] font-black text-green-700 uppercase mb-2">✓ Respuesta enviada:</p>
                    <p className="text-xs text-green-800 font-medium italic">"{pqrs.respuesta_admin}"</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {pqrsList.length === 0 && <div className="col-span-2 text-center py-20 bg-white border-4 border-black border-dashed rounded-[2rem] text-zinc-300 font-black italic text-2xl uppercase opacity-20">No hay tickets de atención aún</div>}
      </div>
    </div>
  );
}
