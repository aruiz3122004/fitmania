import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * GET /api/public/news — noticias publicadas para el foro (F3-16).
 * Solo las `published` con `publishAt` ya cumplido. Cache de CDN de 60 s.
 */
export async function GET() {
  try {
    const now = new Date();
    const snap = await getAdminFirestore().collection('news').where('published', '==', true).get();
    const news = snap.docs
      .map((doc) => ({ id: doc.id, d: doc.data() }))
      .filter(({ d }) => {
        const at = d.publishAt?.toDate ? d.publishAt.toDate() : null;
        return !at || at <= now;
      })
      .sort((a, b) => {
        const ta = a.d.publishAt?.toMillis?.() ?? a.d.createdAt?.toMillis?.() ?? 0;
        const tb = b.d.publishAt?.toMillis?.() ?? b.d.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      })
      .slice(0, 10)
      .map(({ id, d }) => ({
        id,
        titulo: d.titulo,
        descripcion: d.descripcion,
        imagen: d.imagen_url || null,
      }));

    return NextResponse.json(news, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('[/api/public/news]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
