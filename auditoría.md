# 🔒 Auditoría de Seguridad — FITMANIA

**Fecha:** 2026-10-10
**Alcance:** Repositorio `fitmania` (rama `main`, tras el merge `6ed227d`), aplicación Next.js 16 + Firebase (Auth, Firestore, Storage) + Stripe + Gmail SMTP + Cloudinary.
**Estado:** Pre-producción / desarrollo activo.

---

## 1. Resumen ejecutivo

| Nivel | Cantidad | Acción recomendada |
|---|---|---|
| 🔴 Crítico | **5** | Resolver antes de desplegar a producción |
| 🟠 Alto | **8** | Resolver en la próxima iteración |
| 🟡 Medio | **7** | Planear en el backlog de seguridad |
| 🟢 Bajo | **5** | Limpieza y buenas prácticas |

**Conclusión: la aplicación NO está lista para producción.** La arquitectura de seguridad base (cookies HttpOnly, claims de Firebase, verificación de firma en webhook, reglas de entrada, auditoría inmutable) es sólida, pero hay **fugas de credenciales reales en el repositorio**, un **endpoint de envío de correo abierto**, **reglas Firestore que permiten autoproclamarse plan premium sin pagar** y una **API de planes sin autenticación real**.

**Lo que está BIEN hecho** (no hay que tocar):
- ✅ Webhook de Stripe verifica la firma (`stripe.webhooks.constructEvent`).
- ✅ Sesiones con cookie `HttpOnly` + `Secure` + `SameSite` y `verifyIdToken` en la mayoría de rutas admin.
- ✅ Colecciones `audit_logs` y `entry_logs` solo escribibles desde el Admin SDK (`allow write: if false`).
- ✅ No hay claves hardcodeadas en el código fuente actual (`git grep` limpio).
- ✅ Headers de seguridad aplicados globalmente en el middleware (CSP, HSTS, `X-Frame-Options`, etc.).
- ✅ Rate limiting progresivo (1m→1h) cuando Upstash Redis está configurado.

---

## 2. Hallazgos críticos 🔴

### C-1. Credenciales reales filtradas en el repositorio y su historial

**Dónde:**
- `scratch/simulate_login.js` (archivo **versionado**): contiene el email y la **contraseña en texto plano** de una cuenta real de Firebase Auth (`andreselgameroscuro@gmail.com`).
- `tmp_fix_key.js` (archivo **versionado**): contiene un fragmento de la clave privada del Service Account (`HThI`).
- `.env.local` fue **commiteado en 6 ocasiones** en el historial (`42213dd`, `0fcc939`, `018c17c`, `e3a0b46`, `cdae479`, `b3a9038`). Ese archivo contiene: `FIREBASE_PRIVATE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GMAIL_APP_PASSWORD`. Todo esto ya está (o estuvo) en `github.com/aruiz3122004/fitmania`.

**Impacto:** quien tenga acceso al repo (es público o semipúblico) puede tomar control total de Firebase (escribir cualquier documento, cambiar claims), procesar pagos con la cuenta Stripe y leer el buzón de Gmail.

**Nota:** en HEAD el `.env.local` ya no está rastreado y el `.gitignore` lo cubre (`env*.local`), pero **borrar el archivo no borra el historial**.

**Acción:**
1. **Rotar TODAS las credenciales** (urgente, asumir comprometidas):
   - Firebase: generar nueva Service Account en la consola y actualizar `FIREBASE_PRIVATE_KEY` / `CLIENT_EMAIL`.
   - Stripe: regenerar `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`.
   - Gmail: revocar la App Password y crear una nueva.
   - Cambiar la contraseña de la cuenta `andreselgameroscuro@gmail.com` en Firebase Auth.
2. **Purgar el historial** (`git filter-repo --path .env.local --invert-paths` o BFG) y forzar push. Si al final el repo queda público, verificar que ya no hay restos.
3. Eliminar `scratch/` y `tmp_*.js` del repo (están listados en `.gitignore` pero **gitignore no afecta a archivos ya rastreados**): `git rm -r --cached scratch tmp_check_key.js tmp_fix_key.js`.
4. Valorar que el repo sea **privado**.

---

### C-2. `/api/send-email` es un relé de correo abierto

**Dónde:** `app/api/send-email/route.ts` (llamado desde `app/pago/page.tsx`, línea 446).

