# PLAN DE MEJORA — FITMANIA

**Fecha:** 2026-10-20 · **Salida a producción:** enero 2027 (≈ 11 semanas)
**Alcance:** todo el código versionado (`app/`, `components/`, `lib/`, `services/`, `middleware.ts`, `firestore.rules`, `public/sw.js`, configuración).
**Escala de referencia:** ~100 ingresos/día, 1 recepcionista todo el día, admin 2 veces/día, clientes ≥ 1 vez/día.

---

## 1. Veredicto

**NO APTO PARA PRODUCCIÓN en su estado actual. Calificación global: 3.4 / 10.**

La base técnica (Next.js + Firebase + cookies de sesión revocables + CSP con nonce + claims) es correcta. Lo que impide salir a producción no es la escala (100 ingresos/día no exige nada a Firestore ni a Vercel), sino cinco problemas:

1. **Pagos:** Stripe no admite cuentas de comercios constituidos en Colombia, y la activación del plan depende del **nombre** del plan.
2. **Integridad de la membresía:** un cliente puede regalarse un plan desde el navegador, y el QR de ingreso es un dato fijo que se puede copiar.
3. **Pérdida de datos:** no hay copias de seguridad, ni plan B, ni monitoreo.
4. **Cumplimiento legal:** no hay política de tratamiento de datos (Ley 1581) aunque se guardan peso y altura (datos de salud), ni facturación electrónica.
5. **Funciones rotas:** el foro, el acompañante, la recepción y la PWA tienen fallos que hoy rompen el flujo normal.

---

## 2. Bloqueantes (resolver antes de cualquier otra cosa)

| # | Bloqueante | Evidencia | Severidad |
|---|---|---|---|
| B1 | **Stripe no opera con comercios colombianos.** Además solo acepta tarjeta: no hay PSE, Nequi ni Daviplata nativos | `app/api/stripe/create-payment/route.ts:90`, `app/pago/page.tsx:249` | CRÍTICA |
| B2 | **Un cliente puede crear su propio documento con `plan` arbitrario** (la regla `create` no restringe campos) | `firestore.rules:20`, `app/registro/page.tsx:125` | CRÍTICA |
| B3 | **El plan solo se activa si el nombre contiene "plan" o "mensualidad"**, y los días se deducen del nombre ("parejas" = 40, "dos en uno" = 60). Si el admin crea "Básico", se cobra y no se activa nada | `app/api/stripe/webhook/route.ts:180-184` | CRÍTICA |
| B4 | **Webhook de productos sin idempotencia y con errores silenciados.** Un reintento de Stripe descuenta el stock dos veces, y si falla la transacción se responde 200, Stripe no reintenta y la orden se pierde | `webhook/route.ts:83-177` | CRÍTICA |
| B5 | **Cualquiera puede reiniciar su contador de rate limit** con `POST /api/security/success`, sin autenticarse | `middleware.ts:135-143` | ALTA |
| B6 | **QR de ingreso = UID fijo.** Una captura de pantalla compartida da acceso indefinido | `app/perfil/page.tsx:241`, `app/fitception/page.tsx:94` | ALTA |
| B7 | **Sin copias de seguridad de Firestore** y sin procedimiento de restauración | No existe configuración | CRÍTICA |
| B8 | **Las credenciales filtradas en el historial nunca se rotaron** (decisión D-1 en `tareas-seguridad.md`) | `tareas-seguridad.md:8,31` | ALTA |
| B9 | **Sin política de datos ni consentimiento** para datos sensibles (peso, altura) | `app/registro/page.tsx:120` | CRÍTICA (legal) |
| B10 | **Plan de Vercel y de Firebase sin confirmar.** Vercel Hobby prohíbe el uso comercial, y Firebase Spark no permite backups programados | Verificar en los paneles | ALTA |

---

## 3. Calificación por área

| Área | Nota | Estado |
|---|---|---|
| Manejo de datos (persistencia y descarga) | 4 | Insuficiente |
| Riesgos de pérdida y dependencias | 2 | Crítico |
| Arquitectura | 5 | Aceptable con deuda |
| Migraciones | 1 | Inexistente |
| Offline | 2 | Contraproducente |
| Ahorro de consumo en BD | 5 | Patrones lineales; hoy barato |
| Backend general | 5 | Sin validación |
| Métricas de salud | 1 | Inexistente |
| Concurrencia y correlación | 4 | Duplicados posibles |
| Carga masiva | 3 | Topes silenciosos |
| Plan B ante caída | 1 | Inexistente |
| Servicios y su gestión | 4 | Sin inventario ni alertas |
| Lazy loading y UI/UX | 6 | Correcto, imágenes sin optimizar |
| Seguridad y cifrado | 5 | Buena base, huecos puntuales |
| Sistema de pagos (Colombia) | 2 | Bloqueante |
| Rate limiting | 3 | Evadible y nocivo en NAT |
| OWASP Top 10 | 4 | Fallas de control de acceso |
| Login | 5 | Sin MFA ni verificación de correo |
| Cumplimientos legales | 1 | Inexistente |
| Rutas protegidas y foro | 4 | Foro roto para no autores |
| Storage | 3 | Subida sin firma |
| Escalabilidad general | 6 | Suficiente para 1 sede |
| Trazabilidad de procesos | 4 | Actor anónimo en ingresos |
| SEO básico | 2 | Solo `<title>` raíz |

---

## 4. Hallazgos y soluciones por área

### 4.1 Manejo de datos — 4/10
**Hallazgos**
- Hay escrituras de negocio desde el cliente: `checkIns` (`fitception/page.tsx:158`), perfil (`perfil/page.tsx:81,162`), posts y comentarios (`foro/page.tsx:865-955`) y alta de usuario (`registro/page.tsx:125`). Las reglas de negocio quedan repartidas entre el navegador y el servidor.
- El esquema es inconsistente: `planes` usa `name/price` y `products` usa `nombre/precio` (con respaldo `price`, `create-payment/route.ts:49`).
- `useAuthStore` persiste el perfil y el plan en `localStorage` (`lib/store.ts:195`). Es PII en claro y queda desactualizada; el foro la usa para decidir quién es "premium" (`foro/page.tsx:881`).
- El registro envía `peso: undefined` / `altura: undefined` a `setDoc` (`registro/page.tsx:120-121`). El SDK web de Firestore rechaza `undefined`: si el usuario no llena esos campos, el registro falla después de crear la cuenta en Auth y deja un usuario huérfano.
- **Descarga:** solo se exportan los `entry_logs` de un día (JSON/Excel). No se pueden exportar órdenes, socios ni contabilidad, y el usuario no puede pedir ni borrar sus propios datos (derecho de habeas data).
- Al borrar un socio se elimina Auth y `users`, pero quedan su PII en `posts`, `orders`, `entry_logs` y `checkIns` (`api/admin/users/route.ts:123-125`).

