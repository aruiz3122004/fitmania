import type { Firestore } from 'firebase-admin/firestore';
import { getClientIp } from '@/lib/client-ip';
import { LEGAL_VERSION } from '@/lib/legal';

/**
 * Prueba de autorización del titular (F3-10, Ley 1581 art. 9 y Decreto 1377).
 * `consents/{uid}_{tipo}` guarda el estado vigente y su subcolección `history`
 * cada otorgamiento o revocación con versión del texto, IP y navegador.
 */
export type ConsentType = 'terms' | 'privacy' | 'sensitive_data';

export async function recordConsent(
  db: Firestore,
  uid: string,
  type: ConsentType,
  granted: boolean,
  request: Request
) {
  const entry = {
    uid,
    type,
    granted,
    version: LEGAL_VERSION,
    ip: getClientIp(request.headers),
    userAgent: (request.headers.get('user-agent') || '').slice(0, 300),
    createdAt: new Date(),
  };
  const ref = db.collection('consents').doc(`${uid}_${type}`);
  await Promise.all([ref.set(entry), ref.collection('history').add(entry)]);
}

export async function getConsent(db: Firestore, uid: string, type: ConsentType): Promise<boolean> {
  const snap = await db.collection('consents').doc(`${uid}_${type}`).get();
  return snap.exists && snap.data()?.granted === true;
}