**Problema:** el endpoint `POST` no tiene **ninguna** autenticación. Cualquier persona puede llamarlo con `{ type:'success', to:'cualquiera@dominio.com', ... }` y el servidor enviará correos usando las credenciales SMTP de Gmail de la empresa. Es un vector de **spam, suplantación de la marca y quema de cuotas del servidor** (además, el cliente puede inventar montos, conceptos y destinatarios).

**Acción:** eliminar este endpoint y dejar que el envío de correos lo haga **solo el webhook de Stripe** (que sí está autenticado por firma). Si se necesita un endpoint de email, protegerlo con la misma cookie de sesión verificada (`verifyAdminRequest`/Firebase Auth server-side).

---

### C-3. Reglas Firestore: el usuario puede otorgarse plan premium sin pagar

**Dónde:** `firestore.rules`, regla de `users`:
```
allow write: if isAdmin() || (isSignedIn() && request.auth.uid == uid);
```
Además, `app/pago/page.tsx` (líneas 468–496) escribe literalmente el objeto `plan` en `users/{uid}` desde el cliente con `updateDoc`.

**Problema:** cualquier usuario autenticado puede modificar su propio documento `users/{uid}` **y escribir el campo `plan` directamente** desde la consola del navegador (Firestore SDK), sin pagar. El pago deja de ser la vía obligatoria para activar membresías. También puede espiar/suplantar campos.

**Acción:**
1. Dejar de escribir el `plan` desde el cliente; que lo actualice **solo el webhook** (Admin SDK), que ya es la fuente de verdad.
2. Cambiar la regla para que el usuario **no** pueda escribir el plan:
   - Mejor opción: mover la membresía a una colección aparte `memberships/{uid}` con `allow write: if false` (server-only) y que `users` solo permita al propietario actualizar campos inocuos.
   - Si se mantiene en `users`, trasladar la escritura del `plan` a Cloud Functions / Admin SDK y endurecer la regla.

---

### C-4. `/api/admin/planes` sin verificación server-side (bypass con cookie falsa)

**Dónde:** `app/api/admin/planes/route.ts` (GET y PATCH; no importa `verifyAdminRequest`).

**Problema:** el middleware solo comprueba que la cookie `fitmania_session` **exista**, no que sea válida. Como `planes` no reevalúa el token con `verifyIdToken` (como sí hacen `users`, `products`, `orders`, `logs`, etc.), un atacante puede hacer `document.cookie` imposible (HttpOnly) pero sí puede **enviar una cookie forjada con cualquier valor** desde `curl`/Postman y llamar libremente al `PATCH` para **cambiar los precios de los planes** (p. ej., poner un plan a 1 COP y comprarlo, o subir precios para estafar clientes).

**Comprobación:** `git grep verifyAdminRequest app/api/admin/*/route.ts` muestra que **todas** las rutas admin lo usan excepto `planes`.

**Acción:** añadir al inicio de cada método (`GET`, `PATCH`, `POST`, `DELETE`):
```ts
const isAdmin = await verifyAdminRequest(request);
if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
```

---

### C-5. `create-payment`: el monto recae en el cliente cuando los items no resuelven

**Dónde:** `app/api/stripe/create-payment/route.ts`, línea 42:
```js
amount = total > 0 ? total : body.amount || 0
```

**Problema:** si un cliente envía `items` con IDs inexistentes (o vacíos), `total` queda en 0 y el sistema usa **el monto que envía el propio cliente**. Eso rompe el principio de "el servidor decide el precio" y permite pagar montos arbitrarios (p. ej., 1 COP) que el webhook después procesa como compra. El caso correcto (plan por `planId`) sí se valida contra la base de datos y está bien.

**Acción:** si los items no resuelven contra Firestore, **rechazar el pago con 400** en lugar de usar `body.amount`. Además: validar `cantidad` (entero ≥ 1, tope razonable) y stock antes de crear el PaymentIntent, y firmar los items en los metadatos para que el webhook no confíe en `cantidad` sin evaluar.

---

## 3. Hallazgos altos 🟠

### A-1. Mitad del rate limiting está apagado sin Upstash configurado

**Dónde:** `middleware.ts` (`if (redis)`), `lib/firebase-admin.ts` (env vars).

**Problema:** la variable `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` **no existen** en `.env.local` actual → `redis = null` → **todo el bloqueo por intentos se desactiva en silencio** (fail-open). Además, la IP se toma de `x-forwarded-for` (primer valor), un header **falsificable** → el atacante puede rotar la IP y saltarse el límite.

**Acción:**
1. Configurar Upstash Redis y definir las dos variables en Vercel.
2. Usar `request.ip` (o `x-vercel-forwarded-for`) en vez del primer valor de `x-forwarded-for`.
3. Considerar máximo nivel de bloqueo y persistencia (Redis) para que no se resetee con un deploy.

