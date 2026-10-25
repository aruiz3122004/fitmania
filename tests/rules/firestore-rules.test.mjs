// Pruebas de las reglas de Firestore con el emulador (hallazgo f de la auditoría).
//
//   npm run test:rules
//
// Corre contra un proyecto `demo-` del emulador: nunca toca el proyecto real.
// Requiere Java 21 (el emulador de Firestore es un .jar).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';

const AUTH_TIME = 1_760_000_000;
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-fitmania-rules',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/ana'), { username: 'ana', email: 'ana@x.co', plan: { nombre: 'Plan', expira: new Date(Date.now() + 86_400_000) } });
    await setDoc(doc(db, 'users/beto'), { username: 'beto', email: 'beto@x.co', plan: null });
    await setDoc(doc(db, 'orders/o1'), { uid: 'ana', total: 1000 });
    await setDoc(doc(db, 'payments/p1'), { uid: 'ana', status: 'approved' });
    await setDoc(doc(db, 'planes/basico'), { name: 'Básico', price: 80000, days: 30 });
    await setDoc(doc(db, 'news/n1'), { titulo: 'Hola', published: true });
    await setDoc(doc(db, 'news/n2'), { titulo: 'Borrador', published: false });
  });
});

const as = (uid, claims = {}) => env.authenticatedContext(uid, { email_verified: true, auth_time: AUTH_TIME, ...claims }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const setMfa = (uid, data) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `mfa_state/${uid}`), data));

// ── Perfil ────────────────────────────────────────────────────────────────
test('el socio lee su perfil y no el de otro', async () => {
  await assertSucceeds(getDoc(doc(as('ana'), 'users/ana')));
  await assertFails(getDoc(doc(as('beto'), 'users/ana')));
  await assertFails(getDoc(doc(anon(), 'users/ana')));
});

test('el socio no puede crear su perfil ni asignarse un plan (B2)', async () => {
  await assertFails(setDoc(doc(as('nuevo'), 'users/nuevo'), { username: 'x', plan: { nombre: 'gratis' } }));
  await assertFails(updateDoc(doc(as('beto'), 'users/beto'), { plan: { nombre: 'gratis', expira: new Date(2100, 0, 1) } }));
  await assertSucceeds(updateDoc(doc(as('beto'), 'users/beto'), { username: 'beto2' }));
});

test('la foto de perfil solo admite Cloudinary o imágenes del sitio', async () => {
  await assertFails(updateDoc(doc(as('beto'), 'users/beto'), { photoURL: 'https://rastreo.example.com/x.png' }));
  await assertSucceeds(updateDoc(doc(as('beto'), 'users/beto'), { photoURL: 'https://res.cloudinary.com/demo/image/upload/a.jpg' }));
});

test('el admin lee cualquier perfil', async () => {
  await assertSucceeds(getDoc(doc(as('jefe', { admin: true }), 'users/ana')));
});

// ── Verificación en dos pasos (mfaOk) ─────────────────────────────────────
test('MFA activa: la sesión verificada entra y la no verificada no', async () => {
  await setMfa('ana', { enabled: true, sessions: [AUTH_TIME] });
  await assertSucceeds(getDoc(doc(as('ana'), 'users/ana')));
  await assertFails(getDoc(doc(as('ana', { auth_time: AUTH_TIME + 60 }), 'users/ana')));
  await assertFails(updateDoc(doc(as('ana', { auth_time: AUTH_TIME + 60 }), 'users/ana'), { username: 'robado' }));
});

test('MFA desactivada o inexistente: no cambia nada', async () => {
  await setMfa('ana', { enabled: false, sessions: [] });
  await assertSucceeds(getDoc(doc(as('ana', { auth_time: AUTH_TIME + 999 }), 'users/ana')));
  await assertSucceeds(getDoc(doc(as('beto'), 'users/beto')));
});