**Solución**
1. Pasar todas las escrituras con reglas de negocio a route handlers o server actions, validadas con `zod`. El cliente solo escribe directo en campos inocuos del perfil (`username`, `avatar`).
2. Unificar el esquema: un documento `docs/schema.md` y tipos compartidos en `lib/types.ts`. Campos en un solo idioma (`name`, `price`, `stock`, `durationDays`).
3. Eliminar `persist` de `useAuthStore` y dejar Firestore (o `onSnapshot` del propio documento) como fuente de verdad.
4. Crear el documento de usuario en el servidor (`POST /api/users/register`) y omitir los campos vacíos.
5. Exportes del admin: socios, órdenes por rango y entradas por rango (ya existe `from/to` en la API pero la UI no lo usa). Para el usuario: "Descargar mis datos" y "Eliminar mi cuenta".
6. Política de retención: las órdenes se conservan 10 años (Código de Comercio, art. 60); las entradas se anonimizan después de 24 meses; en posts y comentarios se reemplaza el autor por "Usuario eliminado".

### 4.2 Riesgos de pérdida y dependencias totales — 2/10
**Inventario de dependencias (todas son puntos únicos de falla)**

| Servicio | Uso | Si cae / se pierde |
|---|---|---|
| Firebase Auth + Firestore | Identidad y **todos** los datos | Sistema inoperable y pérdida total si se borra el proyecto |
| Vercel | Hosting, API, cron | Sistema inoperable |
| Stripe | Pagos | No hay ventas (y no aplica en Colombia, ver B1) |
| Cloudinary (preset sin firma) | Imágenes del foro y perfil | Imágenes rotas |
| Resend | Correos | Sin recibos (el pago sí se registra) |
| Upstash Redis | Rate limit | Fail-open: protección apagada en silencio |

**Hallazgos**
- No hay backups: un `delete` de la consola, una regla mal desplegada o una cuenta comprometida (B8) significan pérdida total.
- Falta confirmar quién es dueño de las cuentas (Firebase, Vercel, Stripe, dominio). Si están a nombre del desarrollador, el negocio no controla su propio sistema.

**Solución**
1. Pasar Firebase a **Blaze** y activar **backups programados diarios** de Firestore (retención de 14 días) más **PITR (7 días)**. Una vez al mes, exportar a un bucket GCS de otra región y bajar una copia fría.
2. Hacer un **simulacro de restauración** antes del 15-dic-2026: restaurar a un proyecto de staging y medir el RTO.
3. Objetivos: **RPO ≤ 24 h** (≤ 1 min con PITR) y **RTO ≤ 4 h**.
4. Pasar las cuentas a nombre del negocio, con el desarrollador como miembro. Activar 2FA en todas y documentarlo en `docs/servicios.md`.
5. Configurar alertas de presupuesto en GCP, Vercel y Cloudinary.

### 4.3 Arquitectura — 5/10
**Hallazgos**
- Es un monolito Next.js en Vercel con Firebase como BaaS. Es adecuado para una sede, pero mezcla dos patrones de acceso (SDK cliente + reglas y Admin SDK + API) sin un criterio claro.
- Páginas cliente gigantes: `fitministration/page.tsx` (1205 líneas) y `foro/page.tsx` (983).
- `typescript.ignoreBuildErrors: true` (`next.config.mjs:12`) deja pasar errores de tipos a producción.
- `export const dynamic = 'force-dynamic'` en la raíz (`app/layout.tsx:11`) obliga a SSR en cada request (es el costo del nonce de la CSP). No hay estáticos ni caché de páginas.
- No hay pruebas automatizadas ni pruebas de reglas.

**Solución**
1. Capas: `app/api/*` (HTTP) → `lib/services/*` (dominio: membresías, ingresos, pagos, inventario) → `lib/repositories/*` (Firestore). Las rutas no tocan Firestore directo.
2. Quitar `ignoreBuildErrors` y corregir los errores. Agregar ESLint al CI.
3. Partir el panel admin en rutas o pestañas con carga diferida: `/fitministration/(socios|ventas|inventario|pqrs|auditoria|estadisticas)`.
4. Evaluar SRI/hashes (`experimental.sri`) para las páginas públicas y recuperar el renderizado estático. Mantener el nonce solo en los paneles.
5. Pruebas mínimas: reglas con `@firebase/rules-unit-testing` y el emulador; webhook (idempotencia); entry-log (duplicados). Todo en el CI existente.

### 4.4 Migraciones — 1/10
**Hallazgos:** no hay versionado de esquema, scripts de migración ni `firestore.indexes.json`. Los índices compuestos se esquivan ordenando en memoria (`api/public/products/route.ts:7-19`, `entry-log/route.ts:127-157`).

**Solución**
1. Carpeta `migrations/NNN_descripcion.ts`, ejecutadas con el Admin SDK y registradas en la colección `_migrations/{id}` (idempotentes, con `--dry-run`).
2. Campo `schemaVersion` en documentos críticos (`users`, `products`, `planes`).
3. Versionar `firestore.indexes.json` y desplegarlo junto con las reglas (`firebase deploy --only firestore`). Crear los índices compuestos en lugar de ordenar en memoria.
4. Primeras migraciones: normalizar `name/price` ↔ `nombre/precio`, agregar `durationDays` a `planes` y crear las colecciones de agregados (ver 5.1).

### 4.5 Offline — 2/10
**Hallazgos**
- `public/sw.js:38-48` usa **cache-first para todo GET del mismo origen**, incluidos HTML y `/api/*`. Las consecuencias:
  - Los JSON privados del admin (`/api/admin/users`, `/orders`, `/logs`) quedan guardados en Cache Storage del navegador.
  - Se sirven precios, stock y planes desactualizados para siempre (solo se invalidan al cambiar `CACHE_NAME`).
  - Se cachea HTML con un nonce de CSP viejo.
