# TAREAS DE MEJORA — FITMANIA

**Origen:** `PLAN_DE_MEJORA.md` (2026-10-20) · **Go-live:** enero 2027 · **Congelamiento de código:** 2026-12-29

**Convenciones**
- Estado: `[ ]` pendiente · `[x]` hecha · `[~]` en curso · `⏭️` descartada.
- Tipo:
  - `[CÓDIGO]`: cambio de código que puede ejecutar el agente.
  - `[CFG]`: configuración en paneles (Vercel, Firebase, Upstash, Cloudinary).
  - `[EXT]`: trámite externo (pasarela, banco, contador).
  - `[LEGAL]`: requiere abogado o contador.
- Esfuerzo: **S** < 1 h · **M** ≈ medio día · **L** varios días.
- Ref: sección de `PLAN_DE_MEJORA.md`.

**Totales:** 100 tareas. Por fase: F0 = 9, F1 = 30, F2 = 29, F3 = 27 y F4 = 5. De ellas, 6 son adiciones recomendadas y no obligatorias para salir a producción (F3-22 a F3-27).

---

## FASE 0 — Decisiones y configuración base (20 – 26 oct)

- [ ] **F0-01 · Elegir pasarela local y abrir cuenta comercial** — `[EXT]` — L — Ref 4.15, B1
  - Recomendado: Wompi. Alternativas: Mercado Pago, ePayco. Requiere RUT, cámara de comercio y cuenta bancaria del negocio.
  - Confirmar los métodos disponibles: tarjeta, PSE, Nequi, Botón Bancolombia y Daviplata.
  - **Criterio:** llaves de sandbox y producción, y secreto de eventos (webhook), en mano.
- [ ] **F0-02 · Migrar a Vercel Pro y Firebase Blaze** — `[CFG]` — S — Ref B10, 4.2
  - Configurar alertas de presupuesto en GCP, Vercel y Cloudinary.
  - **Criterio:** facturación activa a nombre del negocio y alertas configuradas.
- [ ] **F0-03 · Traspasar las cuentas al negocio y activar 2FA** — `[EXT]` — M — Ref 4.2
  - Cuentas: Firebase/GCP, Vercel, pasarela, Cloudinary, Resend, Upstash, dominio y GitHub.
  - El desarrollador queda como miembro, no como dueño.
  - **Criterio:** el dueño de cada cuenta es el negocio y todas tienen 2FA.
- [ ] **F0-04 · Rotar todas las credenciales** — `[CFG]` — M — Ref B8, 4.14
  - Lista: cuenta de servicio de Firebase (`FIREBASE_PRIVATE_KEY_B64`), Stripe (hasta retirarlo), Resend, Upstash, `ADMIN_GATE_KEY`, `RECEPTION_GATE_KEY`, `INTERNAL_MIDDLEWARE_SECRET`, `CRON_SECRET` y las contraseñas de las cuentas de Auth expuestas.
  - Revoca la decisión D-1 de `tareas-seguridad.md`.
  - **Criterio:** las claves viejas devuelven error de autenticación y producción funciona con las nuevas.
- [ ] **F0-05 · Dominio propio verificado en Resend** — `[CFG]` — S — Ref 4.12
  - Configurar SPF, DKIM y DMARC, y definir `MAIL_FROM` con `no-reply@<dominio>`.
  - **Criterio:** un correo de prueba a un Gmail ajeno llega a la bandeja principal.
- [ ] **F0-06 · Crear el entorno de staging** — `[CFG]` — M — Ref 6.7
  - Un proyecto Firebase aparte y un entorno Vercel Preview con sus propias variables. Datos ficticios.
  - **Criterio:** se puede desplegar y probar sin tocar producción.
- [ ] **F0-07 · Configurar Upstash y las variables pendientes** — `[CFG]` — S — Ref 4.12 (T-11, T-12)
  - Definir `UPSTASH_*`, `CRON_SECRET` e `INTERNAL_MIDDLEWARE_SECRET`, y eliminar las variables obsoletas.
  - **Criterio:** en producción no aparece el aviso `[SECURITY] Rate limiting DESACTIVADO`.
- [ ] **F0-08 · Contratar la revisión legal y la facturación electrónica** — `[LEGAL]` — M — Ref 4.19, 4.15
  - Abogado: política de tratamiento de datos y términos.
  - Contador: régimen, obligación de factura electrónica y RNBD.
  - Proveedor tecnológico DIAN: Alegra, Siigo o Facture.
  - **Criterio:** proveedor elegido y fecha de entrega de los textos legales.
- [ ] **F0-09 · Verificar los supuestos del plan** — `[CFG]` — S — Ref §8
  - Revisar: si el SW se registra en producción, si Cloudinary queda bloqueado por la CSP, si las reglas desplegadas coinciden con `firestore.rules` y si hay socios menores de edad.
  - **Criterio:** la tabla §8 de `PLAN_DE_MEJORA.md` queda con cada supuesto confirmado o descartado.

---

## FASE 1 — Integridad y seguridad crítica (27 oct – 16 nov)

### 1A. Base del backend
- [x] **F1-01 · Quitar `ignoreBuildErrors` y corregir los tipos** — `[CÓDIGO]` — M — Ref 4.3
  - En `next.config.mjs`. Agregar `eslint` y `tsc --noEmit` al workflow de CI.
  - **Criterio:** `npm run build` y el CI pasan sin ignorar errores.
