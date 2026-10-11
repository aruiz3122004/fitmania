# 🎯 Plan de tareas — Cumplimiento de seguridad FITMANIA

**Origen:** `auditoría.md` (5 críticos · 8 altos · 7 medios · 5 bajos)
**Estado:** backlog accionable — cada tarea tiene checkbox, pasos concretos y criterio de aceptación.
**Fecha:** 2026-10-11

### 📌 Decisiones del dueño
- **D-1: Mantener TODAS las credenciales actuales** (Firebase Service Account, Stripe, Gmail, cuentas de Auth) **sin rotación**. El negocio sigue funcionando con ellas.
- **D-2: Estrategia = eliminar la exposición, no reemplazar el secreto.** Lo que se debe lograr es que **nadie más** pueda ver las credenciales: fuera de GitHub, fuera del historial, fuera de archivos versionados. Esto convierte a **T-02 y T-03** en las tareas centrales de la Fase 0.
  ⚠️ Consecuencia asumida: si el repo estuvo o está público, cualquiera que lo haya clonado conserva copia de las credenciales. La contención (historial limpio + privado) elimina el riesgo **hacia adelante**. Si en algún momento aparecen cargos/actividad rara en Stripe/Gmail, rotar será la única salida.
- **D-3:** Podés mantener los archivos locales (`scratch/`, `tmp_*.js`, `.env.local`) en tu máquina — solo se **desversionan** del repo.

---

## Cómo usar este documento

- **Estado de cada tarea:** `[ ]` pendiente · `[x]` completa · `⏭️` descartada (decisión del dueño).
- **Tipo de tarea:**
  - `[CÓDIGO]` — cambio de código, **puedo ejecutarlo yo**.
  - `[CFG]` — configuración de entorno (Vercel / Firebase / Upstash): requiere acceso a paneles.
  - `[EXT]` — acción manual externa (consolas de Google/Stripe/Gmail/GitHub).
  - `[GIT]` — operación de historial de git (requiere tu aprobación explícita).
- **Esfuerzo:** S = < 1 h · M = medio día · L = varios días.

---

## Fase 0 — Emergencia (hacer ANTES de seguir desarrollando)

> Objetivo (ajustado a las decisiones D-1/D-2): eliminar toda exposición de las credenciales que hoy viven en el repo y su historial. **No se rotan credenciales.**

### ⏭️ T-01 · ~~Rotar TODAS las credenciales~~ — `[EXT]` — **DESCARTADA (decisión del dueño, D-1)**
**Por qué estaba:** `.env.local` estuvo versionado en 6 commits y `scratch/simulate_login.js` (versionado) tiene email + contraseña reales.
**Decisión:** mantener las credenciales actuales. **Compensación obligatoria:** completar T-02 y T-03 (si el repo es o fue público, la única contención real es eliminar el historial y privatizar). Si en el futuro se detecta uso indebido de alguna clave (facturas Stripe raras, correos saliendo solos), **T-01 se reactiva** para esa clave puntual.

---

### ✅ T-02 · Eliminar del repo los archivos que filtran credenciales — `[GIT]` — Crítico (C-1) — S — **HECHO (2026-10-11)**
**Por qué:** `scratch/` y `tmp_*.js` están en `.gitignore` pero **ya están rastreados**; gitignore no los borra del repo.

**Pasos:**
```bash
git rm -r --cached scratch tmp_check_key.js tmp_fix_key.js
git commit -m "security: remover archivos con credenciales del repositorio"
git push
```
(si `scratch/` contiene archivos que aún necesitas en local, el `--cached` los conserva en disco; solo deja de versionarlos).

**Criterio:** `git ls-files | findstr scratch` → vacío. También eliminar `deep_diag.js` / `fix_env.js` si contienen rutas o salidas sensibles.

---

### ✅ T-03 · Purgar el historial y sacar el repo de la exposición — `[GIT]` — Crítico (C-1) — L — **HECHO (2026-10-11)**
**Resolución (decisión del dueño):** en lugar de privatizar o quitar el remote (opciones A/B), se **reinició el historial de git a un único commit** (`c4e815d`) con el estado actual ya saneado, y se hizo **force-push**. Así los secretos antiguos dejan de ser recuperables desde GitHub. **Compensación:** si el repo estuvo público, quien clonó conserva copia; ante uso indebido → reactivar T-01 para esa clave.
**Por qué:** borrar archivos no borra el historial; cualquiera con `git log` recupera las credenciales. Con la decisión de **no rotar** (D-1), esto es **la** defensa principal.