- El registro del SW es un `<script>` inline sin nonce (`app/layout.tsx:65-75`). Con `strict-dynamic` en producción, la CSP lo bloquea. **Probable: el SW nunca se registra en producción** (verificar en DevTools → Application).
- La recepción no funciona sin internet, y es justo la operación que no puede detenerse.

**Solución**
1. Reescribir el SW (o usar Serwist):
   - Navegación: network-first con fallback a `/offline`.
   - Estáticos `/_next/static` e imágenes: cache-first.
   - **`/api/*`: nunca cachear.**
   - Activar `skipWaiting` solo cuando el usuario acepte "Nueva versión disponible".
2. Registrar el SW desde un componente cliente (`useEffect`), sin script inline.
3. **Recepción offline** (detalle en 4.11): QR firmado verificable sin red, cola local de ingresos en IndexedDB y sincronización al reconectar.

### 4.6 Ahorro de consumo en base de datos — 5/10
Hoy el costo es despreciable (unos pocos miles de lecturas al día frente a las 50 000 gratis en Spark). El problema es que **todos estos patrones crecen linealmente con los socios**:

| Patrón | Ubicación | Lecturas por uso | Solución |
|---|---|---|---|
| Recepción descarga **toda** la colección `users` en cada carga | `fitception/page.tsx:67` | N socios por apertura o recarga | Buscar solo el UID escaneado (1 lectura) y un directorio paginado en el servidor |
| Calendario lee **todas** las entradas del mes para saber qué días tienen datos | `entry-log/route.ts:102-117` | ~3 000 por consulta | Doc agregado `daily_stats/{fecha}` (1 lectura por día del mes) |
| Contar PQRS leyendo toda la colección | `api/admin/stats/route.ts:26` | N | `count()` |
| `users` completo + `listUsers(1000)` en cada recarga del admin | `api/admin/users/route.ts:15-18` | N + N | Paginación con cursor |
| Cambiar la foto recorre **todos** los posts | `user-dropdown.tsx:47-48` | N posts | No desnormalizar el avatar: guardar `autor_id` y resolver en lectura (o un job en el servidor) |
| Home con `onSnapshot` de `planes` y `products` por visitante | `home/planes.tsx:29`, `home/productos.tsx:197` | Listener por visitante | Usar `/api/public/*` (ya tiene `s-maxage=60`) |
| Foro: "cargar más" sube el `limit` y relee todo | `foro/page.tsx:803-808` | Cuadrático | Cursor con `startAfter` |
| Cron de vencimientos: un `get()` por usuario (N+1) | `lib/notifications.ts:49,63` | 2N | `getAll()` o IDs deterministas con `create()` que falla si ya existe |

### 4.7 Backend general — 5/10
**Hallazgos**
- No se valida ningún input. Hay **mass assignment** en `PATCH/POST /api/admin/planes` y `/products`: se escribe `...data` tal cual (`planes/route.ts:35,63`, `products/route.ts:31,60`).
- Se filtra `error.message` al cliente en casi todas las rutas.
- `GET /api/admin/logs?limit=` no tiene tope (`logs/route.ts:11`).
- `archive-sales` y el cron usan un solo `batch`, que falla con más de 500 escrituras (`archive-sales/route.ts:23`, `notifications.ts:26`).
- "Archivar ventas" como cierre contable marca registros en lugar de calcular periodos: el "contador de ingresos" se pierde.
- Las versiones de la API de Stripe difieren entre archivos (`create-payment:6` vs `webhook:12`).

**Solución**
1. Esquemas `zod` por endpoint, con lista blanca de campos.
2. Un manejador de errores común: respuesta `{ error: 'mensaje genérico', requestId }` y detalle solo en logs.
3. Topes: `limit ≤ 200`. Usar `BulkWriter` en lugar de `batch`.
4. Reemplazar "archivar" por **cierres de periodo**: colección `sales_periods/{YYYY-MM}` con totales calculados. Las órdenes no se modifican.
5. Validar las variables de entorno al arrancar (`lib/env.ts` con zod) para fallar rápido y con un mensaje claro.

### 4.8 Métricas de salud — 1/10
**Hallazgos:** no hay endpoint de salud, captura de errores, alertas, uptime ni métricas de negocio. Solo `console.error` y Vercel Analytics, que mide visitas y no salud.

**Solución**
1. `GET /api/health`: comprueba Firestore (1 lectura), Redis (`PING`), la variable de Stripe y la del cron, y devuelve `200/503` con la latencia de cada uno.
2. **Sentry** (plan gratis) en cliente y servidor, con `requestId`.
3. **Uptime** (Better Stack o UptimeRobot) cada minuto sobre `/api/health` y `/`, con alerta por WhatsApp o correo al admin.
4. Métricas de negocio en el panel: webhooks fallidos (colección `stripe_events` con `status`), correos fallidos, ingresos del día frente a la media y última sincronización offline de recepción.
5. Alerta si el cron no corrió (guardar `lastRun` en `system/cron`).

### 4.9 Concurrencia y correlación — 4/10
**Hallazgos**
- **Ingresos duplicados:** escanear dos veces registra dos entradas (`entry-log/route.ts:33` usa un ID aleatorio). Eso infla el mapa de concurrencia que se pide.
- El ingreso son **dos escrituras no atómicas**: `checkIns` desde el cliente y `entry_logs` desde el servidor (`fitception/page.tsx:158-178`). Además el resultado del `fetch` no se revisa, así que la UI dice "registrado" aunque falle.
- El stock no se reserva: dos compras simultáneas del último artículo pasan la validación (`create-payment:56`) y el webhook lo deja en 0 sin avisar (`webhook:118`), es decir, sobreventa.
- No hay un ID de correlación entre la request, el log de auditoría, el pago y el correo.
- Sí está bien: la transacción idempotente en la activación del plan (`webhook:190-228`).

**Solución**
1. Ingreso en **una transacción en el servidor**: valida la membresía, impide duplicados (ventana configurable, p. ej. 3 h, con el doc `entry_locks/{uid}_{fecha}` o la consulta del último ingreso) y escribe `entry_logs` + el incremento de `daily_stats` + `hourly_stats`. Eliminar `checkIns`.
2. Stock: verificarlo dentro de la transacción del webhook. Si no alcanza, **reembolsar automáticamente** y notificar. Alternativa: reservar en `create-payment` con una expiración de 15 min.
3. `requestId` (UUID) generado en el middleware y propagado por header a los logs, `audit_logs` y la metadata del pago.