- [ ] **F1-02 · Validar las variables de entorno al arrancar** — `[CÓDIGO]` — S — Ref 4.7, 4.12
  - `lib/env.ts` con zod. Si falta una variable crítica, el arranque falla con un mensaje claro.
  - **Criterio:** quitar una variable crítica rompe el build o el arranque y nombra la variable.
- [~] **F1-03 · `requestId` y manejador de errores común** — `[CÓDIGO]` — M — Ref 4.7, 4.9
  - El middleware genera un UUID (`x-request-id`).
  - `lib/http.ts` responde `{ error, requestId }` y deja el detalle solo en los logs. Eliminar todo `error.message` de las respuestas.
  - **Criterio:** `grep "error.message" app/api` no devuelve respuestas al cliente.
- [~] **F1-04 · Validación zod en todas las rutas** — `[CÓDIGO]` — M — Ref 4.7
  - Lista blanca de campos en `admin/planes`, `admin/products`, `admin/users`, `admin/pqrs/respond`, `recepcion/entry-log` y `admin/notifications`.
  - Tope `limit ≤ 200` en `admin/logs`.
  - **Criterio:** un campo no declarado devuelve 400 y no se escribe.

### 1B. Reglas de Firestore y datos de usuario
- [~] **F1-05 · Endurecer las reglas de `users`** — `[CÓDIGO]` — M — Ref B2, 4.14
  - `create`: sin `plan`, o `plan == null`.
  - `update` del dueño: `affectedKeys().hasOnly(['username','avatar','photoURL','peso','altura','gender','notificationPrefs'])`.
  - Quitar `isReceptionist()` de la lectura.
  - **Criterio:** una prueba de reglas confirma que un cliente no puede crear ni editar `plan`, y que recepción no puede leer `users`.
- [~] **F1-06 · Registro desde el servidor y verificación de correo** — `[CÓDIGO]` — M — Ref 4.1, 4.18
  - Nuevo `POST /api/users/register`: crea el documento omitiendo campos vacíos (sin `undefined`).
  - Llamar a `sendEmailVerification` y exigir el correo verificado para comprar y publicar.
  - **Criterio:** el registro sin peso ni altura funciona, y una cuenta sin verificar no puede pagar ni publicar.
- [~] **F1-07 · Foro con subcolecciones y reglas validadas** — `[CÓDIGO]` — L — Ref 4.20
  - Comentarios en `posts/{id}/comments/{cid}` y likes en `posts/{id}/likes/{uid}`.
  - Reglas: `contenido.size() <= 2000`, `keys().hasOnly`, `autor_id == auth.uid`. Eliminar `autor_is_premium` declarado por el cliente.
  - Migrar los comentarios embebidos (ver F2-14).
  - **Criterio:** un no autor puede dar like y comentar, y no puede editar ni borrar comentarios ajenos.
- [x] **F1-08 · Acompañante desde el servidor** — `[CÓDIGO]` — S — Ref 4.20
  - Nuevo `PATCH /api/me/companion`, que valida que el plan esté vigente y permita acompañante. Quitar el `updateDoc('plan.acompanante')`.
  - **Criterio:** guardar el acompañante funciona con las reglas de F1-05.
- [~] **F1-09 · Dejar de copiar el avatar en los posts** — `[CÓDIGO]` — M — Ref 4.6
  - Quitar el recorrido de todos los posts en `user-dropdown.tsx:47-75` y resolver el avatar por `autor_id` al mostrar.
  - **Criterio:** cambiar la foto hace una sola escritura.

### 1C. Autenticación y rate limiting
- [~] **F1-10 · Rate limiting real en el servidor** — `[CÓDIGO]` — M — Ref B5, 4.16
  - Eliminar `/api/security/success`, `/api/security/attempt` y `lib/rate-limit-client.ts`.
  - Usar `@upstash/ratelimit` (sliding window) con clave `uid`, o `IP + endpoint` para anónimos.
  - Aplicar en: login de paneles, checkout, registro, publicaciones y firma de subidas.
  - Fail-closed en los endpoints de admin.
  - **Criterio:** no hay forma de reiniciar el contador sin autenticarse, y 30 socios bajo la misma IP no se bloquean entre ellos.
- [ ] **F1-11 · Firebase App Check** — `[CÓDIGO]`+`[CFG]` — M — Ref 4.16
  - reCAPTCHA Enterprise, aplicado a Firestore y Auth.
  - **Criterio:** las peticiones sin token de App Check se rechazan en producción.
- [~] **F1-12 · Rehacer la puerta del admin** — `[CÓDIGO]` — M — Ref 4.14
  - Cookie de puerta firmada con HMAC y con expiración, o eliminar la puerta (recomendado si F1-13 está hecho).
  - Si se mantiene la llave: hash SHA-256 + `timingSafeEqual`, enviada por POST, nunca en la URL.
  - El middleware valida la firma, no solo que la cookie exista.
  - **Criterio:** poner a mano `fitmania_admin_gate=true` o una `fitmania_session` falsa ya no deja pasar.
- [ ] **F1-13 · MFA TOTP obligatorio para el admin** — `[CÓDIGO]`+`[CFG]` — M — Ref 4.18
  - Activar Identity Platform. La API de login rechaza cuentas `admin` sin segundo factor.
  - Guardar códigos de respaldo offline.
  - **Criterio:** el login del admin exige el código TOTP.