**Pasos:**
1. Instalar `git-filter-repo` y purgar de **todo** el historial: `.env.local`, `scratch/`, `tmp_*.js`, y cualquier otro archivo que haya contenido secretos.
2. `git push --force` a GitHub (avisar antes si hay colaboradores).
3. **Decidir a dónde va el repositorio** (elegir una, según tu preferencia):
   - **A. Repo privado** en GitHub (Settings → General → Danger Zone → Change visibility → Make private). Sigue en GitHub pero solo para ti/invitados.
   - **B. Fuera de GitHub**: eliminar el remote (`git remote remove origin`) y mantener una copia local + backup (Google Drive/OneDrive/pen) — GitHub deja de ver el proyecto por completo.
4. Si se queda en GitHub: revisar **Settings → Collaborators** (quitar a quien no deba), **deshabilitar forks** (Settings → General → Features → desmarcar "Allow forking") y dejar el repo **fuera de organizaciones públicas**.
5. Verificar clonando en limpio que no queda ningún secreto (ni en HEAD ni en historial).

**Criterio:** un clon nuevo del repo no contiene ninguna credencial; el repo es privado o ya no está en GitHub; no hay colaboradores ni forks ajenos.

---

### ✅ T-04 · Cerrar el relé de correo `/api/send-email` — `[CÓDIGO]` — Crítico (C-2) — S — **HECHO**
**Por qué:** endpoint `POST` **sin autenticación** → cualquiera envía correos como FITMANIA (spam + quema de cuota de Gmail). Además es **redundante**: el webhook de Stripe (firmado) ya envía correos de éxito/fallo/recibo.

**Pasos:**
1. Eliminar `app/api/send-email/route.ts`.
2. En `app/pago/page.tsx` (≈línea 446) eliminar el `fetch('/api/send-email', …)` y el import/uso asociado.
3. Verificar que el webhook (`app/api/stripe/webhook/route.ts`) cubre los 3 correos: `sendPaymentSuccessEmail`, `sendPaymentFailedEmail`, `sendOrderReceiptEmail` → **sí, ya los cubre** (el recibo de productos se envía en el flujo de items).

**Criterio:** `/api/send-email` responde 404 y no queda referencia en el código. Los correos de pago se siguen enviando desde el webhook.

---

## Fase 1 — Antes de producción (código + configuración)

### ✅ T-05 · Proteger `/api/admin/planes` con `verifyAdminRequest` — `[CÓDIGO]` — Crítico (C-4) — S — **HECHO**
**Por qué:** el middleware solo comprueba que la cookie `fitmania_session` **exista**, no que sea válida. `planes` es la única ruta admin que no re-verifica → una cookie forjada en `curl` permite cambiar precios.

**Pasos:** en `app/api/admin/planes/route.ts`, al inicio de `GET`, `PATCH`, `POST` y `DELETE`:
```ts
const isAdmin = await verifyAdminRequest(request);
if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
```
(ya existe el helper en `lib/auth-helpers.ts`; usado por `users`, `products`, `orders`, `logs`, etc.)

**Criterio:** con cookie forjada o sin sesión, las 4 operaciones responden **403**. `git grep verifyAdminRequest app/api/admin/*/route.ts` → ya no queda ninguna ruta sin él.

---

### ✅ T-06 · Que el cliente NO pueda escribirse el plan (reglas + código) — `[CÓDIGO]` — Crítico (C-3) — M — **HECHO**
**Por qué:** hoy cualquier usuario autenticado puede `updateDoc` su propio `users/{uid}` con `plan` → **autoproclamarse premium sin pagar**.