---

### A-2. Vulnerabilidades de dependencias (esto NO es opcional)

`npm audit --omit=dev` → **30 vulnerabilidades: 3 críticas, 14 altas, 12 moderadas, 1 baja.**

| Paquete | Versión instalada | Severidad | Nota |
|---|---|---|---|
| `next` | 16.2.0 | 🔴 crítica | rango afectado hasta 16.3.7, sin fix publicado aún |
| `protobufjs` | (transitiva) | 🔴 crítica | — |
| `websocket-driver` | (transitiva) | 🔴 crítica | (via `@firebase/auth` etc.) |
| `firebase-admin` | 13.7.0 | 🟠 alta | rango 5.0.0–13.10.0 afectado |
| `nodemailer` | 8.0.4 | 🟠 alta | <= 10.0.5 afectado |
| `xlsx` | 0.18.5 | 🟠 alta | sin fix en npm (paquete abandonado) |
| `sharp`, `postcss`, `browserslist`, `lodash`, `nanoid`, `source-map-js`, `dompurify`, `fflate`, `form-data`, `node-forge`, `@grpc/grpc-js`, … | — | 🟠 altas / 🟡 medias | transitivas |

**Acción (en orden):**
1. Actualizar `next` en cuanto se publique el fix (>16.3.7) — es el paquete con rango crítico.
2. `npm audit fix` y actualizar `firebase-admin` y `nodemailer`.
3. **Reemplazar `xlsx`**: el paquete en npm está abandonado (última versión 0.18.5 con CVEs sin fix). Usar `xlsx` desde el CDN oficial de SheetJS, o `exceljs`.
4. Revisar periódicamente con `npm audit --omit=dev` (agregar un paso en CI).

---

### A-3. Variables de entorno requeridas por el código que faltan en `.env.local`

El código nuevo espera variables que **no están configuradas**:

| Variable | Dónde se usa | Efecto si falta |
|---|---|---|
| `RECEPTION_AUTHORIZED_EMAIL` | `/api/recepcion/login` | El login de recepción responde 500 "Configuración incompleta" |
| `ADMIN_AUTHORIZED_EMAIL` | `/api/admin/login` | El acceso admin pasa a depender solo del claim |
| `ADMIN_GATE_KEY` / `RECEPTION_GATE_KEY` | `middleware.ts` | La puerta `?key=` de /fitministration y /fitception no deja pasar sin cookie |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | `middleware.ts` | Rate limiting desactivado (ver A-1) |

**Acción:** declararlas en Vercel (y `.env.local`) con valores largos aleatorios. Además, eliminar variables obsoletas del `.env.local` (`TOKEN_ADMIN`, `TOKEN_RECEPCION`) que ya no se usan en el código.

---

### A-4. La cookie de sesión se guarda como ID token crudo de Firebase (consejo, no urgencia)

**Dónde:** `/api/admin/login` → `cookies.set('fitmania_session', idToken, …)`.

**Problema:** el ID token de Firebase tiene una vida de 1 h y no se puede revocar individualmente de forma trivial. Es funcional, pero lo recomendable es usar **session cookies de Firebase** (`createSessionCookie`) o `revocationCheck` para poder invalidar sesiones de un admin comprometido.

**Acción (P1):** migrar a `adminAuth.createSessionCookie(idToken, { expiresIn: 60*60*1000 })` y verificar con `verifySessionCookie`. Esto da control de revocación.

---

### A-5. Claim `receptionist` se otorga en cada login sin revocación

**Dónde:** `/api/recepcion/login` → `setCustomUserClaims(uid, { receptionist: true })`.

**Problema:** el claim es permanente: si algún día se retira el email de autorización, el usuario seguirá teniendo `receptionist:true` (y acceso de lectura a `users`, `checkIns`, `entry_logs`). Algo similar ocurre con `admin` (otorgable por cualquier admin vía `/api/admin/users`).

**Acción:** gestionar claims desde Firestore/Consola en lugar de auto-otorgarlos en login, o añadir revocación/expiración.

---

### A-6. CSP débil: `'unsafe-inline'` y `'unsafe-eval'`

**Dónde:** `middleware.ts`, línea 40.

**Problema:** `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com …` neutraliza buena parte de la protección contra XSS (un payload inyectado puede ejecutarse). Es comprensible por Next.js, pero vale la pena ir apretándolo:
- Quitar `'unsafe-eval'` cuando sea posible (revisar dependencias que lo necesiten).
- Usar nonces (`next.config` `experimental.strictNextHead` / plugins de headers) en vez de `'unsafe-inline'`.