### 4.10 Carga masiva — 3/10
**Hallazgos**
- `listUsers(1000)` corta la lista **sin avisar** a partir de 1000 cuentas (`users/route.ts:15`, `stats/route.ts:16`).
- Los batches fallan con más de 500 escrituras (ver 4.7).
- No hay carga masiva del catálogo inicial (productos y planes), aunque el sistema arranca desde cero.
- No hay pruebas de carga.

**Solución**
1. Paginación con `pageToken` en `listUsers`, o mejor, leer socios solo desde Firestore.
2. Importador CSV de productos en el admin, con validación por fila y vista previa antes de confirmar.
3. Prueba de carga con **k6** antes del go-live: simular la hora pico (estimación: 30 ingresos en 15 min + 50 usuarios en la app + 5 pagos concurrentes) y medir p95 < 800 ms sin errores. A esta escala debería pasar holgado; el objetivo es detectar cuellos de botella de lógica, no de infraestructura.

### 4.11 Plan B si se cae el sistema — 1/10
**Hallazgos:** no existe. Si cae internet en la sede, Vercel o Firebase, la recepción no puede validar a nadie y no queda registro.

**Solución (por capas)**
1. **QR firmado verificable offline:**
   - El servidor emite al socio un token `{uid, planExpira, iat, exp}` firmado con **Ed25519**, que se renueva cada 24 h y se guarda en la PWA.
   - La recepción tiene la **clave pública** y verifica la firma y la vigencia sin red.
   - Para evitar capturas reenviadas, el QR mostrado incluye un contador TOTP de 30 s derivado del token.
2. **Cola offline en recepción:** los ingresos se guardan en IndexedDB y se sincronizan al reconectar con IDs deterministas (sin duplicados). Indicador visible: "OFFLINE — N ingresos pendientes".
3. **Caché local de socios activos** (solo `uid`, nombre y vencimiento), refrescada cada hora, para buscar manualmente.
4. **Contingencia en papel:** plantilla impresa (nombre, documento, hora, firma) y carga posterior desde el admin.
5. **Runbook** `docs/runbook.md`: qué hacer si cae Vercel, Firebase, la pasarela o internet; a quién llamar; cómo restaurar un backup; cómo rotar una credencial.
6. Página de estado pública (Better Stack) para que los socios sepan que es una falla conocida.

### 4.12 Servicios y su gestión — 4/10
**Hallazgos**
- Hay unas 25 variables de entorno sin validar al arrancar, y variables obsoletas pendientes (T-12).
- Upstash está pendiente de configurar (T-11-CFG): el rate limit está **apagado** si no existe.
- Resend sin dominio verificado solo envía al dueño de la cuenta (`services/mail.ts:8-10`).
- `MAIL_FROM` tiene por defecto `onboarding@resend.dev`.

**Solución**
1. `lib/env.ts` (zod) que falle el build o el arranque si falta una variable crítica.
2. Comprar un dominio propio y verificarlo en Resend (SPF, DKIM, DMARC).
3. `docs/servicios.md`: servicio, dueño de la cuenta, plan, límite gratuito, costo esperado, cómo rotar la credencial y contacto de soporte.
4. Rotación anual de credenciales e inmediata ante cualquier incidente.

### 4.13 Lazy loading y UI/UX — 6/10
**Bien:** `next/dynamic` en las secciones del home (`app/page.tsx:6-8`) y en el escáner QR (`fitception/page.tsx:14`).

**Hallazgos**
- `images.unoptimized: true` (`next.config.mjs:15`): se sirven originales (6.6 MB en `public/Imagenes`) y el ícono del manifest pesa 1.1 MB (`FitdogGRANDE.png`). Los nombres de archivo tienen espacios.
- El panel admin dispara 8 requests en paralelo en cada recarga (`fitministration/page.tsx:369-410`), aunque se vea una sola pestaña.
- Recepción: la sesión dura **1 hora** (`api/recepcion/login/route.ts:53`) para alguien que trabaja todo el día, así que tiene que volver a iniciar sesión unas 8 veces por turno.
- Recepción: `/api/auth/verify?role=reception` no coincide con el rol `recepcion` que espera la API (`fitception/page.tsx:35` vs `api/auth/verify/route.ts:25,45`). La sesión existente nunca se reconoce y siempre aparece el login.
- Recepción: no hay una señal inequívoca ACTIVO/VENCIDO (pantalla completa verde o roja + sonido); `expira.seconds` falla si el plan se guardó como fecha ISO (`fitception/page.tsx:167,226`).
- Los íconos del manifest son el mismo PNG declarado como 192 y 512.

**Solución**
1. Quitar `unoptimized`, convertir a WebP/AVIF, renombrar sin espacios y generar íconos PWA reales (192, 512 y maskable).
2. Cargar los datos del admin por pestaña.
3. Sesión de recepción de 12 h (turno) con cierre por inactividad de 30 min y re-autenticación silenciosa con `enterPanel()`.
4. Corregir `role=reception` → `role=recepcion`.
5. Resultado del escaneo a pantalla completa (verde/rojo), sonido distinto, días restantes del plan y soporte para lector QR por teclado (HID).

### 4.14 Seguridad y cifrado — 5/10
**Bien:** HSTS, CSP con nonce, session cookies HttpOnly revocables, claims verificados en el servidor, órdenes y logs escritos solo con el Admin SDK, y `npm audit` en el CI.

**Hallazgos**
- Credenciales filtradas sin rotar (B8). Es la única mitigación real; borrar el historial no invalida las copias que otros ya tengan.
- **La "llave" del admin no está en la base de datos ni hasheada:** es una variable de entorno comparada en texto plano y viaja en la URL (`?key=`, `middleware.ts:254,264`), así que queda en el historial del navegador, los logs y el Referer.
- **La puerta se puede saltar:** el middleware acepta la cookie `fitmania_admin_gate=true` o **cualquier** valor en `fitmania_session` (`middleware.ts:259,285`), y cualquiera puede poner esa cookie a mano. Los datos siguen protegidos por `verifyAdminRequest`, así que la puerta solo aporta oscuridad.
- PII sensible (peso, altura) sin minimizar, y legible por recepción (`firestore.rules:19`).
- La CSP `connect-src` no incluye `https://api.cloudinary.com` (`middleware.ts:68`). **Probable: las subidas de imágenes están bloqueadas en producción** (verificar).