- [ ] **F1-14 · Recepción con una cuenta por persona** — `[CÓDIGO]` — S — Ref 4.18
  - Eliminar `RECEPTION_AUTHORIZED_EMAIL` de `auth-helpers.ts`, `recepcion/login` y `auth/verify`. El claim `receptionist` basta.
  - **Criterio:** dos recepcionistas con cuentas distintas entran, y cada ingreso registra a su autor (F2-03).
- [~] **F1-15 · Sesión de recepción por turno y arreglo de `role`** — `[CÓDIGO]` — S — Ref 4.13
  - Cambiar `role=reception` por `role=recepcion` (`fitception/page.tsx:35`).
  - Session cookie de 12 h, cierre por 30 min de inactividad y re-autenticación silenciosa con `enterPanel()`.
  - **Criterio:** al recargar el panel con sesión activa no aparece el login, y un turno de 8 h no pide credenciales.
- [x] **F1-16 · Cabeceras de seguridad adicionales** — `[CÓDIGO]` — S — Ref 4.14
  - `Permissions-Policy: camera=(self), geolocation=(), microphone=()` y `Cross-Origin-Opener-Policy: same-origin`.
  - **Criterio:** las cabeceras aparecen en securityheaders.com.

### 1D. Pagos
- [~] **F1-17 · Agregar `durationDays` a los planes** — `[CÓDIGO]` — S — Ref B3
  - Campo obligatorio en `planes` y en `components/admin/plan-modal.tsx`.
  - **Criterio:** ningún plan sin `durationDays` se puede guardar.
- [~] **F1-18 · Checkout autenticado con la pasarela local** — `[CÓDIGO]` — L — Ref 4.15, B1 — Depende de F0-01
  - Nuevo `POST /api/payments/checkout`: verifica el ID token, toma `uid` y email del token y crea `payments/{ref}` con `status: pending`, el snapshot de ítems y precios, el `planId` y el `requestId`.
  - Reemplazar `app/pago/page.tsx` por el widget o checkout de la pasarela (tarjeta, PSE, Nequi).
  - **Criterio:** el body del cliente no puede definir uid, email ni montos.
- [~] **F1-19 · Webhook idempotente y transaccional** — `[CÓDIGO]` — L — Ref B3, B4, 4.9
  - Verificar la firma o checksum.
  - Registrar el evento en `payment_events/{eventId}` y omitirlo si ya existe.
  - En una transacción: `pending → approved`, activar el plan con `planes/{planId}.durationDays`, descontar el stock con verificación y crear la orden con el precio del snapshot.
  - **Responder 5xx si algo falla.**
  - **Criterio:** reenviar el mismo evento 3 veces deja un solo efecto, y un fallo forzado provoca el reintento de la pasarela.
- [ ] **F1-20 · Stock insuficiente al aprobar el pago** — `[CÓDIGO]` — M — Ref 4.9
  - Si al aprobar no alcanza el stock: reembolso automático, notificación al admin y correo al cliente.
  - **Criterio:** dos compras simultáneas del último artículo terminan en una venta y un reembolso.
- [ ] **F1-21 · Reembolsos y contracargos** — `[CÓDIGO]` — M — Ref 4.15
  - Eventos de reembolso o anulación: revierten el plan (descuenta los días) o el stock, y dejan auditoría.
  - **Criterio:** un reembolso de prueba revierte el efecto y queda en `audit_logs`.
- [ ] **F1-22 · Conciliación de pagos pendientes** — `[CÓDIGO]` — S — Ref 4.15
  - Cron horario: los `payments` en `pending` con más de 1 h se consultan contra la API de la pasarela.
  - **Criterio:** un pago aprobado cuyo webhook se perdió queda activado en menos de 1 h.
- [ ] **F1-23 · Retirar Stripe y el código muerto** — `[CÓDIGO]` — S — Ref 4.15
  - Eliminar `app/api/stripe/*`, las dependencias `stripe` y `@stripe/*`, `BANCOS_PSE` y los dominios de Stripe en la CSP.
  - **Criterio:** `grep -ri stripe` no devuelve código activo.

### 1E. Storage y auditoría
- [~] **F1-24 · Subidas firmadas a Cloudinary** — `[CÓDIGO]`+`[CFG]` — M — Ref 4.21
  - Nuevo `POST /api/uploads/sign` (autenticado y con rate limit). Desactivar el preset sin firma.
  - Preset firmado: `jpg/png/webp`, ≤ 5 MB, conversión a WebP con ancho ≤ 1600. Video solo si se decide, con ≤ 20 MB y ≤ 30 s.
  - Agregar `https://api.cloudinary.com` a `connect-src`.
  - **Criterio:** una subida sin firma falla, y la subida desde el foro funciona en producción.
- [ ] **F1-25 · Borrar archivos huérfanos** — `[CÓDIGO]` — S — Ref 4.21
  - Guardar `publicId` en el post y borrar en Cloudinary desde el servidor al eliminarlo.
  - **Criterio:** al eliminar un post desaparece su archivo en Cloudinary.
- [~] **F1-26 · Auditoría con actor y cambios** — `[CÓDIGO]` — M — Ref 4.23
  - `recordAuditLog` exige `actorUid` y `actorEmail`, guarda `before/after` y el `requestId`, y toma la IP de `x-vercel-forwarded-for`.
  - Corregir `admin/planes`, que hoy no registra quién hizo el cambio.
  - **Criterio:** cada acción del admin muestra quién la hizo y qué cambió.

### 1F. Pruebas
- [ ] **F1-27 · Pruebas de reglas en el CI** — `[CÓDIGO]` — M — Ref 4.3
  - `@firebase/rules-unit-testing` con el emulador, cubriendo `users`, `posts` (y sus subcolecciones), `pqrs`, `orders`, `entry_logs` y `reportes`.
  - **Criterio:** el CI falla si una regla se relaja.