test('MFA también aplica al admin', async () => {
  await setMfa('jefe', { enabled: true, sessions: [AUTH_TIME] });
  await assertSucceeds(getDoc(doc(as('jefe', { admin: true }), 'users/ana')));
  await assertFails(getDoc(doc(as('jefe', { admin: true, auth_time: AUTH_TIME + 5 }), 'users/ana')));
});

test('nadie lee ni escribe el estado de MFA desde el cliente', async () => {
  await setMfa('ana', { enabled: true, sessions: [AUTH_TIME], recoveryHashes: ['h'] });
  await assertFails(getDoc(doc(as('ana'), 'mfa_state/ana')));
  await assertFails(setDoc(doc(as('ana'), 'mfa_state/ana'), { enabled: false }));
  await assertFails(getDoc(doc(as('ana'), 'mfa_challenges/ana')));
});

// ── Datos comerciales ─────────────────────────────────────────────────────
test('órdenes: el dueño las lee y nadie las crea desde el cliente', async () => {
  await assertSucceeds(getDoc(doc(as('ana'), 'orders/o1')));
  await assertFails(getDoc(doc(as('beto'), 'orders/o1')));
  await assertFails(setDoc(doc(as('ana'), 'orders/falsa'), { uid: 'ana', total: 1 }));
});

test('pagos: cerrados para el cliente, incluso para su dueño', async () => {
  await assertFails(getDoc(doc(as('ana'), 'payments/p1')));
  await assertFails(updateDoc(doc(as('ana'), 'payments/p1'), { status: 'approved' }));
});

test('planes: lectura pública, escritura solo del admin', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'planes/basico')));
  await assertFails(updateDoc(doc(as('ana'), 'planes/basico'), { price: 1 }));
  await assertSucceeds(updateDoc(doc(as('jefe', { admin: true }), 'planes/basico'), { price: 90000 }));
});

test('noticias: el público solo ve las publicadas', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'news/n1')));
  await assertFails(getDoc(doc(anon(), 'news/n2')));
});

test('logs de auditoría e ingresos: solo el servidor escribe', async () => {
  await assertFails(addDoc(collection(as('jefe', { admin: true }), 'audit_logs'), { action: 'x' }));
  await assertFails(addDoc(collection(as('ana'), 'entry_logs'), { userId: 'ana' }));
  await assertFails(addDoc(collection(as('ana'), 'pqrs'), { userId: 'ana', mensaje: 'x' }));
});

// ── Foro ──────────────────────────────────────────────────────────────────
const post = (extra = {}) => ({
  autor_id: 'ana', autor_username: 'ana', autor_is_premium: false, contenido: 'Hola gym',
  likes: [], comentarios: [], created_at: new Date(), ...extra,
});

test('publicar exige correo verificado y el nombre real del perfil', async () => {
  await assertSucceeds(setDoc(doc(as('ana'), 'posts/a1'), post()));
  await assertFails(setDoc(doc(as('ana', { email_verified: false }), 'posts/a2'), post()));
  await assertFails(setDoc(doc(as('ana'), 'posts/a3'), post({ autor_username: 'admin' })));
  await assertFails(setDoc(doc(as('ana'), 'posts/a4'), post({ autor_id: 'beto' })));
});

test('insignia premium solo con plan vigente', async () => {
  await assertSucceeds(setDoc(doc(as('ana'), 'posts/p1'), post({ autor_is_premium: true })));
  await assertFails(setDoc(doc(as('beto'), 'posts/p2'), post({ autor_id: 'beto', autor_username: 'beto', autor_is_premium: true })));
});

test('un tercero solo puede dar o quitar SU like', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'posts/x'), post()));
  await assertSucceeds(updateDoc(doc(as('beto'), 'posts/x'), { likes: ['beto'] }));
  await assertFails(updateDoc(doc(as('beto'), 'posts/x'), { likes: ['beto', 'carla'] }));
  await assertFails(updateDoc(doc(as('beto'), 'posts/x'), { contenido: 'editado por otro' }));
});