**Pasos:**
1. `firestore.rules`, colección `users`: permitir al propietario crear su doc y actualizar campos de perfil, **prohibiendo el campo `plan`** (que solo escribe el webhook vía Admin SDK, que ignora reglas):
```
match /users/{uid} {
  allow read: if isSignedIn() && (request.auth.uid == uid || isAdmin() || isReceptionist());
  allow create: if isAdmin() || (isSignedIn() && request.auth.uid == uid);
  allow update: if isAdmin() || (isSignedIn() && request.auth.uid == uid
        && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['plan']));
  allow delete: if isAdmin();
}
```
   - ⚠️ Verificar primero (con el código ya en mano) que `app/perfil/page.tsx`, `components/layout/user-dropdown.tsx` y `app/registro/page.tsx` no escriben el campo `plan` (confirmado: solo escriben perfil/foto/registro → siguen pasando la regla).
2. `app/pago/page.tsx` (líneas ≈468–496): **eliminar** el `updateDoc(doc(db,'users',user.uid), { plan })`. Si se quiere feedback inmediato en UI, actualizar solo el estado local (`updateUser({ plan })`), **sin escribir Firestore** — la fuente de verdad queda en el webhook.
3. Desplegar reglas: `firebase deploy --only firestore`.

**Criterio:** desde devtools, `updateDoc` con campo `plan` falla con PERMISSION_DENIED; editar perfil/foto sigue funcionando; un pago real activa el plan por webhook.

---

### ✅ T-07 · `create-payment`: rechazar items inválidos y montos del cliente — `[CÓDIGO]` — Crítico (C-5) — M — **HECHO**
**Por qué:** `amount = total > 0 ? total : body.amount || 0` hace que el **cliente decida el precio** cuando los items no resuelven (puede pagar 1 COP).

**Pasos** en `app/api/stripe/create-payment/route.ts`:
1. Si `planId` → mantener (ya valida contra Firestore). Añadir: si `planData.price` no es número `> 0` → 400.
2. Si `items` → **recalcular total solo desde Firestore** y, si algún item no existe, `cantidad` no es entero ≥ 1, o excede stock → **rechazar con 400** (nunca usar `body.amount`).
3. Evaluar el branch `else` (monto directo `body.amount`): si el frontend ya no lo usa (el pago real va por `planId|items`), **eliminarlo**; si se conserva, exigir un contexto verificable (p. ej. `concept` validado + `uid` autenticado vía cookie).
4. Mantener los metadatos (items firmados) para que el webhook no recalcule precios libremente.

**Criterio:** con `items: [{id:'no-existe', cantidad:1}]` la API responde **400** y no crea PaymentIntent; con items válidos el monto lo define siempre el servidor.

---

### ✅ T-08 · Endurecer reglas Firestore: autor obligatorio + solo-servidor — `[CÓDIGO]` — Medio (M-1, M-3, B-5) — M — **HECHO**
**Pasos** en `firestore.rules` (verificado: el cliente no escribe `orders` ni `logs`; ambos solo via webhook/Admin SDK → seguro bloquear):
```
// posts: el autor debe ser el creador
allow create: if isSignedIn() && request.resource.data.autor_id == request.auth.uid;

// pqrs: la solicitud debe pertenecer a quien la crea
allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;

// orders: solo el webhook (Admin SDK)
allow create: if false;

// logs: solo el servidor
allow create: if false;
```
⚠️ Verificar el nombre exacto del campo en `app/pqrs/page.tsx` (línea ≈83) y `app/foro/page.tsx` (línea ≈883) antes de desplegar (deben coincidir con `autor_id` / `userId`).

**Criterio:** crear un post/pqrs atribuido a otro UID → PERMISSION_DENIED; crear `orders`/`logs` desde cliente → PERMISSION_DENIED; los flujos normales (foro, PQRS) funcionan.

---

### ✅ T-09 · Webhook idempotente para la renovación de plan — `[CÓDIGO]` — Alto (A-8) — M — **HECHO**
**Por qué:** si Stripe reintenta el evento, `plan.expira` se recalcula **desde hoy** (o se corrompe). La orden es idempotente (id = `paymentIntent.id`), el plan no.