- [ ] **F1-28 · Pruebas del webhook** — `[CÓDIGO]` — M — Ref 4.3
  - Casos: idempotencia, firma inválida, stock insuficiente y fallo con 5xx.
  - **Criterio:** la suite pasa en el CI.
- [ ] **F1-29 · Reglas para `reportes` y `pqrs`** — `[CÓDIGO]` — S — Ref 4.20
  - Validar campos y tamaños con `hasOnly`. `reportante_id == auth.uid`.
  - **Criterio:** cubierto en F1-27.
- [ ] **F1-30 · Endurecer el CI de dependencias** — `[CÓDIGO]` — S — Ref 4.17 (A03)
  - Activar Dependabot y que `npm audit` falle con vulnerabilidades `high`.
  - **Criterio:** se abren PRs automáticos y el CI bloquea los `high`.

---

## FASE 2 — Datos, continuidad y trazabilidad (17 nov – 7 dic)

### 2A. Respaldo y recuperación
- [ ] **F2-01 · Backups diarios y PITR** — `[CFG]` — S — Ref B7, 4.2 — Depende de F0-02
  - Backup programado diario con retención de 14 días, PITR de 7 días y export mensual a un bucket GCS en otra región.
  - **Criterio:** el panel muestra el último backup con menos de 24 h.
- [ ] **F2-02 · Simulacro de restauración** — `[CFG]` — M — Ref 4.2 — Antes del 15-dic
  - Restaurar en staging, medir el RTO y documentarlo.
  - **Criterio:** RTO ≤ 4 h medido y registrado en `docs/runbook.md`.

### 2B. Ingresos (recepción)
- [~] **F2-03 · Ingreso transaccional en el servidor** — `[CÓDIGO]` — L — Ref 4.9, 4.23
  - `POST /api/recepcion/entry-log` recibe solo `{ qrToken | uid, source }`.
  - El servidor lee `users/{uid}`, calcula el estado del plan e impide duplicados con `entry_locks/{uid}_{fecha}` y una ventana configurable (3 h por defecto).
  - En la misma transacción escribe `entry_logs` (`authorizedByUid`, `authorizedByEmail`, `source`, `deviceId`) e incrementa `daily_stats` y `byHour`.
  - Eliminar las escrituras del cliente a `checkIns` y la colección en las reglas.
  - **Criterio:** escanear dos veces registra uno, y el cliente no puede alterar `hasPlanActivo`.
- [ ] **F2-04 · Pantalla de resultado del escaneo** — `[CÓDIGO]` — M — Ref 4.13
  - Pantalla completa verde (ACTIVO) o roja (VENCIDO o SIN PLAN), sonido distinto y días restantes.
  - Soporte para lector HID. Revisar `res.ok` antes de confirmar.
  - **Criterio:** si la API falla, la UI no dice "registrado".
- [ ] **F2-05 · QR firmado y dinámico** — `[CÓDIGO]` — L — Ref B6, 4.11
  - `GET /api/me/access-token` emite cada 24 h un token Ed25519 con `{uid, planExpira, iat, exp}`.
  - La PWA lo guarda y muestra el token más un código TOTP de 30 s.
  - Recepción verifica con la clave pública.
  - **Criterio:** una captura de más de 30 s se rechaza, y un QR válido se verifica sin red.
- [ ] **F2-06 · Modo offline de recepción** — `[CÓDIGO]` — L — Ref 4.11 — Depende de F2-05
  - Caché en IndexedDB de socios activos (uid, nombre, vencimiento), refrescada cada hora.
  - Cola de ingresos offline con IDs deterministas y sincronización al reconectar.
  - Indicador "OFFLINE — N pendientes".
  - **Criterio:** 30 min sin red no pierden ingresos y no generan duplicados.
- [ ] **F2-07 · Contingencia en papel** — `[CÓDIGO]` — S — Ref 4.11
  - Plantilla imprimible y carga posterior en el admin (`source: manual`).
  - **Criterio:** se puede cargar una planilla con su hora real.
- [ ] **F2-08 · Runbook** — `[CÓDIGO]` — S — Ref 4.11
  - `docs/runbook.md`: qué hacer si cae Vercel, Firebase, la pasarela o internet; cómo restaurar; cómo rotar una clave; contactos.
  - **Criterio:** el documento está revisado por el dueño.

### 2C. PWA
- [~] **F2-09 · Reescribir el service worker** — `[CÓDIGO]` — M — Ref 4.5
  - Navegación network-first con `/offline` de respaldo; estáticos cache-first; **`/api/*` nunca se cachea**.
  - Aviso "Nueva versión disponible". Registro desde un componente cliente y eliminación del `<script>` inline de `layout.tsx`.
  - **Criterio:** Cache Storage no contiene `/api/*` y el SW aparece registrado en producción.

### 2D. Observabilidad
- [ ] **F2-10 · Endpoint `/api/health`** — `[CÓDIGO]` — S — Ref 4.8
  - Comprueba Firestore, Redis y las variables críticas, y devuelve `200/503` con la latencia de cada uno.
  - **Criterio:** devuelve 503 si Firestore no responde.
- [ ] **F2-11 · Sentry en cliente y servidor** — `[CÓDIGO]`+`[CFG]` — M — Ref 4.8
  - Errores con `requestId` y sin PII.
  - **Criterio:** un error forzado aparece en Sentry con su `requestId`.