**Solución**
1. **Rotar antes del go-live:** cuenta de servicio de Firebase, Stripe, Resend, Upstash, `ADMIN_GATE_KEY`, `RECEPTION_GATE_KEY`, `INTERNAL_MIDDLEWARE_SECRET`, `CRON_SECRET` y las contraseñas de las cuentas de Auth expuestas.
2. Puerta de admin: cookie **firmada con HMAC** y expiración, o eliminar la puerta y exigir MFA (ver 4.18). Si se mantiene la llave, guardarla **hasheada** (SHA-256 + `timingSafeEqual`), enviarla por POST (nunca en la URL) y rotarla.
3. Recepción solo lee nombre, estado del plan y vencimiento: un endpoint del servidor con proyección. Quitar `isReceptionist()` de la lectura de `users`.
4. Agregar `https://api.cloudinary.com` a `connect-src` (o mover la subida al servidor, ver 4.21).
5. Agregar `Permissions-Policy` (`camera=(self)`, `geolocation=()`) y `Cross-Origin-Opener-Policy: same-origin`.

### 4.15 Sistema de pagos (Colombia) — 2/10
**Hallazgos**
- Ver B1, B3 y B4.
- `create-payment` no exige autenticación y toma `uid`, `customerEmail` y `customerName` del body (`create-payment/route.ts:12,75-80`). Con eso cualquiera puede generar recibos de Stripe y correos de Resend hacia direcciones arbitrarias.
- El webhook toma el precio del producto **en el momento del webhook**, no el que se cobró (`webhook:97`).
- No se manejan `charge.refunded` ni `charge.dispute.*`: un reembolso no revierte el plan ni el stock.
- No hay **facturación electrónica DIAN**.
- La lista `BANCOS_PSE` del webhook es código muerto (Stripe no procesa PSE).

**Solución**
1. **Migrar a una pasarela local.** Recomendación: **Wompi** (Bancolombia): tarjetas, PSE, Nequi y Botón Bancolombia (verificar Daviplata), con webhooks firmados por checksum SHA-256 y liquidación en COP a una cuenta local. Alternativas: Mercado Pago o ePayco.
2. Nuevo flujo:
   - `POST /api/payments/checkout` **autenticado**: el `uid` y el email salen del token; se crea un doc `payments/{ref}` con `status: pending`, el **snapshot** de ítems y precios, y el `planId`.
   - El webhook: verifica la firma, registra el evento en `payment_events/{eventId}` (idempotencia), hace una transacción que cambia `pending → approved`, activa el plan con `planes/{planId}.durationDays` y descuenta el stock con verificación.
   - **Responde 5xx si algo falla**, para que la pasarela reintente.
3. Conciliación diaria (cron): pagos `pending` de más de 1 h se consultan contra la API de la pasarela.
4. Manejar reembolsos y contracargos: revertir el plan o el stock y dejar auditoría.
5. Facturación electrónica con un proveedor tecnológico autorizado por la DIAN (Alegra, Siigo, Facture) disparada al aprobar el pago. Confirmar con el contador el régimen del negocio.

### 4.16 Rate limiting — 3/10
**Hallazgos**
- B5: `/api/security/success` reinicia el contador sin autenticación.
- El login de Firebase va directo del navegador a Google, así que `/api/security/attempt` es **voluntario**: un atacante lo omite.
- **Riesgo operativo:** el límite es por IP (15 por hora). En la sede, decenas de socios comparten la IP pública del WiFi (NAT) y **se bloquean entre ellos** al iniciar sesión o pagar.
- Si Upstash no está configurado, todo es fail-open (`middleware.ts:120-125`).
- Escrituras directas a Firestore (posts, comentarios, reportes, PQRS) sin límite: se puede hacer spam.

**Solución**
1. Eliminar `/api/security/success` y `/api/security/attempt`. Limitar **en el servidor** y solo las acciones reales: login de paneles, checkout, registro y publicaciones.
2. Clave compuesta: `uid` cuando hay sesión; `IP + endpoint` solo para anónimos, con un umbral más alto. Usar `@upstash/ratelimit` (sliding window) en lugar de la lógica manual.
3. Activar **Firebase App Check** (reCAPTCHA Enterprise) y la protección contra enumeración y abuso de Identity Platform.
4. Fail-closed en los endpoints de admin si Redis no responde.

### 4.17 OWASP Top 10 (2025)
| Categoría | Estado | Hallazgo principal |
|---|---|---|
| A01 Broken Access Control | **FALLA** | `users.create` con plan libre (B2); puerta admin con cookie falsificable; recepción lee PII completa |
| A02 Security Misconfiguration | **FALLA** | `ignoreBuildErrors`; SW cachea APIs privadas; CSP sin Cloudinary; rate limit opcional |
| A03 Supply Chain | Parcial | `npm audit` solo falla en críticas; sin Dependabot ni lockfile-lint |
| A04 Cryptographic Failures | Parcial | Llave admin en texto plano en la URL; credenciales sin rotar |
| A05 Injection | OK | Firestore parametrizado; React escapa la salida |
| A06 Insecure Design | **FALLA** | QR estático; plan deducido del nombre; stock sin reserva; rate limit autodeclarado |
| A07 Authentication Failures | Parcial | Sin MFA para admin; sin verificación de correo |
| A08 Data Integrity Failures | **FALLA** | Webhook de productos sin idempotencia; datos de ingreso confiados al cliente (`entry-log:22`) |
| A09 Logging & Alerting | Parcial | Auditoría existe; IP falsificable (`audit-logger.ts:28`); sin alertas |
| A10 Exceptional Conditions | **FALLA** | Errores silenciados en el webhook (`webhook:174-176`); fail-open; `error.message` al cliente |

### 4.18 Login — 5/10
**Hallazgos**
- Sin MFA para el admin.
- Sin verificación de correo al registrarse.
- `RECEPTION_AUTHORIZED_EMAIL` admite **un solo correo** (`auth-helpers.ts:61`), lo que obliga a compartir credenciales entre recepcionistas y destruye la trazabilidad.
- El contador visual de intentos dibuja 5 puntos aunque el límite real es 15 (`pago/page.tsx:215`).