---

### A-7. Endpoint `/api/diag` público

**Dónde:** `app/api/diag/route.ts`.

**Problema:** expone en producción si el Admin SDK está conectado y detalla errores (en dev incluye stack). No es crítico, pero es información innecesaria para atacantes.

**Acción:** deshabilitarlo en producción o protegerlo con la sesión admin.

---

### A-8. El webhook de Stripe no es idempotente para la renovación del plan

**Dónde:** `app/api/stripe/webhook/route.ts`, caso `payment_intent.succeeded`.

**Problema:** si Stripe reintenta el mismo evento (o llega duplicado), el `plan.expira` **se recalcula desde hoy** (`new Date()`), extendiendo o corrompiendo la fecha. La orden sí es idempotente (usa `doc(paymentIntent.id)`), el plan no.

**Acción:** calcular la fecha de expiración a partir del valor **existente** si `plan.expira > now` (sumar días), y verificar que no exista ya la orden antes de activar el plan.

---

## 4. Hallazgos medios 🟡

### M-1. `posts` y `pqrs` no validan la propiedad en `create`
`allow create: if isSignedIn()` sin comprobar `request.resource.data.autor_id == request.auth.uid` (posts) ni `userId == request.auth.uid` (pqrs). Un usuario puede crear contenido en nombre de otro (spoofing de atribución) y hasta generar PQRS atribuidas a terceros. **Acción:** añadir la igualdad en la propia regla de `create`.

### M-2. Formulario de recepción valida el token pero no el claim
`/api/recepcion/entry-log` comprueba `verifyIdToken(sessionCookie)` pero no que el token tenga `receptionist:true` ni que el email esté autorizado (sí lo hace el login que crea la cookie; el bypass requeriría robar una cookie). **Acción:** usar `verifyReceptionRequest(request)` (ya existe en `lib/auth-helpers.ts`) que valida email autorizado.

### M-3. `orders` permite creación a cualquier usuario autenticado
`allow create: if isSignedIn()` → se pueden crear órdenes falsas (totales arbitrarios) que luego inflan las estadísticas del admin. **Acción:** `allow create: if false` (solo el webhook vía Admin SDK escribe) o validar contra el PaymentIntent.

### M-4. Consultas pesadas en el vector de advertencias
`/api/admin/notifications` (GET) recorre TODOS los usuarios con plan en cada visita. Con miles de usuarios es lento y caro. **Acción:** scheduler de Cloud Functions que genere las notificaciones diarias; la API solo lee.

### M-5. Exportación de `entry_logs` carga todo en memoria
GET con `format=excel|json` trae **todas** las entradas sin límite. Con volúmenes altos, lentitud y posible timeout. **Acción:** limitar exportaciones por rango de fecha (obligatorio) y tareas de streaming.

### M-6. Fechas locales y zona horaria con cálculo manual
En varias rutas se resta `5*60*60*1000` a mano. Correcto hoy para Colombia, frágil a futuro (horario de verano, otros países). **Acción:** centralizar en la zona `America/Bogota` y guardar timestamps UTC.

### M-7. `xlsx` (paquete) usado también para exportación
El mismo paquete vulnerable del punto A-2 se usa en `entry-log`. Ya cubierto en la acción de A-2 (reemplazar por SheetJS CDN o `exceljs`).

---

## 5. Hallazgos bajos 🟢

| # | Hallazgo | Dónde |
|---|---|---|
| B-1 | `app/services/mail.ts` está **vacío** y duplica a `services/mail.ts` (el real). El código usa `@/services/mail`, pero la confusión puede causar bugs futuros. | `app/services/mail.ts` |
| B-2 | `typescript.ignoreBuildErrors: true` permite publicar con errores de tipos. | `next.config.mjs` |
| B-3 | `images.unoptimized: true` (sin CDN/optimización; no es seguridad per se, solo rendimiento). | `next.config.mjs` |
| B-4 | Código muerto: flujo PSE completo comentado en `app/pago/page.tsx` (700+ líneas), `scratch/*`, referencias a `TOKEN_ADMIN`/`TOKEN_RECEPCION`. Limpiar. | `app/pago/page.tsx` |
| B-5 | La colección `logs` permite `create` a cualquier usuario autenticado (puede inflarse). Considerar `write: if false`. | `firestore.rules` |
| B-6 | `x-middleware-secret` usa como secreto la propia `UPSTASH_REDIS_REST_TOKEN` (o fallback `'fitmania_fallback'`). Funciona, pero conviene una variable independiente. | `app/api/security/log-block/route.ts`, `middleware.ts` |