- [ ] **F2-12 · Uptime, página de estado y alertas** — `[CFG]` — S — Ref 4.8
  - Monitoreo cada 1 min de `/api/health` y `/`, con alerta por correo o WhatsApp al admin.
  - **Criterio:** una caída simulada genera la alerta en menos de 3 min.
- [ ] **F2-13 · Salud del negocio en el panel** — `[CÓDIGO]` — M — Ref 4.8
  - `system/cron.lastRun`, eventos de pago fallidos, `email_events` fallidos y última sincronización offline.
  - **Criterio:** el panel muestra una alerta si el cron no corre en 26 h.

### 2E. Esquema y migraciones
- [ ] **F2-14 · Framework de migraciones** — `[CÓDIGO]` — M — Ref 4.4
  - `migrations/NNN_*.ts` con `--dry-run` y la colección `_migrations`. Campo `schemaVersion`.
  - **Criterio:** volver a correr una migración no tiene efecto.
- [ ] **F2-15 · Índices versionados** — `[CÓDIGO]` — S — Ref 4.4
  - `firestore.indexes.json` en `firebase.json`. Crear índices compuestos y quitar los ordenamientos en memoria (`public/products`, `entry-log`).
  - **Criterio:** `firebase deploy --only firestore` despliega reglas e índices.
- [ ] **F2-16 · Normalizar el esquema** — `[CÓDIGO]` — M — Ref 4.1
  - `docs/schema.md` y `lib/types.ts`. Un solo idioma en los campos (`name`, `price`, `stock`, `durationDays`, `lowStockThreshold`), con su migración.
  - **Criterio:** no quedan respaldos `precio ?? price` en el código.
- [ ] **F2-17 · Quitar `persist` de `useAuthStore`** — `[CÓDIGO]` — S — Ref 4.1
  - Usar `onSnapshot` de `users/{uid}` como fuente de verdad.
  - **Criterio:** `localStorage` no contiene datos del perfil ni del plan.

### 2F. Consumo de base de datos
- [ ] **F2-18 · Recepción busca por UID** — `[CÓDIGO]` — S — Ref 4.6
  - Una sola lectura por escaneo, en lugar de `getDocs(collection('users'))`.
  - **Criterio:** abrir recepción no lee la colección `users`.
- [ ] **F2-19 · Calendario desde `daily_stats`** — `[CÓDIGO]` — S — Ref 4.6 — Depende de F2-03
  - **Criterio:** la consulta mensual hace como máximo 31 lecturas.
- [ ] **F2-20 · Panel admin eficiente** — `[CÓDIGO]` — M — Ref 4.6, 4.10, 4.13
  - `count()` para las PQRS, paginación con cursor en socios (sin `listUsers(1000)`) y carga de datos por pestaña.
  - **Criterio:** al abrir el admin se hacen solo las peticiones de la pestaña visible, y funciona con más de 1000 socios.
- [ ] **F2-21 · Home renderizado en el servidor** — `[CÓDIGO]` — M — Ref 4.6, 4.24
  - Planes y productos como Server Components con `revalidate`. Eliminar los `onSnapshot` públicos.
  - **Criterio:** el HTML inicial ya contiene planes y productos.
- [ ] **F2-22 · Paginación del foro con cursor** — `[CÓDIGO]` — S — Ref 4.6
  - Usar `startAfter` en lugar de aumentar el `limit`.
  - **Criterio:** "cargar más" lee solo la página nueva.
- [ ] **F2-23 · Cron de vencimientos sin N+1** — `[CÓDIGO]` — S — Ref 4.6, 4.7
  - `create()` con ID determinista (falla si ya existe) y `BulkWriter`.
  - **Criterio:** funciona con más de 500 socios.
- [ ] **F2-24 · Cierres de periodo de ventas** — `[CÓDIGO]` — M — Ref 4.7
  - Reemplazar `archive-sales` por `sales_periods/{YYYY-MM}` con totales calculados. Las órdenes no se modifican.
  - **Criterio:** los ingresos de cada mes se pueden consultar después del cierre.

### 2G. Trazabilidad y datos personales
- [ ] **F2-25 · Movimientos de inventario y eventos de correo** — `[CÓDIGO]` — M — Ref 4.23
  - Colecciones `inventory_movements` (venta, ajuste, conteo, con actor) y `email_events` (enviado o fallido).
  - **Criterio:** todo cambio de stock tiene su movimiento asociado.
- [ ] **F2-26 · Retención y borrado de socios** — `[CÓDIGO]` — M — Ref 4.1
  - Al borrar un socio: anonimizar posts, comentarios y entradas; conservar las órdenes 10 años.
  - Job que anonimiza entradas de más de 24 meses.
  - **Criterio:** después de borrar un socio no queda su PII fuera de `orders`.
- [ ] **F2-27 · Inventario de servicios** — `[CÓDIGO]` — S — Ref 4.12
  - `docs/servicios.md`: dueño, plan, límites, costo, rotación de credenciales y soporte.
  - **Criterio:** el documento está completo para los 7 servicios.
- [ ] **F2-28 · Importador CSV de productos** — `[CÓDIGO]` — M — Ref 4.10
  - Validación por fila y vista previa antes de confirmar.
  - **Criterio:** el catálogo inicial se carga desde un CSV.
- [ ] **F2-29 · Exportes del admin** — `[CÓDIGO]` — M — Ref 4.1, 5.5
  - Socios, órdenes y entradas por rango, en CSV y Excel.
  - **Criterio:** cada exporte respeta los topes de filas y de días.