**Solución**
1. **MFA TOTP obligatorio** para cuentas con claim `admin` (Identity Platform). Login del admin por email y contraseña + TOTP.
2. Pedir `sendEmailVerification` antes de permitir compras y publicaciones.
3. Eliminar la lista de un solo correo: el claim `receptionist` (ya gestionado desde el admin) es la autorización. Una cuenta por persona.
4. Recuperación de cuenta del admin documentada (códigos de respaldo guardados offline).

### 4.19 Cumplimientos legales — 1/10
**Normas aplicables (Colombia)**
- **Ley 1581 de 2012 y Decreto 1377 de 2013** (habeas data): política de tratamiento, autorización previa, expresa e informada, finalidades, derechos ARCO y canal de consultas y reclamos con plazos (10 y 15 días hábiles).
- **Datos sensibles (art. 5):** peso y altura son datos de salud. Requieren autorización explícita y separada, y deben ser **opcionales**.
- **Menores de edad (art. 7):** si hay socios menores de 18, se necesita la autorización del representante legal.
- **Transferencia internacional:** Firebase, Vercel, Cloudinary y Resend almacenan fuera de Colombia, y eso debe declararse en la política.
- **Ley 1480 de 2011** (Estatuto del Consumidor): información de precios con impuestos incluidos, términos de venta, **retracto** (art. 47, ventas a distancia: 5 días hábiles) y **reversión del pago** (art. 51). Las PQRS ya existen y es correcto.
- **Ley 527 de 1999** (comercio electrónico): validez de la aceptación electrónica de términos.
- **Ley 2300 de 2023:** limita los horarios de mensajes comerciales y de cobranza. Las notificaciones push promocionales o de cobro deben respetar esa franja.
- **Facturación electrónica DIAN** (ver 4.15).
- **RNBD (SIC):** solo obligatorio si los activos superan 100 000 UVT. Verificar con el contador.

**Solución:** ver 5.6 (páginas legales, consentimientos y registro de autorizaciones). **Que lo revise un abogado**: este documento identifica obligaciones, no reemplaza asesoría legal.

### 4.20 Rutas protegidas y foro — 4/10
**Hallazgos**
- Las rutas protegidas están bien en el servidor: cada API de admin y recepción verifica la sesión y el claim.
- **Foro roto:** la regla `posts.update` solo permite al autor o al admin (`firestore.rules:30`). **Dar like o comentar en un post ajeno es rechazado.** Lo mismo pasa al actualizar el avatar en posts de otros (`user-dropdown.tsx:58-70`).
- **Acompañante roto:** `updateDoc('plan.acompanante')` (`perfil/page.tsx:81`) modifica la clave `plan`, que la regla prohíbe (`firestore.rules:23`).
- Comentarios embebidos en un array: límite de 1 MB por documento, y cualquiera que pueda escribir el doc reescribe comentarios ajenos (`foro/page.tsx:943-956`).
- `autor_is_premium`, `autor_username` y `autor_avatar` los declara el cliente: se puede suplantar el nombre y la insignia premium.
- No hay límite de longitud del contenido en las reglas.
- **Los reportes nunca se revisan:** se crean en `reportes` pero no hay ninguna vista en el admin. El "correo al administrador" es un `console.log` (`foro/page.tsx:215`).
- Las noticias están en el código (`noticias` en `foro/page.tsx`): el admin no puede publicarlas.

**Solución**
1. Comentarios en la subcolección `posts/{id}/comments/{cid}`: crea cualquier usuario autenticado y borra el autor o el admin.
2. Likes en `posts/{id}/likes/{uid}` (un documento por usuario), con un contador agregado en el servidor.
3. Reglas con validación: `contenido.size() <= 2000`, `autor_id == request.auth.uid`, campos permitidos con `keys().hasOnly([...])`. `autor_is_premium` lo calcula el servidor o se elimina.
4. Acompañante: endpoint del servidor `PATCH /api/me/companion`, que valida el plan.
5. Moderación: pestaña "Reportes" en el admin, ocultar post al llegar a N reportes y notificar al admin.
6. Noticias: colección `news` administrada desde el panel (crear, programar, despublicar) y conectada a push (5.7).

### 4.21 Storage — 3/10
**Hallazgos**
- Subida directa a Cloudinary con un **preset sin firma y público** (`services/cloudinary.ts:1-2,17-19`): cualquiera puede subir archivos a la cuenta del negocio y consumir su cuota.
- Sin validación de tipo y tamaño.
- Sin borrado de archivos huérfanos cuando se elimina un post.
- Video permitido sin límite.

**Solución**
1. Firmar las subidas: `POST /api/uploads/sign` (autenticado y con rate limit) devuelve `signature + timestamp`. Desactivar el preset sin firma.
2. En el preset firmado: formatos `jpg, png, webp` (video solo si es necesario, ≤ 20 MB y ≤ 30 s), máximo 5 MB por imagen, transformación a WebP de ancho máximo 1600 y moderación automática si el plan lo permite.
3. Guardar `publicId` en el post y borrar en Cloudinary al eliminarlo (desde el servidor).

### 4.22 Escalabilidad general — 6/10
**Verdict:** para **una sede con ~100 ingresos/día** la infraestructura sobra por varios órdenes de magnitud. No hace falta escalar infraestructura. Los límites reales son de lógica:
- `listUsers(1000)` y batches de 500 (ver 4.10).
- Lecturas completas de colecciones (ver 4.6).
- Un solo correo de recepción (ver 4.18).
- Sin multi-sede: si el plan comercial (B2B, `audit_report.md`) sigue en pie, se necesita `tenantId` en todos los documentos y en las reglas. **Diseñarlo antes de enero es más barato que migrar después.**

### 4.23 Trazabilidad de procesos — 4/10
**Hallazgos**
- `authorizedBy: 'Recepcionista'` es un texto fijo (`entry-log/route.ts:43`, `fitception/page.tsx:163`): no se sabe **quién** autorizó cada ingreso.
- `hasPlanActivo`, `planNombre` y `userName` los envía el cliente (`entry-log/route.ts:22`): el registro se puede alterar desde el navegador de recepción.
- Los cambios de plan y precio no guardan `adminEmail` (`planes/route.ts:41-47,69-75`).
- La IP de auditoría usa `x-forwarded-for`, que se puede falsificar (`audit-logger.ts:28`).
- Sin `requestId` ni registro de los cambios de stock manuales, los correos enviados o los eventos de pago.