**Pasos** en `app/api/stripe/webhook/route.ts` (`payment_intent.succeeded`, rama planes):
1. Verificar **antes** de activar: si ya existe `orders/<paymentIntent.id>` → no reprocesar (escribir también una orden de tipo `plan` con id determinista al activar).
2. Calcular `expira` a partir del plan **existente** si no venció:
```ts
const userSnap = await db.collection('users').doc(meta.uid).get();
const existingPlan = userSnap.data()?.plan;
const base = existingPlan?.expira && new Date(existingPlan.expira).getTime() > Date.now()
  ? new Date(existingPlan.expira) : new Date();
const expira = new Date(base); expira.setDate(base.getDate() + dias);
```
3. Envolver el update + creación de orden en **transacción** para que reintentos concurrentes no dupliquen.

**Criterio:** reenviar 2 veces el mismo evento → misma fecha de expiración; pedido duplicado de Stripe no extiende el plan dos veces.

---

### ✅ T-10 · `entry-log` de recepción: validar sesión recepción real — `[CÓDIGO]` — Medio (M-2) — S — **HECHO**
**Por qué:** `app/api/recepcion/entry-log/route.ts` valida el token pero no el claim ni el email autorizado.

**Pasos:** sustituir `verifyIdToken(sessionCookie)` por **`verifyReceptionRequest(request)`** (ya existe en `lib/auth-helpers.ts`: valida cookie + email == `RECEPTION_AUTHORIZED_EMAIL`). Revisar si hay otras rutas de recepción con el mismo patrón.

**Criterio:** una cookie forjada o un token de un correo no autorizado → 401/403 en entry-log.

---

### T-11 · Rate limiting real: configurar Upstash + IP confiable — `[CÓDIGO]`✅ HECHO / `[CFG]` ⏳ PENDIENTE — Alto (A-1) — M
**Hecho (código):** IP confiable (`x-vercel-forwarded-for` → `cf-connecting-ip` → `request.ip` → `x-forwarded-for`); aviso fail-open en producción; `x-middleware-secret` usa un secreto propio (`INTERNAL_MIDDLEWARE_SECRET`, no el token de Upstash) y `log-block` lo exige. Verificado que las rutas sensibles (`admin/login`, `recepcion/login`, `stripe/create-payment`, `security/attempt`) pasan por el contador.
**Pendiente (CFG):** crear la base Upstash y poner `UPSTASH_REDIS_REST_URL`/`_TOKEN` en `.env.local` y Vercel (sin esto, el bloqueo sigue apagado).
**Por qué:** sin `UPSTASH_*` el bloqueo se **apaga en silencio**; y `x-forwarded-for` (primer valor) es falsificable.

**Pasos:**
1. `[CFG]` Crear base Upstash Redis (plan gratis) → poner `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en `.env.local` y Vercel.
2. `[CÓDIGO]` En `middleware.ts` (línea ≈79), usar IP confiable: `x-vercel-forwarded-for` (Vercel) o `request.ip`, con `x-forwarded-for` solo como último recurso:
```ts
const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]
  || request.ip || request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