---

## 6. Fortalezas que preservar ✅

1. **Webhook Stripe firmado y verificado** — la única fuente autorizada para activar pagos.
2. **Sesiones admin/recepción por cookie HttpOnly + SameSite + Secure**, con re-verificación server-side (`verifyIdToken`) en los endpoints críticos.
3. **Reglas immutables**: `audit_logs` y `entry_logs` con `allow write: if false`.
4. **Auditoría de acciones**: se registran login fallidos, bloqueos y acciones de admin.
5. **Rate limiting progresivo** y UI de "sistema bloqueado" (cuando Upstash está activo).
6. **No hay secretos hardcodeados** en el código fuente actual.
7. **Headers de seguridad globales** (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy).

---

## 7. Hoja de ruta priorizada ("¿qué hacer después?")

### 🔴 Fase 0 — Ahora mismo (emergencia, horas)
1. Rotar: Service Account de Firebase, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, App Password de Gmail, contraseña de la cuenta filtrada.
2. `git rm -r --cached scratch tmp_check_key.js tmp_fix_key.js` + commit.
3. Purgar historial de `.env.local` y `scratch` (`git filter-repo`) + `git push --force`. Considerar repo privado.
4. Eliminar o proteger `/api/send-email`.

### 🟠 Fase 1 — Antes de producción (días)
5. Endurecer reglas Firestore: `users` (sin escritura de `plan` por el owner), `orders` (create=false), validación de autor en `posts`/`pqrs`, `logs` (write=false). Deployar con `firebase deploy --only firestore,storage`.
6. `verifyAdminRequest` en `/api/admin/planes`.
7. Quitar el fallback `body.amount` en `create-payment`; validar items/cantidades/stock.
8. Eliminar el `updateDoc` de plan desde el cliente (`pago/page.tsx`); dejar solo el webhook.
9. Configurar en Vercel: `UPSTASH_*`, `ADMIN_GATE_KEY`, `RECEPTION_GATE_KEY`, `ADMIN_AUTHORIZED_EMAIL`, `RECEPTION_AUTHORIZED_EMAIL`. Limpiar variables obsoletas.
10. Actualizar dependencias (`npm audit fix`) y reemplazar `xlsx`.

### 🟡 Fase 2 — Consolidación (semanas)
11. Migrar a session cookies de Firebase (`createSessionCookie` / `verifySessionCookie`) para revocación.
12. Endurecer CSP (quitar `unsafe-eval`/`unsafe-inline` con nonces).
13. Generar notificaciones de vencimiento con Cloud Functions (scheduler).
14. Desactivar `/api/diag` en producción; paginación/límite en exportaciones de `entry_logs`.
15. Gestión de claims (admin/receptionist) centralizada y revocable.
16. Agregar `npm audit` + linter de secretos al CI (pre-commit con `gitleaks`/`trufflehog`).

---

## 8. Referencias de archivos clave

| Archivo | Rol en la auditoría |
|---|---|
| `firestore.rules` | Reglas de acceso a datos (C-3, M-1, M-3, B-5) |
| `storage.rules` | Uploads de imágenes (OK, con validación de tipo y tamaño) |
| `middleware.ts` | Rate limit (A-1), gate de páginas, headers (A-6), chequeo de cookie (C-4) |
| `app/api/send-email/route.ts` | Relé de email abierto (C-2) |
| `app/api/stripe/create-payment/route.ts` | Monto del cliente como fallback (C-5) |
| `app/api/stripe/webhook/route.ts` | Activación de plan y stock (bien, pero idempotencia A-8) |
| `app/api/admin/planes/route.ts` | Falta de autenticación server-side (C-4) |
| `app/pago/page.tsx` | Escritura de plan desde el cliente (C-3), endpoint send-email (C-2) |
| `lib/auth-helpers.ts` | Verificación con token/cookie (usa `verifyIdToken`) |
| `lib/firebase-admin.ts` | Inicialización lazy del Admin SDK (correcto: usa variables de entorno) |
| `scratch/simulate_login.js`, `tmp_fix_key.js` | Credenciales filtradas (C-1) |
| `package.json` / `package-lock.json` | Dependencias vulnerables (A-2) |

---

*Informe generado a partir del código en `main` (commit `6ed227d`). La app se considera segura para producción únicamente tras completar las Fases 0 y 1.*