**Solución**
1. `entry_logs`: el servidor deriva todo del doc `users/{uid}` y del token (`authorizedByUid`, `authorizedByEmail`, `source: qr|manual|offline`, `deviceId`).
2. `recordAuditLog` obligatorio con `actorUid`, `actorEmail`, `before` y `after` (diff) y `requestId`, tomando la IP de `x-vercel-forwarded-for`.
3. Colecciones de eventos: `payment_events`, `email_events` e `inventory_movements` (entrada, venta, ajuste, conteo físico, con actor).
4. Retención de auditoría de 5 años; solo el Admin SDK escribe (ya es así).

### 4.24 SEO básico — 2/10
**Hallazgos**
- Solo hay metadata en `app/layout.tsx:38-51`.
- Sin `robots.txt`, `sitemap.xml`, Open Graph, `canonical` ni metadata por página.
- Planes y productos se cargan en el cliente con `onSnapshot`, así que no están en el HTML que ven los buscadores.
- Sin datos estructurados.
- Sin títulos por ruta (`/planes`, `/tienda`, `/entrenadores` comparten el mismo `<title>`).

**Solución**
1. `app/robots.ts` (bloquear `/fitministration`, `/fitception`, `/api`, `/perfil`, `/pago`) y `app/sitemap.ts`.
2. `metadata` por página con título, descripción, Open Graph e imagen 1200×630.
3. Renderizar planes y productos en el servidor (Server Components que leen `/api/public/*` o Firestore Admin con `revalidate`).
4. JSON-LD `ExerciseGym` / `LocalBusiness` con dirección en Barranquilla, horario, teléfono y `priceRange`.
5. Perfil de **Google Business** enlazado al sitio. En un negocio local es la mayor palanca de SEO.

---

## 5. Funcionalidades solicitadas — diseño

**Base común:** todas dependen de agregados calculados en la **misma transacción del ingreso** (4.9). Así no se recorren colecciones y el costo es O(1).

```
daily_stats/{YYYY-MM-DD}  = { visits, uniqueMembers, byHour: { "05": n, ..., "22": n }, activeMembersAtClose, closedAt }
monthly_stats/{YYYY-MM}   = { visits, uniqueMembers, avgPerDay, peakHour }
entry_locks/{uid}_{fecha} = evita duplicados y permite contar únicos
```

### 5.1 Mapa de concurrencia
- Heatmap de **día de la semana × hora** (7 × 18 franjas, de 5:00 a 23:00) con los `byHour` de los últimos 4, 12 o 52 semanas.
- Vista en el admin con filtro de periodo y la franja pico resaltada. Barras del día actual en tiempo real (`onSnapshot` del doc de hoy, 1 listener).
- Costo: ≤ 365 lecturas para un año completo, que se pueden reducir con `weekly_stats`.

### 5.2 Medias (semana, mes, año)
- Distinguir **visitas** (ingresos) de **clientes únicos**. Mostrar ambas.
- Media diaria por semana, mes y año, comparada con el periodo anterior (Δ %). Se calcula desde `daily_stats` y `monthly_stats`.
- Un cron a las 23:59 (America/Bogota) cierra el día (`closedAt`), consolida el mes y calcula el pico.

### 5.3 Recepción: vista de socios con y sin membresía
- Ya existe un "Directorio" que solo muestra activos y descarga toda la colección (`fitception/page.tsx:226`). Reemplazarlo por `GET /api/recepcion/members?status=active|expired|none&q=&cursor=`.
- Devuelve solo: nombre, foto, estado, vencimiento y días restantes. **Sin peso, altura ni correo completo.**
- Filtros: Activos, Por vencer (≤ 5 días), Vencidos, Sin plan.

### 5.4 Recepción: inventario en solo lectura + aviso al admin
- `GET /api/recepcion/inventory`: nombre, stock y umbral. Sin precios de costo y sin escritura. Las reglas ya impiden escribir a quien no es admin.
- **Umbral por producto** (`lowStockThreshold`, que reemplaza el 5 fijo de `webhook:122`).
- **Conteo físico:** recepción puede **reportar** un conteo (`inventory_counts`) sin modificar el stock. El admin aprueba el ajuste, que queda en `inventory_movements`.
- **Tiempo real al admin:** cada venta o conteo que cruza el umbral crea una `notification` y envía un **push al admin** (5.7). En el panel, `onSnapshot` sobre `notifications` sin leer.

### 5.5 Diario de asistencia
- Es el `daily_stats/{fecha}` expuesto como vista: total, únicos, hora pico, lista paginada y comparación con el mismo día de la semana anterior.
- Conectado al mapa: un clic en una celda del heatmap abre el diario de ese día y esa franja.
- Export Excel o CSV por rango (reutilizar la exportación con `from/to`, que ya existe).

### 5.6 Páginas legales
- Rutas: `/legal/privacidad` (política de tratamiento, Ley 1581), `/legal/terminos` (términos y condiciones de servicio y venta, retracto, reversión), `/legal/cookies` y `/legal/autorizacion-datos`.
- Enlazadas desde el footer, el registro y el checkout.
- **Registro:** casilla obligatoria de términos y política, y casilla **separada y opcional** para datos sensibles (peso, altura). Sin la segunda no se guardan esos campos.
- **Prueba de autorización:** `consents/{uid}_{tipo}` con versión del documento, fecha, IP y user-agent. Es exigible ante la SIC.
- **Cookies:** hoy solo hay almacenamiento técnico (sesión de Firebase, carrito) y Vercel Analytics, que no usa cookies. Basta con un aviso informativo. Si se agrega analítica o publicidad con cookies, implementar un banner con opt-in.
- Self-service de derechos: "Descargar mis datos", "Eliminar mi cuenta" y "Revocar autorización", con un canal de habeas data vinculado a PQRS (tipo "Datos personales").

### 5.7 Notificaciones push (PWA)
- **Tecnología:** Firebase Cloud Messaging (Web Push con VAPID), integrado al SW reescrito (4.5).
- **iOS:** solo funciona si la PWA está **instalada en la pantalla de inicio** (iOS 16.4+). Mostrar una guía de instalación en iPhone.
- **Tokens:** `users/{uid}/push_tokens/{tokenId}` con plataforma y `lastSeen`. Limpiar los tokens inválidos que devuelve FCM.
- **Disparadores (en el servidor):**
  - **Ingreso registrado** → al socio: "Ingreso registrado 6:42 p. m. Tu plan vence en 12 días". Sirve además como **alerta antifraude** si alguien usa su QR.
  - **Noticia publicada** en el foro (colección `news`) → a los suscritos al tema `news`.
  - **Plan por vencer** (5 y 1 días) → **al socio**. Hoy solo se avisa al admin (`lib/notifications.ts`).
  - **Stock bajo, pago fallido o webhook en error** → al admin.