```
3. `[CÓDIGO]` Todas las rutas protegidas (`/api/login`, `/api/recepcion/login`, `/api/admin/login`, `/api/stripe/create-payment`) deben pasar por el contador (verificar que la lista de paths ya las incluye).

**Criterio:** con Upstash activo, 15 intentos fallidos → bloqueo progresivo (1m→1h); rotar `x-forwarded-for` a mano ya **no** elude el límite.

---

### T-12 · Variables de entorno: Vercel + limpiar obsoletas — `[CFG]` — Alto (A-3) — S
**Estado actual:** en `.env.local` ya están `ADMIN_GATE_KEY`, `RECEPTION_GATE_KEY`, `ADMIN_AUTHORIZED_EMAIL`, `RECEPTION_AUTHORIZED_EMAIL` (configuradas ayer).

**Pasos:**
1. **Replicar en Vercel** los valores: `ADMIN_GATE_KEY`, `RECEPTION_GATE_KEY`, `ADMIN_AUTHORIZED_EMAIL`, `RECEPTION_AUTHORIZED_EMAIL` (+ `UPSTASH_*` de T-11). Sin ellas, los paneles dan 404 en producción.
2. Eliminar variables obsoletas de `.env.local` y Vercel: `TOKEN_ADMIN`, `TOKEN_RECEPCION` (ya no las usa el código), `VERCEL_OIDC_TOKEN` si no se usa, `STRIPE_WEBHOOK_SECRET_PRODUCTION` (revisar si el código la lee).

**Criterio:** `grep` de cada variable usada en el código → todas definidas en ambos entornos; ningún panel da 404 en prod.

---

### ✅ T-13 · Dependencias: `npm audit fix` + reemplazar `xlsx` — `[CÓDIGO]` — Alto (A-2) — L — **HECHO**
**Hecho:** `next` fijado en `16.4.0`; `xlsx` → `exceljs`; `nodemailer` `^10.1.0`. `npm audit --omit=dev` → **13 vulnerabilidades (9 moderadas, 4 altas, 0 críticas)**; las 4 altas son de la cadena del SDK cliente de Firebase (`@grpc/grpc-js`) cuyo único fix es un downgrade a `firebase@9.14.0` (no aceptable). Se agregó CI (`.github/workflows/security-audit.yml`) que falla ante **críticas** en producción.
**Extra:** eliminadas ~40 dependencias muertas (tras borrar `components/ui/*`): `jspdf`, `recharts`, `cmdk`, `vaul`, `embla-carousel-react`, `input-otp`, `next-themes`, `react-resizable-panels`, `react-hook-form`, `@hookform/resolvers`, `zod`, `class-variance-authority`, `autoprefixer`, `@cloudinary/react`, `@cloudinary/url-gen` y los `@radix-ui/react-*` sin uso (salvo `react-dialog`).
**Por qué:** 30 vulnerabilidades (3 críticas: `next`, `protobufjs`, `websocket-driver`; altas: `firebase-admin`, `nodemailer`, `xlsx`).

**Pasos:**
1. `npm audit --omit=dev` para ver estado actual.
2. `npm audit fix` (y `--force` con cuidado, validando build) + `npm update firebase-admin nodemailer`.
3. **`next`**: quedarse atento a versión > 16.3.7 (sin fix publicado hoy) — actualizar en cuanto salga; acá el build entra en juego (16.x puede romper API), programar con ventana de prueba.
4. Reemplazar `xlsx@0.18.5` (abandonado, CVEs sin fix): instalar `exceljs` (o SheetJS desde CDN oficial) y migrar la exportación de `entry_logs` (ramas `format=excel|json`).
5. Agregar `npm audit --omit=dev` como paso de CI (Vercel → GitHub Actions).

**Criterio:** `npm audit --omit=dev` sin vulnerabilidades críticas; build y exportación Excel funcionando.

---

### ✅ T-14 · `/api/diag` fuera de producción — `[CÓDIGO]` — Alto (A-7) — S — **HECHO**
**Por qué:** expone estado del Admin SDK y errores (en dev, stack completo).

**Pasos:** en `app/api/diag/route.ts`: devolver 404 si `process.env.NODE_ENV === 'production'`, o proteger con `verifyAdminRequest`.

**Criterio:** en prod `/api/diag` → 404/403; en dev sigue útil.

---

## Fase 2 — Consolidación (semanas)

### ✅ T-15 · Session cookies de Firebase con revocación — `[CÓDIGO]` — Alto (A-4) — L — **HECHO**
`fitmania_session` / `fitmania_reception_session` migradas de ID token crudo a `createSessionCookie` + `verifySessionCookie(..., checkRevoked: true)`. Archivos: `app/api/admin/login`, `app/api/recepcion/login`, `lib/auth-helpers.ts`, `app/api/auth/verify`.
**Criterio:** revocando el usuario en Firebase, sus sesiones dejan de valer en <1 min. ✔

### ✅ T-16 · Claims centralizados y revocables (admin/receptionist) — `[CÓDIGO]` — Alto (A-5) — M — **HECHO**
Se eliminó el auto-otorgamiento de `receptionist` en el login. Ahora se exige el claim (además del email whitelist) en login y en cada request (`verifyReceptionRequest`). Gestión centralizada: `PATCH /api/admin/users` (fusiona claims, no los sobrescribe, y **revoca refresh tokens** al retirar un rol) + `scripts/manage-claims.js`. `grant-admin.js` también fusiona.
**Criterio:** retirar el email de la whitelist y/o el claim revoca el acceso real. ✔

### ✅ T-17 · CSP sin `'unsafe-inline'` / `'unsafe-eval'` — `[CÓDIGO]` — Alto (A-6) — L — **HECHO**
CSP con **nonce por request** generado en `middleware.ts` (Web Crypto) y propagado en la request (para que Next lo añada a sus `<script>` durante el SSR) y en la respuesta. En **producción** `script-src` = `'self' 'nonce-…' 'strict-dynamic'` (sin `unsafe-inline`/`unsafe-eval`); en desarrollo se conservan `unsafe-eval`/`unsafe-inline` para el HMR. `style-src` mantiene `'unsafe-inline'` (la app usa atributos `style=` y un `<style>` inline; un nonce en `style-src` haría ignorar `unsafe-inline`). Se añade `object-src 'none'` y `base-uri 'self'`. Como el nonce exige SSR dinámico, se puso `export const dynamic = 'force-dynamic'` en `app/layout.tsx`.
**Verificado (producción local, `next start`):** header CSP con nonce y 15/15 scripts de Next con `nonce`; home/login/planes/carrito/foro cargan **sin violaciones de CSP**; **Stripe.js y su iframe cargan** (permitidos por `strict-dynamic` / `frame-src`).
> ⚠️ Prueba pendiente del usuario: **checkout completo de Stripe** en producción (crear PaymentIntent + pagar) y login real con Firebase.

### ✅ T-18 · Notificaciones de vencimiento con job programado — `[CÓDIGO]` — Medio (M-4) — M — **HECHO**
Se extrajo la generación a `lib/notifications.ts` y la ejecuta un **job programado**: `GET /api/cron/notifications` (protegido con `Authorization: Bearer <CRON_SECRET>`, 401 si falta) disparado por **Vercel Cron** (`vercel.json`, diario 12:00 UTC). El `GET /api/admin/notifications` quedó **solo lectura** (ya no recorre `users`).
*(Se eligió Vercel Cron + ruta interna en vez de Cloud Functions para no requerir plan Blaze ni infraestructura nueva.)*
**Criterio:** la API del panel ya no escanea toda la colección `users`. ✔

### ✅ T-19 · Exportaciones de `entry_logs` con límite de fechas — `[CÓDIGO]` — Medio (M-5) — M — **HECHO**
`format=excel|json` ahora **exige** rango de fechas (`date` o `from`+`to`), valida formato/orden, limita a **92 días** y **20 000 filas**, y aplica un `.limit()` duro en la query. **Criterio:** exportar sin rango → 400; rango excesivo → 400; no se carga toda la colección. ✔

### ✅ T-20 · Zona horaria centralizada (America/Bogotá en UTC) — `[CÓDIGO]` — Medio (M-6) — M — **HECHO**
Nueva utilidad `lib/datetime.ts` (`getDateKeyInAppTz`, `formatInAppTz`) con `Intl` + `timeZone: 'America/Bogota'`. Reemplazados los offsets manuales (`- 5*60*60*1000`) y las fechas server-side sin zona en `entry-log` (fecha + hora de export), `stripe/webhook` y `admin/notifications`. **Criterio:** sin "magic numbers" de offset. ✔

### ✅ T-21 · Limpieza general — `[CÓDIGO]` — Bajo (B-1..B-6) — S — **HECHO**
- ✅ Borrado `app/services/mail.ts` (vacío) y todo el código muerto (`components/ui/*` sin usar, `theme-provider`, `hooks/*`, `styles/globals.css`, `app/game/page.tsx`, `app/api/test-admin`).
- ✅ Eliminado el flujo PSE comentado en `app/pago/page.tsx` (308 líneas).
- ✅ `x-middleware-secret` con variable independiente (`INTERNAL_MIDDLEWARE_SECRET`).
- ⏳ (Opcional) `typescript.ignoreBuildErrors: false`: el type-check ya pasa limpio (`npx tsc --noEmit`), se puede activar en un cambio aparte.

---

## ✅ Definición de "cumplir con los estándares" (checkpoint final)

> Cuando **todas** las tareas de Fases 0–1 estén marcadas, la app está lista para producción según esta auditoría. Nada de la Fase 2 es bloqueante, pero eleva el estándar a "defensa en profundidad".

| Estándar | Qué lo cubre |
|---|---|
| 🔑 Sin credenciales en repo/historial | T-02, T-03 (contención; sin rotación por decisión D-1) |
| 🔒 Pagos: el servidor decide precio y activa solo por webhook firmado | T-06, T-07, T-09 |
| 👮 Acceso admin server-side verificado | T-05, T-14, T-12 |
| 📄 Datos bajo el mínimo privilegio (Firestore) | T-06, T-08, T-10 |
| 🛡️ Anti-abuso (rate limit, relé de correo cerrado) | T-04, T-11 |
| 📦 Sin dependencias vulnerables críticas | T-13 |
| 🍪 Sesiones revocables y seguro de navegador | T-15, T-17 (Fase 2) |

---

## 📊 Estado actual (2026-10-11)

**Fases 0–1 (código): COMPLETAS.** T-02, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-13, T-14 hechas. T-03 (historial) resuelta por reinicio de git. Del **T-11** está hecho el código; falta la `[CFG]` de Upstash.

**Fase 2 (defensa en profundidad): COMPLETA por código.** T-15 ✅, T-16 ✅, T-17 ✅, T-18 ✅, T-19 ✅, T-20 ✅, T-21 ✅.

**Pendientes de configuración/paneles (`[CFG]`/`[EXT]`, no son código):**
- T-11-CFG: crear Upstash y definir `UPSTASH_REDIS_REST_URL/_TOKEN`.
- T-12: replicar en Vercel `ADMIN_GATE_KEY`, `RECEPTION_GATE_KEY`, `ADMIN_AUTHORIZED_EMAIL`, `RECEPTION_AUTHORIZED_EMAIL`, `INTERNAL_MIDDLEWARE_SECRET`, `CRON_SECRET`, `UPSTASH_*`; limpiar variables obsoletas.
- T-17: probar **checkout completo de Stripe** y login real (Firebase) ya en producción.
- T-18: al desplegar, Vercel detecta `vercel.json` y activa el cron diario; definir `CRON_SECRET` para que la ruta no responda 401.
- `firestore.rules`: `firebase deploy --only firestore:rules` (Firebase Storage no se usa; su configuración fue eliminada).
- Otorgar el claim `receptionist` a la cuenta de recepción si aún no lo tiene (`node scripts/manage-claims.js <email> receptionist on`).

## ⚡ Historial de ejecución (tareas de código, sin paneles externos)

1. ✅ **T-02** — `git rm -r --cached scratch tmp_check_key.js tmp_fix_key.js`.
2. ✅ **T-04** — eliminado `/api/send-email` y su llamada en `pago/page.tsx`.
3. ✅ **T-05** — `verifyAdminRequest` en `planes` (4 métodos).
4. ✅ **T-06** — reglas `users` sin campo `plan` + quitado `updateDoc` del cliente.
5. ✅ **T-07** — rechazar items inválidos en `create-payment`.
6. ✅ **T-08** — reglas `posts`/`pqrs`/`orders`/`logs`.
7. ✅ **T-09** — idempotencia del webhook de plan.
8. ✅ **T-10** — `verifyReceptionRequest` en entry-log.
9. ✅ **T-14** — `/api/diag` deshabilitado en prod.
10. ✅ **T-13** — `next@16.4.0`, `xlsx`→`exceljs`, `npm audit fix`, CI de `npm audit`.
11. ✅ **T-21** — código muerto + flujo PSE + ~40 deps muertas eliminadas.
12. ✅ **T-20** — `lib/datetime.ts` (America/Bogota).
13. ✅ **T-19** — export de `entry_logs` con rango/topes.
14. ✅ **T-15** — session cookies de Firebase revocables.
15. ✅ **T-16** — claims centralizados (`admin/users` + `manage-claims.js`).
16. ✅ **T-17** — CSP estricta con nonces (`middleware.ts` + `force-dynamic`).
17. ✅ **T-18** — notificaciones vía Vercel Cron (`/api/cron/notifications`) + GET solo lectura.

*(Las externas — T-03, T-11-CFG, T-12-CFG y el deploy de reglas — requieren tus credenciales/paneles; guía exacta en cada tarea.)*