---

## FASE 3 — Negocio, legal, push y SEO (8 – 21 dic)

### 3A. Estadísticas (funcionalidades pedidas)
- [ ] **F3-01 · Cierre diario y agregados mensuales** — `[CÓDIGO]` — M — Ref 5.2 — Depende de F2-03
  - Cron a las 23:59 America/Bogota: cierra `daily_stats` y consolida `monthly_stats` (visitas, únicos, media y hora pico).
  - **Criterio:** cada día tiene `closedAt` y cada mes tiene su resumen.
- [ ] **F3-02 · Mapa de concurrencia** — `[CÓDIGO]` — M — Ref 5.1
  - Heatmap día × hora (5:00–23:00) para 4, 12 o 52 semanas, y barras del día actual en tiempo real.
  - **Criterio:** el mapa resalta la franja pico, y un clic abre el diario (F3-04).
- [ ] **F3-03 · Medias por semana, mes y año** — `[CÓDIGO]` — S — Ref 5.2
  - Visitas y clientes únicos, con Δ % frente al periodo anterior.
  - **Criterio:** las cifras coinciden con un conteo manual de staging.
- [ ] **F3-04 · Diario de asistencia** — `[CÓDIGO]` — M — Ref 5.5
  - Total, únicos, hora pico, lista paginada, comparación con el mismo día de la semana anterior y exporte.
  - **Criterio:** se puede navegar por fecha desde el mapa.

### 3B. Recepción
- [ ] **F3-05 · Directorio de socios por estado** — `[CÓDIGO]` — M — Ref 5.3
  - `GET /api/recepcion/members?status=&q=&cursor=` con proyección mínima (nombre, foto, estado, vencimiento, días restantes).
  - Filtros: Activos, Por vencer, Vencidos y Sin plan.
  - **Criterio:** la respuesta no incluye peso, altura ni correo completo.
- [ ] **F3-06 · Inventario de solo lectura** — `[CÓDIGO]` — S — Ref 5.4
  - `GET /api/recepcion/inventory` (nombre, stock, umbral). Umbral por producto (`lowStockThreshold`).
  - **Criterio:** recepción ve el stock y no puede modificarlo.
- [ ] **F3-07 · Conteo físico con aprobación del admin** — `[CÓDIGO]` — M — Ref 5.4
  - Recepción reporta en `inventory_counts` y el admin aprueba el ajuste, que queda en `inventory_movements`.
  - **Criterio:** el stock solo cambia cuando el admin aprueba.
- [ ] **F3-08 · Alertas de inventario en tiempo real al admin** — `[CÓDIGO]` — S — Ref 5.4
  - `onSnapshot` de las notificaciones no leídas y push (F3-13) cuando el stock cruza el umbral.
  - **Criterio:** una venta que cruza el umbral avisa al admin en menos de 10 s.

### 3C. Legal
- [ ] **F3-09 · Páginas legales** — `[CÓDIGO]`+`[LEGAL]` — M — Ref 5.6 — Depende de F0-08
  - Rutas: `/legal/privacidad`, `/legal/terminos` (con retracto y reversión), `/legal/cookies` y `/legal/autorizacion-datos`.
  - Enlaces en el footer, el registro y el checkout.
  - **Criterio:** textos aprobados por el abogado y publicados.
- [ ] **F3-10 · Consentimientos en el registro** — `[CÓDIGO]` — M — Ref 5.6
  - Casilla obligatoria de términos y política, y casilla separada y opcional para datos sensibles.
  - Guardar `consents/{uid}_{tipo}` con versión, fecha, IP y user-agent.
  - Si el socio es menor de edad, pedir la autorización del representante.
  - **Criterio:** sin el consentimiento sensible no se guardan peso ni altura.
- [ ] **F3-11 · Derechos del titular en autoservicio** — `[CÓDIGO]` — M — Ref 5.6
  - "Descargar mis datos" (JSON), "Eliminar mi cuenta" (usa F2-26) y "Revocar autorización". PQRS con tipo "Datos personales".
  - **Criterio:** el usuario completa los tres flujos sin intervención del admin.
- [ ] **F3-12 · Facturación electrónica** — `[CÓDIGO]`+`[EXT]` — L — Ref 4.15 — Depende de F0-08 y F1-19
  - Emitir la factura con el proveedor DIAN al aprobar un pago y enviar el CUFE y el PDF al cliente.
  - **Criterio:** cada pago aprobado en staging genera su factura de prueba.

### 3D. Notificaciones push
- [ ] **F3-13 · Infraestructura push (FCM)** — `[CÓDIGO]` — L — Ref 5.7 — Depende de F2-09
  - Handler `push` y `notificationclick` en el SW, y tokens en `users/{uid}/push_tokens` con limpieza de los inválidos.
  - Guía de instalación en iOS (16.4 o superior, PWA en pantalla de inicio).
  - **Criterio:** llega un push de prueba en Android, en escritorio y en un iPhone con la PWA instalada.
- [ ] **F3-14 · Disparadores de push** — `[CÓDIGO]` — M — Ref 5.7
  - Ingreso registrado → socio (también como alerta antifraude).
  - Noticia publicada → tema `news`.
  - Plan por vencer (5 y 1 días) → **socio**.
  - Stock bajo, pago fallido o webhook en error → admin.
  - **Criterio:** cada disparador se probó en staging.
