'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Flag, Megaphone, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

/** Comunidad: noticias del foro (F3-16) y moderación de reportes (F3-17). */

interface NewsItem {
  id: string;
  titulo: string;
  descripcion: string;
  imagen_url: string | null;
  published: boolean;
  publishAt: string | null;
}

interface ReportGroup {
  postId: string;
  autor: string;
  motivos: string[];
  reportantes: string[];
  count: number;
  exists: boolean;
  contenido: string | null;
  imagen_url: string | null;
}

const card = 'bg-white border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0_0_rgba(0,0,0,1)]';
const input = 'w-full border-2 border-black rounded-xl px-3 py-2 font-bold text-sm';

export function CommunityTab() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [reports, setReports] = useState<ReportGroup[]>([]);
  const [form, setForm] = useState({ titulo: '', descripcion: '', imagen_url: '', publishAt: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    fetch('/api/admin/news').then((r) => (r.ok ? r.json() : [])).then(setNews).catch(() => setNews([]));
    fetch('/api/admin/reports').then((r) => (r.ok ? r.json() : [])).then(setReports).catch(() => setReports([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const call = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Operación fallida');
    return data;
  };

  const createNews = async (publish: boolean) => {
    if (!form.titulo.trim()) return toast.error('El título es obligatorio.');
    setSaving(true);
    try {
      await call('/api/admin/news', 'POST', {
        titulo: form.titulo,
        descripcion: form.descripcion,
        imagen_url: form.imagen_url,
        published: publish,
        publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
      });
      toast.success(publish ? 'Noticia publicada.' : 'Borrador guardado.');
      setForm({ titulo: '', descripcion: '', imagen_url: '', publishAt: '' });
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (n: NewsItem) => {
    try {
      await call('/api/admin/news', 'PATCH', { id: n.id, published: !n.published });
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteNews = async (n: NewsItem) => {
    if (!confirm(`¿Eliminar la noticia "${n.titulo}"?`)) return;
    try {
      await call(`/api/admin/news?id=${encodeURIComponent(n.id)}`, 'DELETE');
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resolveReport = async (r: ReportGroup, action: 'dismiss' | 'remove_post') => {
    if (action === 'remove_post' && !confirm('¿Eliminar la publicación y sus comentarios? No se puede deshacer.')) return;
    try {
      await call('/api/admin/reports', 'POST', { postId: r.postId, action });
      toast.success(action === 'remove_post' ? 'Publicación eliminada.' : 'Reportes descartados.');
      setReports((prev) => prev.filter((x) => x.postId !== r.postId));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className={card}>
        <h3 className="font-black uppercase italic text-xl mb-4 flex items-center gap-2"><Flag className="w-5 h-5 text-red-600" /> Reportes pendientes ({reports.length})</h3>
        {reports.length === 0 ? (
          <p className="text-sm font-bold text-green-700 uppercase">No hay reportes pendientes.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.postId} className="border-2 border-black rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-red-600 text-white">{r.count} reporte{r.count === 1 ? '' : 's'}</span>
                  <span className="text-xs font-bold">Autor: {r.autor || '—'}</span>
                  <span className="text-[11px] font-bold text-zinc-500">Motivos: {r.motivos.join(', ') || '—'}</span>
                </div>
                {r.exists ? (
                  <p className="text-sm bg-zinc-50 border border-zinc-200 rounded p-2 whitespace-pre-wrap break-words">{r.contenido || '(sin texto)'}</p>
                ) : (
                  <p className="text-xs font-bold text-zinc-400">La publicación ya no existe.</p>
                )}
                {r.imagen_url && <a href={r.imagen_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold underline">Ver archivo adjunto</a>}
                <div className="flex gap-2 mt-3">
                  {r.exists && (
                    <button onClick={() => resolveReport(r, 'remove_post')} className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white border-2 border-black rounded-lg font-black uppercase text-[10px]">
                      <Trash2 className="w-3 h-3" /> Eliminar publicación
                    </button>
                  )}
                  <button onClick={() => resolveReport(r, 'dismiss')} className="px-3 py-2 bg-white border-2 border-black rounded-lg font-black uppercase text-[10px]">
                    Descartar reportes
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={card}>
        <h3 className="font-black uppercase italic text-xl mb-4 flex items-center gap-2"><Megaphone className="w-5 h-5" /> Noticias del foro</h3>
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <input className={input} placeholder="Título (máx. 100)" maxLength={100} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          <input className={input} placeholder="URL de imagen (https://… o /Imagenes/…)" value={form.imagen_url} onChange={(e) => setForm({ ...form, imagen_url: e.target.value })} />
          <textarea className={`${input} md:col-span-2`} rows={2} placeholder="Descripción (máx. 500)" maxLength={500} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          <label className="text-[10px] font-black uppercase">Programar publicación (opcional)
            <input type="datetime-local" className={input} value={form.publishAt} onChange={(e) => setForm({ ...form, publishAt: e.target.value })} />
          </label>
        </div>
        <div className="flex gap-2 mb-6">
          <button disabled={saving} onClick={() => createNews(true)} className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white border-4 border-black rounded-xl font-black uppercase text-xs disabled:opacity-50">
            <Plus className="w-4 h-4" /> Publicar
          </button>
          <button disabled={saving} onClick={() => createNews(false)} className="px-4 py-2 bg-white border-4 border-black rounded-xl font-black uppercase text-xs disabled:opacity-50">
            Guardar borrador
          </button>
        </div>

        <div className="space-y-2">
          {news.map((n) => (
            <div key={n.id} className="flex flex-wrap items-center gap-3 border-2 border-black rounded-xl p-3">
              <div className="flex-1 min-w-[200px]">
                <p className="font-black text-sm">{n.titulo}</p>
                <p className="text-[11px] font-bold text-zinc-500 line-clamp-1">{n.descripcion}</p>
                {n.publishAt && <p className="text-[10px] font-bold text-zinc-400">Programada: {new Date(n.publishAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>}
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border-2 ${n.published ? 'border-green-600 text-green-700' : 'border-zinc-400 text-zinc-500'}`}>
                {n.published ? 'Publicada' : 'Borrador'}
              </span>
              <button onClick={() => togglePublish(n)} title={n.published ? 'Despublicar' : 'Publicar'} className="p-2 border-2 border-black rounded-lg bg-white">
                {n.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button onClick={() => deleteNews(n)} title="Eliminar" className="p-2 border-2 border-black rounded-lg bg-white">
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          ))}
          {news.length === 0 && <p className="text-sm font-bold text-zinc-400">Aún no hay noticias. El foro muestra las de respaldo.</p>}
        </div>
      </div>
    </div>
  );
}