- **"Administrarlas de forma local":** preferencias por tipo (ingresos, noticias, vencimientos) controladas por el usuario desde su perfil. Se guardan en `users/{uid}.notificationPrefs` y en caché local, y el servidor las respeta antes de enviar. El admin crea, programa y cancela noticias desde el panel.
- **Legal:** solo las notificaciones transaccionales (ingreso, vencimiento) se envían en cualquier horario. Las promocionales respetan la franja de la **Ley 2300 de 2023** y el opt-in.

---

## 6. Adiciones propuestas (libertad creativa)

Ordenadas por relación valor/costo.

1. **QR dinámico firmado** (4.11). Cierra el fraude de compartir capturas y habilita el modo offline. **Imprescindible.**
2. **Recordatorio de renovación al socio** (push y correo) con enlace directo al pago del mismo plan. Impacta directo en los ingresos.
3. **Congelamiento de plan** (incapacidad, viaje) con días a favor y registro del motivo. Es frecuente en gimnasios y evita disputas.
4. **Cierre de caja diario de recepción:** ingresos del turno, ventas en mostrador (si se venden productos en físico) y diferencias de inventario.
5. **Ventas presenciales desde recepción** (efectivo o datáfono) con registro en `orders` como `channel: pos`. Sin esto, el inventario nunca cuadra porque solo descuentan las ventas web.
6. **Tasa de retención y abandono:** socios que no vienen en 14 días, enviados al admin como lista para contactarlos.
7. **Ambiente de staging** (proyecto Firebase y entorno Vercel separados) con datos falsos. Hoy no hay dónde probar sin tocar producción.

---

## 7. Hoja de ruta (20-oct-2026 → go-live 2027-01)

### Fase 0 — Decisiones (20–26 oct)
- [ ] Elegir la pasarela local (Wompi recomendado) e iniciar la vinculación comercial (tarda días o semanas: RUT, cuenta bancaria).
- [ ] Confirmar o migrar a **Vercel Pro** y **Firebase Blaze**, y traspasar las cuentas al negocio con 2FA.
- [ ] **Rotar todas las credenciales** (4.14 punto 1).
- [ ] Contratar la revisión legal (política, términos) y el proveedor de facturación electrónica.
- [ ] Crear el entorno de **staging**.

### Fase 1 — Integridad y seguridad crítica (27 oct – 16 nov)
- [ ] Reglas: `users.create` sin `plan`; recepción sin PII; posts con validación y subcolecciones; pruebas de reglas en el CI (B2, 4.20).
- [ ] Eliminar `/api/security/success` y `/attempt`; rate limit en el servidor por `uid`/IP; App Check (B5, 4.16).
- [ ] Puerta del admin con HMAC o eliminada + MFA TOTP para el admin (4.14, 4.18).
- [ ] Integrar la pasarela: checkout autenticado, `payments` con snapshot, webhook idempotente con 5xx al fallar, `durationDays` desde el plan, reembolsos (B1, B3, B4, 4.15).
- [ ] Quitar `ignoreBuildErrors`; validación `zod` en todas las rutas; errores genéricos (4.3, 4.7).
- [ ] Corregir: `role=recepcion`, `undefined` en el registro, acompañante, CSP Cloudinary, subidas firmadas (4.13, 4.1, 4.20, 4.21).

### Fase 2 — Datos, continuidad y trazabilidad (17 nov – 7 dic)
- [ ] Backups diarios + PITR + **simulacro de restauración** (B7, 4.2).
- [ ] Ingreso transaccional en el servidor: antiduplicados, `daily_stats`/`hourly_stats`, actor real (4.9, 4.23).
- [ ] QR firmado + modo offline de recepción + plantilla en papel + runbook (B6, 4.11).
- [ ] SW reescrito sin cachear `/api/*` (4.5).
- [ ] `/api/health`, Sentry, uptime y alertas (4.8).
- [ ] Migraciones versionadas, `firestore.indexes.json` y normalización del esquema (4.4).
- [ ] Eliminar lecturas de colecciones completas (4.6).

### Fase 3 — Negocio, legal y SEO (8 – 21 dic)
- [ ] Mapa de concurrencia, medias y diario (5.1, 5.2, 5.5).
- [ ] Directorio de socios e inventario de solo lectura para recepción + alertas al admin (5.3, 5.4).
- [ ] Páginas legales, consentimientos y derechos ARCO self-service (5.6).
- [ ] Push con FCM y preferencias del usuario (5.7).
- [ ] Facturación electrónica conectada al pago aprobado (4.15).
- [ ] SEO: robots, sitemap, metadata, JSON-LD, imágenes optimizadas (4.24, 4.13).

### Fase 4 — Validación y congelamiento (22 dic – 3 ene)
- [ ] Prueba de carga k6 de la hora pico (4.10).
- [ ] Simulacro del plan B: cortar internet en recepción durante 30 min y verificar la sincronización (4.11).
- [ ] Pagos reales de bajo monto con cada método (tarjeta, PSE, Nequi) y su reembolso.
- [ ] Capacitación a recepción (escaneo, modo offline, contingencia en papel).
- [ ] **Congelar código** el 29-dic. Desde ahí, solo correcciones críticas.

### Criterio de salida a producción
Todos los puntos B1–B10 cerrados, todas las tareas de la Fase 1 y la Fase 2 completas, un backup restaurado con éxito, el simulacro offline aprobado y la política legal publicada.

---

## 8. Supuestos a verificar
| Supuesto | Cómo verificar |
|---|---|
| El SW no se registra en producción por la CSP | DevTools → Application → Service Workers en el dominio de producción |
| Las subidas a Cloudinary se bloquean por `connect-src` | Consola del navegador al publicar una imagen en el foro en producción |
| Las reglas desplegadas coinciden con `firestore.rules` | Firebase Console → Firestore → Reglas (comparar) |
| Plan actual de Vercel y Firebase | Paneles de facturación |
| Hay socios menores de edad | Política del negocio |
| Daviplata está disponible en la pasarela elegida | Documentación comercial de la pasarela |