- [ ] **F3-15 · Preferencias de notificación y Ley 2300** — `[CÓDIGO]` — S — Ref 5.7
  - `users/{uid}.notificationPrefs` editable en el perfil, con caché local. El servidor las respeta.
  - Los mensajes promocionales solo salen en la franja legal.
  - **Criterio:** desactivar "noticias" detiene ese tipo de push, y un domingo no sale ningún promocional.

### 3E. Foro y contenido
- [ ] **F3-16 · Noticias administrables** — `[CÓDIGO]` — M — Ref 4.20
  - Colección `news` (crear, programar, despublicar) desde el admin, reemplazando el array `noticias` del código.
  - **Criterio:** una noticia nueva aparece en el foro y dispara un push.
- [ ] **F3-17 · Moderación de reportes** — `[CÓDIGO]` — M — Ref 4.20
  - Pestaña "Reportes" en el admin, auto-ocultar el post al llegar a N reportes y notificar al admin. Eliminar el `console.log` simulado.
  - **Criterio:** el admin resuelve un reporte y la acción queda auditada.

### 3F. SEO y rendimiento
- [ ] **F3-18 · robots, sitemap y metadata por página** — `[CÓDIGO]` — S — Ref 4.24
  - `app/robots.ts` (bloquea paneles, `/api`, `/perfil` y `/pago`), `app/sitemap.ts`, y `metadata` con Open Graph e imagen 1200×630 en cada página pública.
  - **Criterio:** Lighthouse SEO ≥ 90.
- [ ] **F3-19 · Datos estructurados y Google Business** — `[CÓDIGO]`+`[EXT]` — S — Ref 4.24
  - JSON-LD `ExerciseGym` con dirección en Barranquilla, horario y teléfono. Perfil de Google Business vinculado.
  - **Criterio:** el Rich Results Test da válido.
- [ ] **F3-20 · Imágenes e íconos de la PWA** — `[CÓDIGO]` — M — Ref 4.13
  - Quitar `images.unoptimized`, convertir a WebP o AVIF, renombrar sin espacios y generar íconos 192, 512 y maskable reales.
  - **Criterio:** Lighthouse Performance ≥ 85 en móvil y manifest válido.
- [ ] **F3-21 · Dividir el panel admin** — `[CÓDIGO]` — M — Ref 4.3
  - Rutas o pestañas con carga diferida: socios, ventas, inventario, PQRS, auditoría y estadísticas.
  - **Criterio:** ningún archivo de página supera las 400 líneas.

### 3G. Adiciones recomendadas
- [ ] **F3-22 · Recordatorio de renovación con enlace de pago** — `[CÓDIGO]` — S — Ref 6.2
  - Push y correo al socio con enlace directo al pago de su mismo plan.
  - **Criterio:** el enlace abre el checkout del plan correcto.
- [ ] **F3-23 · Ventas presenciales (POS) desde recepción** — `[CÓDIGO]` — M — Ref 6.5
  - Registrar en `orders` con `channel: pos` y descontar el stock.
  - **Criterio:** el inventario cuadra sumando las ventas web y las de mostrador.
- [ ] **F3-24 · Cierre de caja diario de recepción** — `[CÓDIGO]` — M — Ref 6.4
  - Resumen del turno: ingresos, ventas POS y diferencias de inventario.
  - **Criterio:** el cierre se puede exportar y queda auditado.
- [ ] **F3-25 · Congelamiento de plan** — `[CÓDIGO]` — M — Ref 6.3
  - El admin pausa un plan con motivo y fecha, y los días a favor se suman al reactivarlo.
  - **Criterio:** el vencimiento se recalcula correctamente.
- [ ] **F3-26 · Lista de socios en riesgo de abandono** — `[CÓDIGO]` — S — Ref 6.6
  - Socios activos sin ingresos en 14 días, en una vista del admin.
  - **Criterio:** la lista coincide con los datos de `entry_logs`.
- [ ] **F3-27 · Sistema multi-sede (si sigue el plan B2B)** — `[CÓDIGO]` — L — Ref 4.22
  - `tenantId` en todos los documentos y las reglas. **Decidirlo antes de la Fase 2** para no tener que migrar después.
  - **Criterio:** se toma la decisión y, si va, se implementa con pruebas de aislamiento.

---

## FASE 4 — Validación y congelamiento (22 dic – 3 ene)

- [ ] **F4-01 · Prueba de carga k6 de la hora pico** — `[CÓDIGO]` — M — Ref 4.10
  - Escenario: 30 ingresos en 15 min, 50 usuarios navegando y 5 pagos concurrentes, en staging.
  - **Criterio:** p95 < 800 ms y 0 errores.
- [ ] **F4-02 · Simulacro del plan B** — `[EXT]` — S — Ref 4.11
  - 30 min sin internet en recepción y luego sincronización. Probar también la planilla en papel.
  - **Criterio:** 0 ingresos perdidos y 0 duplicados.
- [ ] **F4-03 · Pagos reales de bajo monto** — `[EXT]` — S — Ref 4.15
  - Tarjeta, PSE y Nequi, más un reembolso de cada uno, verificando el plan, el stock, el correo y la factura.
  - **Criterio:** todos los flujos se completan de punta a punta.
- [ ] **F4-04 · Capacitación de recepción** — `[EXT]` — S — Ref 4.11
  - Escaneo, modo offline, contingencia en papel, inventario y conteo.
  - **Criterio:** cada recepcionista ejecuta un turno simulado.
- [ ] **F4-05 · Congelar el código y checklist de salida (29-dic)** — `[CÓDIGO]` — S
  - Verificar: B1–B10 cerrados, Fases 1 y 2 completas, backup restaurado, simulacro aprobado y legal publicado.
  - **Criterio:** checklist firmado por el dueño y despliegue a producción.

---

## Dependencias críticas (ruta crítica)

```
F0-01 pasarela ──► F1-18 checkout ──► F1-19 webhook ──► F1-20/21/22 ──► F3-12 facturación ──► F4-03
F0-02 Blaze ─────► F2-01 backups ──► F2-02 simulacro restauración
F2-03 ingreso transaccional ──► F2-19, F3-01 ──► F3-02/03/04 estadísticas
F2-05 QR firmado ──► F2-06 offline ──► F4-02 simulacro
F2-09 service worker ──► F3-13 push ──► F3-14/15/16/22
F0-08 legal ──► F3-09/10/11
```

**Riesgo de calendario:** la vinculación con la pasarela (F0-01) y los textos legales (F0-08) dependen de terceros. Si no avanzan en la semana 1, comprometen el go-live.

---

## Registro de ejecución

### 2026-10-20 — Rama `fix/fase1-criticos` (sin push ni deploy)

Verificado: `tsc --noEmit` y `next build` pasan. Pruebas manuales con `next start` (curl): la puerta del admin rechaza la cookie `gate=true`, una sesión falsa, una llave incorrecta y un token alterado; la llave correcta y el token firmado entran; `/api/security/success` ya no existe; `create-payment`, `me/companion` y `entry-log` exigen sesión; las cabeceras nuevas están presentes; el HTML ya no lleva el `<script>` inline del SW.

| Tarea | Hecho | Pendiente |
|---|---|---|
| F1-01 | `ignoreBuildErrors` eliminado (tsc limpio) | ESLint + `tsc` en el CI |
| F1-03 | `error.message` eliminado de todas las respuestas de `/api/*` | `requestId` |
| F1-04 | Lista blanca + tipos en `admin/planes` y `admin/products` (`lib/admin-validation.ts`); tope `limit ≤ 200` en `admin/logs`; `create()` evita sobrescribir productos | zod en el resto de rutas |
| F1-05 | `users.create` solo con campos conocidos y `plan == null`; `update` del dueño con lista blanca (cierra **B2**) | Quitar la lectura de `users` a recepción (F3-05) |
| F1-06 | El registro ya no envía `undefined` a Firestore | Alta desde el servidor y verificación de correo |
| F1-07 | Reglas: terceros pueden dar like (solo su uid) y AGREGAR comentarios propios; posts y reportes con tamaños y campos validados | Subcolecciones; hoy un tercero no puede editar ni borrar su comentario en un post ajeno |
| F1-08 | `PATCH /api/me/companion` (valida plan vigente); el perfil lo usa | — |
| F1-09 | El cambio de foto solo actualiza los posts propios (consulta por `autor_id`) | Resolver el avatar por autor al mostrar |
| F1-10 | `/api/security/success` y `clearRateLimit()` eliminados (cierra **B5**); el reinicio se hace en el servidor tras un login de panel verificado; IP confiable compartida (`lib/client-ip.ts`) | `@upstash/ratelimit` por uid, y `/api/security/attempt` sigue siendo voluntario |
| F1-12 | Cookie de puerta = token HMAC firmado (`lib/gate-token.ts`); la sesión ya no abre la puerta; comparación de la llave en tiempo constante; el logout cierra la puerta | La llave sigue viajando en `?key=` |
| F1-15 | `role=reception` → `recepcion`; sesión de recepción de 12 h | Cierre por inactividad |
| F1-16 | `Permissions-Policy` y `Cross-Origin-Opener-Policy` | — |
| F1-17 | El webhook toma la duración de `planes/{id}.days`; `days` es obligatorio al crear un plan (cierra **B3**) | — |
| F1-18 | `create-payment` exige ID token; uid y correo salen del token; los pagos de plan ya no arrastran los ítems del carrito | Migrar a la pasarela local |
| F1-19 | Webhook de productos idempotente (orden = id del PaymentIntent) y 5xx al fallar (cierra **B4** en Stripe); alerta de sobreventa | Reembolso automático (F1-20) |
| F1-24 | `https://api.cloudinary.com` en `connect-src` | Subidas firmadas |
| F1-26 | Auditoría con IP confiable; `admin/planes` registra el actor | `before/after` |
| F2-03 | `entry-log` deriva los datos del socio en el servidor, anti-duplicados de 3 h en transacción, registra quién autoriza, escribe `checkIns` (el cliente ya no puede) | `daily_stats` / `hourly_stats` |
| F2-09 | El SW no cachea `/api/*` ni los paneles; network-first en HTML; caché `v2` borra lo guardado; registro desde un componente cliente (el inline lo bloqueaba la CSP) | Aviso de nueva versión y página `/offline` |

**Acciones pendientes del dueño (no ejecutadas por ser despliegue a producción):**
1. Revisar y desplegar las reglas: `firebase deploy --only firestore:rules`. No se pudieron probar con el emulador (falta Java). Probarlas primero en staging o con el emulador.
2. Desplegar la rama en Vercel (preview) y probar: registro sin peso, like y comentario en un post ajeno, acompañante, pago de plan de prueba (se activan los días de `days`), escaneo doble en recepción (debe responder "ya registró").
3. Revisar que todos los planes existentes tengan `days`. Si falta, el webhook usa el respaldo por nombre (30/40/60).
