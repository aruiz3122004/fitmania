# FITMANIA 💪 — Sistema de Gimnasio

> **Tu Pasión. Tu Fuerza.** Plataforma web completa para el gimnasio FITMANIA: venta de planes de membresía, tienda de suplementos/snacks/ropa, foro comunitario, sistema PQRS, panel de administración y estación de recepción con control de acceso por código QR.

Aplicación construida con **Next.js (App Router)** + **Firebase** + **Mercado Pago** (única pasarela), desplegada en **Vercel**.

---

## Índice

1. [Descripción general](#1-descripción-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Estructura del proyecto](#3-estructura-del-proyecto)
4. [Rutas y páginas](#4-rutas-y-páginas)
5. [Flujo de autenticación](#5-flujo-de-autenticación)
6. [Flujo de pago (planes y tienda)](#6-flujo-de-pago-planes-y-tienda)
7. [Panel de administración](#7-panel-de-administración)
8. [Panel de recepción](#8-panel-de-recepción)
9. [Tienda y carrito](#9-tienda-y-carrito)
10. [Foro comunitario](#10-foro-comunitario)
11. [Sistema PQRS](#11-sistema-pqrs)
12. [Modelo de datos en Firestore](#12-modelo-de-datos-en-firestore)
13. [Reglas de seguridad](#13-reglas-de-seguridad)
14. [Variables de entorno](#14-variables-de-entorno)
15. [Scripts y datos de prueba](#15-scripts-y-datos-de-prueba)
16. [Instalación y ejecución](#16-instalación-y-ejecución)
17. [Notas técnicas y despliegue](#17-notas-técnicas-y-despliegue)
18. [Pruebas](#18-pruebas)
19. [Deuda técnica conocida](#19-deuda-técnica-conocida)

---

## 1. Descripción general

FITMANIA es un **monolito Next.js** que combina:

- **Sitio público**: home con hero, planes, productos y entrenadores; página de tienda, planes, foro, PQRS y entrenadores.
- **Flujo comercial**: carrito de compras (zustand con persistencia en `localStorage`), checkout con **Mercado Pago Checkout Pro** (tarjeta, PSE, Efecty; moneda COP).
- **Backend**: API Routes de Next.js que usan el **Firebase Admin SDK** para operaciones privilegiadas (asignar admin, estadísticas, CRUD de productos, responder PQRS, notificaciones, archivar ventas).
- **Panel Admin**: dashboard con pestañas de resumen, usuarios, inventario, PQRS y compras, más exportación de datos y campana de notificaciones.
- **Panel Recepción**: control de ingresos físicos escaneando el código QR del miembro (búsqueda por UID) o simulando el escaneo, con registro de *check-ins*, historial de compras y directorio de miembros activos.
- **Comunidad**: foro con publicaciones, likes, comentarios y subida de imágenes.
- **Extras**: avatares estilo cómic.

La UI usa un **estilo cómic/superhéroe** (colores rojo/azul/amarillo, bordes gruesos negros, tipografías Bangers/Epilogue/Plus Jakarta/Space Grotesk) y componentes **shadcn/ui** con Tailwind CSS v4.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js **16.4.3** (App Router, React 19) |
| Lenguaje | TypeScript 5.7 |
| Estilos | Tailwind CSS v4 + shadcn/ui (Radix UI) + `tw-animate-css` |
| Estado global | zustand 5 (carrito, sesión, UI) |
| Backend/Firebase | Firebase 12 (Auth, Firestore) |
| Admin SDK | firebase-admin 13 (autoridad para webhooks y rutas API) |
| Pagos | **Mercado Pago Checkout Pro** (tarjeta, PSE, Efecty; API HTTP sin SDK) |
| Errores | Sentry por su API HTTP (sin SDK), activo con `SENTRY_DSN` |
| Correos | Resend (API HTTP, hasta 3 reintentos, envío en segundo plano) |
| Imágenes | Cloudinary (subida de avatares/perfil) |
| QR | `@yudiel/react-qr-scanner` + `react-qr-code` |
| Export a Excel | exceljs (exportación de ingresos de recepción) |
| Analytics | `@vercel/analytics` |
| Deployment | Vercel (`.vercel` presente) + Firebase (proyecto `fitmania-e1748`) |

---

## 3. Estructura del proyecto

```
fitmania/
├── app/                          # App Router de Next.js
│   ├── layout.tsx                # Layout raíz: fuentes, AuthProvider, Analytics
│   ├── page.tsx                  # Home (Topbar, Hero, Planes, Productos, Entrenadores, Footer)
│   ├── globals.css
│   ├── context/AuthContext.tsx   # AuthProvider (onAuthStateChanged de Firebase)
│   ├── api/                      # API Routes
│   │   ├── admin/
│   │   │   ├── login/route.ts         # POST: crea session cookie (ID token + claim admin)
│   │   │   ├── logout/route.ts        # POST: borra la cookie de sesión
│   │   │   ├── users/route.ts         # GET/PATCH/DELETE: CRUD usuarios + claims (admin/receptionist)
│   │   │   ├── products/route.ts      # GET/POST/PATCH/DELETE: CRUD productos
│   │   │   ├── orders/route.ts        # GET: órdenes no archivadas
│   │   │   ├── logs/route.ts          # GET: auditoría / rate limiting
│   │   │   ├── pqrs/route.ts          # GET: listar PQRS
│   │   │   ├── pqrs/respond/route.ts  # POST: responder PQRS + email + estado
│   │   │   ├── notifications/route.ts # GET/PATCH/DELETE: notificaciones (auto-gen planes a vencer)
│   │   │   └── archive-sales/route.ts # POST: archivar ventas (batch update)
│   │   ├── auth/verify/route.ts       # GET: valida session cookie (admin/recepción)
│   │   ├── auth/mfa/route.ts          # GET/POST: verificación en dos pasos por correo (estado, enviar, verificar, recuperar)
│   │   ├── cron/notifications/route.ts# GET: job de Vercel Cron (genera avisos de vencimiento)
│   │   ├── recepcion/
│   │   │   ├── login/route.ts         # POST: session cookie recepción (email + claim receptionist)
│   │   │   ├── logout/route.ts        # POST: borra la cookie de recepción
│   │   │   └── entry-log/route.ts     # GET/POST: historial de ingresos + export Excel/JSON
│   │   ├── security/
│   │   │   ├── check/route.ts         # GET: estado de rate limit
│   │   │   └── log-block/route.ts     # POST: registra bloqueos (secreto interno)
│   │   ├── payments/
│   │   │   ├── checkout/route.ts      # POST: crea payments/{ref} y la preferencia de Checkout Pro
│   │   │   ├── status/route.ts        # GET: estado de un pago propio (concilia si sigue pendiente)
│   │   │   └── mercadopago/webhook/route.ts # POST: aviso de Mercado Pago (firma x-signature)
│   │   ├── me/route.ts                # GET: descarga de datos del titular (perfil, compras, intentosDePago, ingresos…); DELETE: supresión de la cuenta
│   │   ├── me/profile/route.ts        # PATCH: nombre/avatar/foto + perfil público del foro
│   │   ├── me/purchases/route.ts      # GET: historial de compras del usuario (pagos MP + órdenes)
│   │   └── client-error/route.ts      # POST: errores de la UI → Sentry
│   ├── carrito/page.tsx           # Carrito de compras
│   ├── entrenadores/page.tsx      # Entrenadores
│   ├── fitception/page.tsx        # Panel de recepción — oculto (QR check-in)
│   ├── fitministration/page.tsx   # Panel de administración — oculto
│   ├── foro/page.tsx              # Foro con noticias + posts
│   ├── login/page.tsx             # Inicio de sesión
│   ├── pago/
│   │   ├── page.tsx               # Checkout: /pago?planId=… o el carrito → Mercado Pago
│   │   └── resultado/page.tsx     # Resultado del pago (redirect_status)
│   ├── perfil/page.tsx            # Perfil: avatar, datos, acompañante + botón de acceso al panel (roles)
│   ├── compras/page.tsx           # Historial de compras: resumen, filtros y detalle de cada pago
│   ├── planes/page.tsx            # Página de planes
│   ├── pqrs/page.tsx              # Formulario PQRS
│   ├── registro/page.tsx          # Registro de usuarios
│   └── tienda/page.tsx            # Tienda
├── components/
│   ├── admin/                     # admin-login-form, product-modal, plan-modal, audit-logs-tab
│   ├── home/                      # hero, planes, productos, entrenadores
│   ├── layout/                    # topbar, footer, user-dropdown
│   ├── recepcion/                 # reception-login-form, entry-history-tab
│   └── ui/                        # fit-avatar, comic-modal, section-header, dialog
├── lib/
│   ├── firebase.ts                # Cliente Firebase (browser)
│   ├── firebase-admin.ts          # Admin SDK lazy (server)
│   ├── auth-helpers.ts            # verifyAdminRequest / verifyReceptionRequest
│   ├── audit-logger.ts            # Registro de auditoría
│   ├── datetime.ts                # Fechas en America/Bogota (T-20)
│   ├── notifications.ts           # Generación de avisos de plan por vencer (T-18)
│   ├── panel-access.ts            # Acceso directo a paneles por rol (hook usePanelAccess + enterPanel)
│   ├── rate-limit-client.ts       # Helpers de rate limit (cliente)
│   ├── store.ts                   # zustand: carrito, auth, UI
│   ├── avatar-utils.ts            # Avatares (getAvatarUrlById)
│   └── utils.ts                   # cn() etc.
├── public/
│   ├── images/                    # gym1/2/3.jpg (hero/foro)
│   └── Imagenes/                  # productos, avatares, snacks, ropa
├── scripts/
│   ├── grant-admin.js             # Bootstrap: claim admin:true
│   ├── manage-claims.js           # Gestiona claims admin/receptionist (on/off)
│   └── simulate_sale.js           # Simula compra con Admin SDK
├── services/
│   ├── cloudinary.ts              # uploadToCloudinary()
│   └── mail.ts                    # Plantillas + envío por Resend (API HTTP, reintentos, logs [mail])
├── firestore.rules                # Reglas de seguridad Firestore
├── firebase.json / .firebaserc    # Config Firebase (proyecto fitmania-e1748)
├── vercel.json                    # Config de Vercel (cron de /api/cron/notifications)
├── proxy.ts                      # Proxy de Next 16 (antes middleware.ts): CSP con nonce, puertas, CSRF, rate limit
└── next.config.mjs                # images.unoptimized, allowedDevOrigins (túnel de pruebas)
```

> **Nota:** el proyecto real vive en la carpeta anidada `fitmania/fitmania/`. Este `readme.md` se encuentra en la raíz de esa carpeta (junto a `package.json`).

---

## 4. Rutas y páginas

| Ruta | Archivo | Descripción |
|---|---|---|
| `/` | `app/page.tsx` | Home: Hero + Planes + Productos + Entrenadores |
| `/registro` | `app/registro/page.tsx` | Crear cuenta (email/password, username, género, avatar) |
| `/login` | `app/login/page.tsx` | Iniciar sesión + recuperar contraseña |
| `/planes` | `app/planes/page.tsx` | Página de planes de membresía |
| `/tienda` | `app/tienda/page.tsx` | Catálogo de productos (suplementos, snacks, ropa) |
| `/carrito` | `app/carrito/page.tsx` | Carrito de compras → redirige a `/pago` |
| `/pago` | `app/pago/page.tsx` | Checkout con Mercado Pago (`/pago?planId=…` o el carrito) |
| `/pago/resultado` | `app/pago/resultado/page.tsx` | Pantalla de resultado según `redirect_status` |
| `/foro` | `app/foro/page.tsx` | Foro: noticias + posts con likes/comentarios |
| `/pqrs` | `app/pqrs/page.tsx` | Formulario de Peticiones/Quejas/Reclamos/Sugerencias |
| `/entrenadores` | `app/entrenadores/page.tsx` | Equipo de entrenadores |
| `/perfil` | `app/perfil/page.tsx` | Datos del usuario, avatar, acompañante del plan + botón de acceso al panel (solo roles) |
| `/compras` | `app/compras/page.tsx` | Historial de compras: planes y tienda (Mercado Pago y órdenes históricas), estado, reembolsos y recibo de cada pago. Lo arma `GET /api/me/purchases` con `lib/purchase-history.ts`; oculta los checkouts abandonados |
| `/fitministration` | `app/fitministration/page.tsx` | Panel admin — **oculto** (llave `?key=` o botón por rol + login con claim `admin`) |
| `/fitception` | `app/fitception/page.tsx` | Estación de recepción — **oculta** (llave `?key=` o botón por rol + login con email autorizado y claim) |

La navegación pública se define en `components/layout/topbar.tsx` (`navLinks`: Inicio, Tienda, Planes, Foro, Entrenadores, PQRS) y es la misma barra usada en todas las páginas junto con `Footer`.

---

## 5. Flujo de autenticación

### Registro (`/registro`)
1. El usuario llena el formulario (username, género, email, password y elige un avatar de cómic).
2. Se crea la cuenta con `createUserWithEmailAndPassword(auth, email, password)` (Firebase Auth).
3. Se crea el documento `users/{uid}` en Firestore con `setDoc`:
   ```js
   { username, gender, avatar, photoURL /* URL del avatar resuelta */, email, ... }
   ```
4. `AuthProvider` (`app/context/AuthContext.tsx`) escucha `onAuthStateChanged` y, al detectar el usuario, el `Topbar` carga los datos de `users/{uid}` y **sincroniza el store de zustand** (`useAuthStore`, persistido en `localStorage` con la clave `fitmania-auth`).

### Inicio de sesión (`/login`)
- `signInWithEmailAndPassword` → redirige a `/`.
- Incluye opción de recuperar contraseña (`sendPasswordResetEmail`).

### Verificación en dos pasos por correo (opcional, todas las cuentas)
Cualquier cuenta (socio, recepción o admin) puede activarla en **`/perfil` → Verificación en dos pasos**. Firebase Auth solo ofrece SMS y TOTP como segundo factor, así que el código por correo es propio (`lib/mfa.ts`, `lib/mfa-server.ts`, `/api/auth/mfa`):
1. **Activar:** el correo debe estar verificado. Se envía un código de 6 dígitos (vence en 10 min, 5 intentos, reenvío cada 60 s) y al confirmarlo se muestran **8 códigos de recuperación** de un solo uso, por si se pierde el acceso al correo.
2. **Iniciar sesión:** tras la contraseña se abre la ventana de verificación (`components/auth/mfa-gate.tsx`, global en el layout). El servidor marca como verificada **esa sesión** (el `auth_time` del token). Hasta 10 sesiones verificadas, para varios dispositivos.
3. **Dónde se exige:** en las APIs del usuario (`verifyUserRequest` y las rutas de pago, foto y foro), en los logins de los paneles y en las **reglas de Firestore** (`mfaOk()`). Cerrar la ventana no la salta: sin verificar, el servidor y la base de datos niegan el acceso.
4. **Desactivar:** desde `/perfil`, con un código enviado al correo.
- El código **no** va en copia al admin ni en el asunto (el asunto queda en `email_events`).
- El TOTP de Firebase que ya existía para el admin sigue funcionando: una sesión iniciada con TOTP cuenta como verificada. Con `ADMIN_REQUIRE_MFA=true` el admin necesita uno de los dos.
- **Requisito:** dominio verificado en Resend. En modo de pruebas el código solo llega al correo dueño de la cuenta de Resend.

### Sesión y estado
- El estado de sesión se mantiene en **dos lugares**:
  - `AuthContext` (React context) con el usuario de Firebase.
  - `useAuthStore` (zustand + persistencia) con el perfil enriquecido (`username`, `avatar`, `plan`, etc.) — es el que usan carrito, perfil, PQRS y demás.
- El logout limpia el usuario del store y de Firebase Auth.

### Roles
- **Usuario normal**: creado en Auth + documento `users/{uid}`.
- **Admin**: usuario con el **custom claim** `{ admin: true }` en Firebase Auth. Bootstrap: `node scripts/grant-admin.js <email>`.
- **Recepcionista**: usuario con el **custom claim** `{ receptionist: true }` (gestionado centralmente con `node scripts/manage-claims.js <email> receptionist on`; ya no se auto-otorga en el login, T-16).

> Los dos paneles internos son URLs **invisibles** (`/fitministration` y `/fitception`); no aparecen en el menú público y exigen primero la llave `?key=` (ver [§7](#7-panel-de-administración) y [§8](#8-panel-de-recepción)). Las cuentas con rol (`admin`/`receptionist`) además ven un **botón de acceso directo** en el menú de su cuenta y en **`/perfil`** (`lib/panel-access.ts`): reutiliza la sesión de Firebase ya activa e intercambia el ID token fresco por la cookie del panel en el servidor (sin llave ni re-login; el servidor re-valida el claim).

---

## 6. Flujo de pago (planes y tienda)

### 6.0 Mercado Pago (única pasarela, F1-18 a F1-22)
1. `/pago?planId=…` o `/pago` con el carrito → **`POST /api/payments/checkout`** con el ID token. El servidor calcula el monto (`lib/payments/pricing.ts`), guarda `payments/{fm_uuid}` en `pending` con la foto del checkout (ítems, precios, días) y devuelve la URL de Checkout Pro.
2. Mercado Pago avisa a **`POST /api/payments/mercadopago/webhook`**. Con `MERCADOPAGO_WEBHOOK_SECRET` se exige la firma `x-signature` (el proxy conserva el `x-request-id` original en `x-upstream-request-id`). El estado se lee siempre de la API con el access token.
   - Solo se procesan los avisos `?type=payment`. Los `merchant_order` y los del formato antiguo IPN (`?topic=`, cuya firma no se puede verificar) reciben 200 sin procesarse; el mismo pago llega firmado como `type=payment`.
   - La clave del webhook debe ser de **la misma aplicación del access token**. Con la de otra aplicación, la simulación del panel valida pero todos los pagos reales dan 401 "Firma inválida" (comprobado el 24-10 con Checkout Pro real).
3. `lib/payments/fulfillment.ts` aplica el resultado en **una transacción** (decisiones en `lib/payments/transitions.ts`, con pruebas):
   - aprobado → activa el plan (`days` del plan) o descuenta el stock, crea `orders/{ref}`, `inventory_movements` y la notificación; guarda `stockApplied`;
   - rechazado → `rejected` y correo; un reintento dentro del mismo checkout puede aprobarse después;
   - reembolso / contracargo → descuenta los días o repone **solo** las unidades que salieron;
   - monto o moneda distintos → `amount_mismatch` y alerta al admin, sin efecto;
   - sobreventa → reembolso parcial automático (F1-20).
4. **Conciliación** (`lib/payments/reconcile.ts`): al volver a `/pago/resultado` y en el cron diario (pendientes con más de 1 h, hasta 200 por ejecución con un presupuesto de 25 s; un checkout sin pagos en Mercado Pago vence a las 24 h, y si se paga después igual se aprueba).
   - Al volver, `/pago/resultado` consulta `GET /api/payments/status` durante unos 15 s (reintenta cada 3 s mientras siga pendiente) y muestra **pago exitoso**, **rechazado** (con "Intentar nuevamente"), **en proceso** (PSE o Efecty) o **pago no completado** si el cliente salió de Mercado Pago sin pagar (vuelve con `payment_id=null`; `lib/payments/return-state.ts`).
   - Si Mercado Pago no responde, se informa el estado guardado y el webhook o el cron lo completan.
   - Un checkout abandonado no cobra nada, no envía correos y no aparece en `/compras`.
5. El admin ve los pagos pendientes, rechazados, con monto alterado, vencidos y reembolsos en la pestaña **Pagos**, y puede conciliar uno a mano.
6. El socio ve su historial en **`/compras`** (`GET /api/me/purchases`): pagos de Mercado Pago y órdenes históricas, con estado, reembolsos, medio de pago y número de transacción.
7. Sin `MERCADOPAGO_ACCESS_TOKEN`, el checkout responde "no disponible" (503) y `/api/health` marca `payments: false` (crítico).

**Pruebas locales:** `MERCADOPAGO_PUBLIC_URL` = URL https de un túnel (`cloudflared tunnel --url http://localhost:3000`) para el retorno automático y el webhook. `MERCADOPAGO_API_URL` (solo desarrollo) apunta a un simulador de la API para probar escenarios sin navegador. Ninguna de las dos se define en Vercel.

### 6.1 Correos del pago
El correo de confirmación del plan o el recibo de la tienda lo envía el servidor al aprobarse el pago (nunca el cliente), **en segundo plano** con `after()` (`maxDuration = 30` en el webhook). `services/mail.ts` llama a la **API HTTP de Resend** con timeout de 15 s y **hasta 3 reintentos** con backoff (solo en `429`/`5xx`/error de red), con logs `[mail]`. Cada correo lleva una **copia oculta (BCC)** al admin, salvo los códigos de verificación en dos pasos.

### 6.2 Pruebas de pago
Con las credenciales de prueba de Mercado Pago y un **comprador de prueba** (Tus integraciones → Cuentas de prueba). El comprador no debe tener abierta la sesión del vendedor: Checkout Pro desactiva el botón de pagar sin mostrar error.

> **Stripe se retiró (F1-23).** Stripe no ofrece cuentas a comercios de Colombia. Las órdenes antiguas de Stripe que existan en `orders` se siguen mostrando en `/compras` y en el panel.

---

## 7. Panel de administración

### Acceso (`/fitministration`)
El panel vive en una URL **oculta** y protegida en dos capas (`components/admin/admin-login-form.tsx`):

1. **Puerta de llave**: al visitar `/fitministration` el proxy (`proxy.ts`) exige `?key=<ADMIN_GATE_KEY>` (o una cookie `fitmania_admin_gate` válida por 1 hora, o una sesión admin ya iniciada). Sin esto responde **404**. El formulario limpia la llave de la barra de direcciones tras entrar.
2. **Login real**: `signInWithEmailAndPassword` de Firebase, y luego `POST /api/admin/login` re-verifica en el servidor que el usuario tenga el **custom claim `admin: true`** y, si está definida, que el correo coincida con `ADMIN_AUTHORIZED_EMAIL`.

Si pasa ambas capas, el servidor crea una **cookie `HttpOnly`** (`fitmania_session`, 1 h) que las rutas `/api/admin/*` re-validan con `verifyAdminRequest`.

3. **Acceso directo (1 clic)**: las cuentas con rol `admin` ven un botón en el **menú de su cuenta** y en **`/perfil`** (`lib/panel-access.ts`, `enterPanel`). Reutiliza la sesión de Firebase ya activa enviando el ID token fresco a `POST /api/admin/login`, que crea la cookie y redirige al panel (sin llave ni contraseña; el servidor re-valida el claim y el correo).

> ¿Cómo hago que mi cuenta sea admin (primera vez)? `node scripts/grant-admin.js <email>` desde la carpeta del proyecto (lee `.env.local` y asigna `{ admin: true }`). Luego cierra sesión y vuelve a entrar para que Firebase emita un token con el claim.

### Dashboard (`app/fitministration/page.tsx`)
Pestañas:
- **Resumen (overview)**: estadísticas vía `GET /api/admin/stats` — total usuarios, admins, PQRS, y listado de usuarios; montos/formato COP; exportación **CSV/JSON**.
- **Usuarios (users)**: `GET /api/admin/users` combina Firebase Auth (`listUsers`) con Firestore; permite editar plan, otorgar/quitar admin y eliminar (borra de Auth **y** de Firestore).
- **Inventario (inventory)**: CRUD de productos contra `GET/POST/PATCH/DELETE /api/admin/products` con modal (`product-modal.tsx`).
- **PQRS**: listado y vista de detalle; responder con `POST /api/admin/pqrs/respond` → envía `sendPqrsReplyEmail` y marca `estado: 'resuelto'` con `respuesta_admin` y `fecha_respuesta`.
- **Compras (orders)**: `GET /api/admin/orders` (últimas 500, excluye archivadas), con opción **"Archivar ventas"** → `POST /api/admin/archive-sales` marca `archived: true` en lote con `batch`.

### Notificaciones (campana)
`GET /api/admin/notifications` hace **auto-generación** de avisos:
- Planes que vencen en **≤5 días** (`plan_expiry`, "vence en 5 días").
- Planes que vencen **≤1 día** (`plan_expiry`, "vence mañana").
- ID único por día (`plan5_{uid}_{fecha}`) para no duplicar.
- Además lee notificaciones existentes (`low_stock`, `purchase`) y las **marca como leídas** (`PATCH`) o **limpia las leídas** (`DELETE`).
- Al hacer clic lleva a la pestaña correspondiente (inventario/compras/PQRS).

Todas las rutas admin re-validan la sesión con `verifyAdminRequest` (cookie `HttpOnly` + claim `admin`). Cada acción queda en `audit_logs` con el actor (`actorUid`) y los cambios antes → después (F1-26).

---

## 8. Panel de recepción

Estación de control de ingresos del gimnasio en `/fitception` (URL también **oculta**).

### Acceso (doble capa) — `reception-login-form.tsx`
1. **Puerta de llave**: al visitar `/fitception` el proxy (`proxy.ts`) exige `?key=<RECEPTION_GATE_KEY>` (o cookie `fitmania_reception_gate` válida por 1 hora, o una sesión de recepción ya iniciada). Sin esto responde **404**.
2. **Login real**: `signInWithEmailAndPassword` de Firebase, y luego `POST /api/recepcion/login` exige que el correo coincida exactamente con **`RECEPTION_AUTHORIZED_EMAIL`** (si la variable no está definida, el servidor responde 500) **y** que la cuenta tenga el claim `receptionist: true` (T-16: ya no se auto-otorga; se gestiona con `manage-claims.js` o el panel admin).
3. **Acceso directo (1 clic)**: las cuentas con rol ven un botón en el **menú de su cuenta** y en **`/perfil`** (`lib/panel-access.ts`, `enterPanel`). Reutiliza la sesión de Firebase ya activa enviando el ID token fresco a `POST /api/recepcion/login`, que crea la cookie y redirige al panel (sin llave ni contraseña).

La sesión se guarda en la cookie `HttpOnly` `fitmania_reception_session` (1 h).

### Dashboard
- **Escáner QR**: con la cámara (`@yudiel/react-qr-scanner`) lee el **UID del usuario** (el documento de Firestore usa el UID como ID). También hay un **simulador** (select de usuarios) para probar sin cámara.
- Al escanear un UID válido muestra la **ficha del miembro**:
  - Foto/avatar, nombre, email, fecha de alta.
  - **Estado de membresía**: verde ✓ VIGENTE si `plan.expira` es futuro; roja ✗ VENCIDO si no; "Visitante (Sin Plan)" si no tiene plan.
  - **Historial**: últimas 5 compras (`orders` filtrando `uid`) y últimos 5 check-ins (`checkIns` por `userId`).
- **Autorizar ingreso**: crea un documento `checkIns/{auto}` con `{ userId, userName, timestamp, authorizedBy: 'Recepcionista' }` y lanza un toast de éxito.
- **Directorio**: lista de miembros con plan vigente, mostrando el nombre del plan y, si aplica, el **acompañante** (`plan.acompanante`: nombre y días permitidos).

---

## 9. Tienda y carrito

### Catálogo (`components/home/productos.tsx` y `/tienda`)
- Los productos se leen **en vivo** de Firestore (`collection('products')` con `orderBy('created_at','desc')` + `onSnapshot`), con categorías: `suplementos`, `snacks`, `ropa` (y más iconos: `entrenamiento`, `ofertas`, `salud`, `energia`, `premiun`).
- Cada tarjeta muestra imagen, precio COP, badge, colores/tallas (ropa) y estado **AGOTADO** si `stock <= 0`.
- "Agregar al carrito" → `useCartStore.addItem` (con color/talla para ropa; combinación por `id+color+talla`; si ya existe, incrementa cantidad).

### Carrito (`/carrito`)
- Lista items con cantidad editable, total en COP y vaciar carrito.
- "Pagar" → `router.push('/pago?concepto=Compra Fitmania&monto=${total}')`.
- Persistencia: zustand `persist` con clave `fitmania-cart` (versión 2, con migración que repinta `imagen_url` de las rutas correctas en `public/Imagenes/...`).

### Stock
- El stock **solo se descuenta en el webhook** (transacción sobre Firestore), no en el cliente — así no se puede "reservar" stock falsamente.

---

## 10. Foro comunitario

`/foro` (`app/foro/page.tsx`):
- **Noticias** (secciones) con imágenes locales (`/images/gym1.jpg`, etc.).
- **Posts** en la colección `posts`, en tiempo real con `onSnapshot`:
  - Crear post (texto + imagen opcional) — `addDoc` a `posts`.
  - **Likes**: `likes` es un array de UIDs; se actualiza con `arrayUnion`/`arrayRemove` → `toggleLike`.
  - **Comentarios**: `comentarios` array; se agregan con `arrayUnion` (con id, autor, contenido, fecha) y pueden editarse/eliminarse (filtro del array).
  - **Reportar**: `addDoc` a `reportes`.
- Las reglas de Firestore restringen la creación (autor_id == auth.uid, campos requeridos) y las actualizaciones solo a los campos `likes`/`comentarios` (ver §13).

---

## 11. Sistema PQRS

`/pqrs` (`app/pqrs/page.tsx`):
- Selección de tipo: **Petición**, **Queja**, **Reclamo**, **Sugerencia**.
- Requiere sesión; envía con `addDoc` a `pqrs`:
  ```js
  { tipo, mensaje, userId, userName, userEmail, fecha, hora, createdAt: serverTimestamp(), status: 'pending' }
  ```
- El **admin** responde desde el panel → correo automático + `estado: 'resuelto'` + `respuesta_admin` + `fecha_respuesta`.
- Los correos salen con las plantillas de `services/mail.ts` (`sendPqrsReplyEmail`, etc.).

---

## 12. Modelo de datos en Firestore

Proyecto Firebase: **`fitmania-e1748`** (`.firebaserc`).

| Colección | Documento | Campos principales | Escritores |
|---|---|---|---|
| `users` | `{uid}` (UID de Auth) | `username`, `email`, `gender`, `avatar`, `photoURL`, `peso`, `altura`, `plan` (`{nombre, precio, dias_total, inicio, expira, acompanante?}`) | Usuario (create/update de sí mismo), Admin, Webhook |
| `products` | `{id}` (slug: `creatina`, `proteina`, …) | `nombre`, `precio`, `categoria`, `imagen_url`, `descripcion`, `stock`, `colores`, `tallas`, `badge`, `created_at` | Solo Admin (webhook descuenta stock) |
| `orders` | `{ref}` de Mercado Pago (`fm_…`), `{paymentIntent.id}` de Stripe o automático (mostrador) | `uid`, `customerName`, `customerEmail`, `type`, `concepto`, `items[]` (`{id, nombre, precio, cantidad}`), `total`, `banco` (medio de pago, sin datos de tarjeta), `gateway`, `paymentId`, `fecha`, `status`, `refund?`, `amountRefunded?`, `archived?` | Solo webhook/Admin SDK |
| `payments` | `{ref}` (`fm_uuid`) | `uid`, `customerName`, `customerEmail`, `type`, `planId`, `concept`, `amount`, `dias`, `items[]`, `status` (`pending`, `approved`, `rejected`, `expired`, `refunded`, `charged_back`, `amount_mismatch`), `mpPaymentId`, `method`, `stockApplied?`, `createdAt`, `approvedAt` | Solo servidor (reglas: sin lectura ni escritura desde el cliente) |
| `payment_events` | `mp_{id}_{estado}` | bitácora de cada estado recibido de Mercado Pago | Solo servidor; lectura admin |
| `public_profiles` | `{uid}` | `username`, `photoURL`, `avatar` (lo que se ve en el foro) | Solo servidor (`PATCH /api/me/profile`); lectura pública |
| `posts` | `{auto}` | `autor_id`, `autor_username`, `autor_avatar`, `contenido`, `imagen_url`, `likes[]`, `comentarios[]`, `created_at` | Usuario autenticado |
| `pqrs` | `{auto}` | `tipo`, `mensaje`, `userId`, `userName`, `userEmail`, `fecha`, `hora`, `createdAt`, `status`, `respuesta_admin?`, `fecha_respuesta?` | Usuario (create) / Admin (update) |
| `notifications` | `{auto}` o `plan5_{uid}_{fecha}` | `tipo` (`low_stock`, `purchase`, `plan_expiry`), `mensaje`, `leido`, `fecha`, + ids (`id_producto`, `id_orden`, `uid`) | Admin SDK (webhook + auto-gen) |
| `checkIns` | `{auto}` | `userId`, `userName`, `timestamp`, `authorizedBy` | Recepción (cliente autenticado) |
| `reportes` | `{auto}` | reportes de posts del foro | Usuario autenticado |
| `logs` | `{auto}` | (reservada para logging/rate limiting) | Usuario autenticado |

---

## 13. Reglas de seguridad

### Firestore (`firestore.rules`, rules_version '2')
- Funciones auxiliares: `isSignedIn()`, `isAdmin()` (`request.auth.token.admin == true`), `isReceptionist()` (`request.auth.token.receptionist == true`).
- **`users/{uid}`**: read/update solo el dueño o admin; create del dueño; **delete prohibido** (el borrado se hace vía Admin SDK).
- **`posts`**: read público; create autenticado con `autor_id == auth.uid` y campos obligatorios (`hasAll([...])`); update solo de `likes`/`comentarios` (`affectedKeys().hasOnly`); delete por autor o admin (moderación).
- **`pqrs`**: read quien la creó o admin; create autenticado (`userId == auth.uid`); update/delete solo admin.
- **`logs`**: read solo admin; create autenticado; **update/delete prohibidos**.
- **`products`**: read público; write solo admin.
- **`orders`**: read el dueño (`uid`) o admin; **write solo admin** → solo el webhook (Admin SDK) o un admin crean órdenes.
- **`notifications`**: read/write solo admin.

> Importante: el webhook escribe Firestore con **Firebase Admin SDK**, que **omite las reglas de seguridad** (es código de servidor con credenciales). Las reglas protegen el acceso del cliente.

### Storage
Firebase Storage **no se usa** y su configuración fue eliminada (`storage.rules`, bloque `storage` de `firebase.json`, `getStorage`/`storage` en `lib/firebase.ts`). El deploy de reglas es solo `firebase deploy --only firestore:rules`.

> Todas las imágenes (avatares, foro) se suben a **Cloudinary** (`services/cloudinary.ts`, preset `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`) y la URL se guarda en `users/{uid}.photoURL` / `posts/{id}`.

---

## 14. Variables de entorno

Archivo: **`.env.local`** en `fitmania/fitmania/` (¡nunca subir a Git!). La plantilla comentada, con dónde se consigue cada valor, está en **`.env.example`**. Staging y respaldos: `docs/staging-y-respaldos.md`. Nombres usados por el código:

```env
# Firebase (cliente - browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin (server - cuenta de servicio)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=            # con saltos de línea; el código limpia comillas y \n

# Correos (Resend - https://resend.com/api-keys)
RESEND_API_KEY=                  # obligatorio; sin él no se envía ningún correo
MAIL_FROM=                       # remitente, p.ej. "Fitmania <no-reply@tudominio.com>"
                                 # sin dominio verificado solo permite "Fitmania <onboarding@resend.dev>"
                                 # y solo hacia el correo dueño de la cuenta (y suele caer en Spam)
ADMIN_COPY_EMAIL=                # opcional; BCC al admin en cada correo (por defecto ADMIN_AUTHORIZED_EMAIL)

# Puerta de acceso a paneles internos (urls /fitministration y /fitception)
ADMIN_GATE_KEY=
RECEPTION_GATE_KEY=

# Correos autorizados para el login de admin y recepción
ADMIN_AUTHORIZED_EMAIL=          # opcional; refuerza el login del admin (además del claim)
RECEPTION_AUTHORIZED_EMAIL=      # obligatorio para /fitception

# Rate limiting (Upstash Redis - opcional pero recomendado)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Secreto interno del proxy (protege /api/security/log-block; NO reusar el token de Upstash)
INTERNAL_MIDDLEWARE_SECRET=

# Secreto del cron de Vercel (protege /api/cron/notifications; Vercel lo envía como Bearer)
CRON_SECRET=

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=

# Mercado Pago (Tus integraciones → credenciales y Webhooks)
MERCADOPAGO_ACCESS_TOKEN=        # CRÍTICA. De prueba o de producción (ambos empiezan por APP_USR-)
MERCADOPAGO_WEBHOOK_SECRET=      # CRÍTICA. Clave del webhook (evento "Pagos") de la MISMA aplicación del access token; sin ella no se verifica la firma
MERCADOPAGO_PUBLIC_URL=          # SOLO desarrollo: URL https del túnel. No definir en Vercel
MERCADOPAGO_API_URL=             # SOLO desarrollo: simulador de la API. No definir en Vercel

# Sentry (opcional; sin DSN no se envía nada)
SENTRY_DSN=
```

La PRIVATE_KEY suele traer `\n` literales: `lib/firebase-admin.ts` los convierte en saltos reales y quita comillas para evitar el error *"Invalid PEM formatted message"*.

> **Variables obsoletas (eliminar):** `GMAIL_USER`, `GMAIL_APP_PASSWORD` (reemplazadas por Resend) y todas las de Stripe (`NEXT_PUBLIC_STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_PRODUCTION`): la pasarela se retiró. En Vercel deben replicarse **todas** las de este bloque (más `UPSTASH_*` si se usa el rate limiting). Tras editar variables en Vercel hay que **re-desplegar** (los cambios no aplican a deploys existentes).

---

## 15. Scripts y datos de prueba

| Script | Qué hace |
|---|---|
| `init_products.js` (raíz, solo local, no versionado) | Pobla la colección `products` con los 12 productos base (suplementos, snacks, ropa) leyendo credenciales de `.env.local`. |
| `scripts/grant-admin.js` | **Bootstrap del panel admin**: asigna el custom claim `admin:true` a un email/UID (`node scripts/grant-admin.js <email>`). Se usa una sola vez para habilitar el primer login de `/fitministration`. Fusiona con los claims existentes. |
| `scripts/manage-claims.js` | **Gestión de roles**: otorga/retira `admin` y `receptionist` (`node scripts/manage-claims.js <email\|uid> <admin\|receptionist> <on\|off>`). Al retirar un rol revoca los refresh tokens (invalida sesiones). Fusión de claims. |
| `scripts/simulate_sale.js` (solo local, no versionado) | Simula una venta completa con el Admin SDK: usuario+producto, descuenta stock, crea orden y notificaciones y activa un plan. ⚠️ **Tiene ruta fija** al JSON de la cuenta de servicio (`C:\Users\...\fitmania-e1748-firebase-adminsdk-*.json`) — ajustarla o migrarla a `.env.local`. |
| `scripts/verify-mail.mjs` | Diagnóstico de Resend. Sin flags: valida `RESEND_API_KEY` y lista dominios (no envía). Con `--send [--to=<correo>]`: envía un correo de prueba. |
| `scripts/check-product.mjs` | Lista productos con su `precio`/`stock` (diagnóstico de los campos `precio` vs `price`). |
| `scripts/check-orders.mjs` | Lista las últimas órdenes y el stock actual (verificación post-compra). |
| `scripts/clean-test-data.mjs` | Borra datos de prueba antes de la salida. Sin flags solo muestra qué borraría. `--scope=fake` (órdenes `sim_*`, `pi_mock_*`, `pi_lowstock_*`) o `--scope=prelaunch` (todo lo transaccional); borrar exige `--apply --project=<id de .env.local>`. |

> ⚠️ **La carpeta `scripts/` está en `.gitignore`**, por lo que estos scripts **no se versionan** (son herramientas locales de bootstrap/diagnóstico). Si se necesita reproducir la app desde cero, hay que recrearlos.

Para desplegar reglas: `firebase deploy --only firestore:rules` (proyecto `fitmania-e1748`). Firebase Storage no se usa y fue eliminado del proyecto y del código.

---

## 16. Instalación y ejecución

```bash
# 1. Posicionarse en la carpeta del proyecto (la que tiene package.json)
cd fitmania/fitmania

# 2. Instalar dependencias
npm install

# 3. Crear y llenar .env.local (ver §14)

# 4. Levantar en desarrollo
npm run dev        # → http://localhost:3000

# 5. (Opcional) Poblar productos
node init_products.js
```

Scripts de `package.json`:

| Script | Comando |
|---|---|
| Development | `npm run dev` |
| Build (producción) | `npm run build` |
| Start (producción) | `npm run start` |
| Lint | `npm run lint` |

> **Webhook local de Mercado Pago:** Mercado Pago no puede avisar a `localhost`. Sin túnel, el pago se confirma al volver a `/pago/resultado` (o en el cron). Para probar el webhook: `cloudflared tunnel --url http://localhost:3000` y poner esa URL https en `MERCADOPAGO_PUBLIC_URL` (solo `.env.local`).

---

## 17. Notas técnicas y despliegue

### Configuración de Next.js (`next.config.mjs`)
```js
{ poweredByHeader: false, allowedDevOrigins: ['*.trycloudflare.com'], images: { unoptimized: true } }
```
- Los errores de TS **sí bloquean** el build (`ignoreBuildErrors` ya no está).
- Las imágenes se sirven sin optimización (necesario para las rutas locales de `public/Imagenes/...`).

### Confirmación del pago
La única fuente de verdad es el servidor: el webhook de Mercado Pago, el regreso a `/pago/resultado` y el cron consultan el pago a la API de Mercado Pago y lo aplican en una transacción idempotente (§6). El cliente **no escribe** el campo `plan` en Firestore (T-06).

### Seguridad del admin
- Acceso en dos capas: **puerta de llave** (`?key=ADMIN_GATE_KEY` en el proxy) + **login Firebase** que exige el custom claim `admin:true` (y `ADMIN_AUTHORIZED_EMAIL` si está definida).
- El **botón de acceso directo** (`lib/panel-access.ts`, menú de cuenta + `/perfil`) no agrega confianza nueva: reutiliza el ID token de la sesión ya activa y el servidor **re-valida el claim** en `POST /api/admin/login` antes de crear la cookie.
- El claim `admin:true` se asigna con `node scripts/grant-admin.js <email>` o `node scripts/manage-claims.js <email> admin on`.
- La sesión usa **session cookies de Firebase** (`createSessionCookie` + `verifySessionCookie(..., checkRevoked)`) → revocables (T-15). La cookie es `HttpOnly` `fitmania_session` (1 h). Las APIs del admin **solo** aceptan esa cookie (se quitó la vía `Authorization: Bearer`, que no revisaba revocación ni la verificación en dos pasos).
- **Todas** las rutas `/api/admin/*` re-validan la sesión con `verifyAdminRequest` (incluida `/api/admin/planes`, T-05).
- Las reglas de Firestore bloquean cualquier intento de escritura no admin en `products`, `orders` y `notifications`.

### Seguridad de recepción
- Doble capa: **puerta de llave** (`?key=RECEPTION_GATE_KEY` en el proxy) + **login Firebase** que exige que el correo coincida con `RECEPTION_AUTHORIZED_EMAIL` **y** que la cuenta tenga el claim `receptionist:true`.
- El **botón de acceso directo** (`lib/panel-access.ts`, menú de cuenta + `/perfil`) no agrega confianza nueva: reutiliza el ID token de la sesión ya activa y el servidor **re-valida el claim y el correo** en `POST /api/recepcion/login` antes de crear la cookie.
- El claim `receptionist` **ya no se auto-otorga** en el login (T-16): se gestiona centralmente (panel admin o `node scripts/manage-claims.js <email> receptionist on`). Al retirarlo se revocan las sesiones del usuario.
- La sesión vive en la cookie `HttpOnly` `fitmania_reception_session` (session cookie de Firebase, 1 h, revocable).

### Cabeceras de seguridad y CSP (T-17)
- `proxy.ts` aplica **CSP con nonce por request**, más `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` y HSTS (solo producción).
- En **producción** `script-src` usa `'self' 'nonce-…' 'strict-dynamic'` (sin `'unsafe-inline'`/`'unsafe-eval'`); en **desarrollo** se mantienen `'unsafe-eval'`/`'unsafe-inline'` para el HMR. `style-src` conserva `'unsafe-inline'` (la UI usa estilos inline).
- El nonce exige **renderizado dinámico**: `app/layout.tsx` exporta `dynamic = 'force-dynamic'`, por lo que todas las rutas son `ƒ` (server-rendered on demand).

### Notificaciones programadas (T-18)
- La generación de avisos de "plan por vencer" vive en `lib/notifications.ts` y la dispara **Vercel Cron** (`vercel.json`, diario `0 12 * * *` → `/api/cron/notifications`).
- La ruta exige `Authorization: Bearer $CRON_SECRET` (401 si falta). El `GET /api/admin/notifications` del panel es **solo lectura**.

### Despliegue
- La app vive desplegada en **Vercel** (`.vercel`, proyecto `fitmania`): producción en **https://fitmania-seven.vercel.app**. Cada push a `main` despliega solo y cada PR genera un preview.
- Firebase (Auth + Firestore y sus reglas) en el proyecto **`fitmania-e1748`**.
- Para nuevos entornos, configurar las variables de §14 en el dashboard de Vercel.
- **Orden obligatorio:** primero el código (merge a `main`) y, apenas quede *Ready*, `npx firebase deploy --only firestore:rules,firestore:indexes --project fitmania-e1748`. Las reglas actuales cierran escrituras que usaba el código anterior.
- Después del deploy, ejecutar las migraciones pendientes en el panel admin → Sistema (primero "Simular").
- **Estado al 24-10-2026:** la rama `fix/fase1-criticos` está en el **PR #1** (CI en verde), con el deploy previsto para el 25-10. Producción ya tiene todas las variables críticas; las recomendadas que faltan y el paso a paso están en `plan-24-10-2026.md` §4 y en `docs/checklist-salida.md`.

### Archivos auxiliares
- `deep_diag.js`, `fix_env.js`, `tmp_check_key.js`, `tmp_fix_key.js`: utilidades de diagnóstico temporales en la raíz (no forman parte del flujo de la app).

---

## 18. Pruebas

Todo se puede probar en local (`npm run dev` → `http://localhost:3000`). Mantén la terminal del servidor a la vista: los logs de correo (`[mail]`, `[webhook]`) salen ahí.

### Acceso directo por rol (botón, sin llave)
1. Login en `/login` con la cuenta admin → el menú de cuenta y `/perfil` muestran el botón rojo **"Panel de Administración"**. Clic → llegas a `/fitministration` ya dentro (sin `?key=` ni contraseña).
2. Repetir con la cuenta de recepción → botón verde **"Panel de Recepción"** → llegas a `/fitception` ya dentro.
3. Con un usuario normal (sin claim) **no aparece ningún botón** ni en el menú ni en `/perfil`.
4. En incógnito y sin sesión, `/fitception` y `/fitministration` responden **404** (la puerta por llave sigue protegiendo el acceso directo por URL).
> Si el botón no aparece, cierra sesión del sitio y vuelve a entrar (el token en caché puede no traer el claim todavía).

### Correos (Resend)
1. Como usuario normal, crea una **PQRS** en `/pqrs` con un correo cuya bandeja puedas revisar.
2. Como admin (entra con el botón nuevo), responde ese ticket desde la pestaña **PQRS** del panel.
3. En la terminal debe salir `[mail] Enviado a <correo> (id: ..., intento 1/3)` y el correo debe llegar (revisar también **spam**).
4. Requisitos de Resend: `RESEND_API_KEY` configurada y `MAIL_FROM` de un **dominio verificado** (DNS).
5. Diagnóstico rápido: `node scripts/verify-mail.mjs` valida la API key y lista los dominios (no envía correo); `node scripts/verify-mail.mjs --send [--to=<correo>]` envía una prueba.

> ⚠️ **Modo test de Resend (sin dominio verificado):** el servidor **solo entrega a `andreselgameroscuro@gmail.com`** (dueño de la cuenta). Enviar a cualquier otro correo responde **403** (definitivo, sin reintentos) y la UI **no falla**: en PQRS el ticket ya quedó resuelto en Firestore y en compras la orden ya quedó creada. Además, al usar `onboarding@resend.dev`, Gmail suele mandarlo a **Spam**. Para enviar a clientes y llegar a Inbox → verificar dominio (SPF/DKIM/DMARC) y cambiar `MAIL_FROM`.

### Pago completo + correo (avanzado)
1. Credenciales de **prueba** de Mercado Pago en `.env.local` y un túnel (`MERCADOPAGO_PUBLIC_URL`, ver §16) con el webhook configurado en *Tus integraciones → Webhooks* (evento *Pagos*, clave de la misma aplicación).
2. Compra en `/pago` con el **comprador de prueba** (sin la sesión del vendedor abierta).
3. Verifica: `[mp-webhook] … approved` en la terminal, orden y stock en Firestore, `[mail] Enviado...` y el pago en la pestaña **Pagos** del admin.
4. Para inspeccionar Firestore: `node scripts/check-orders.mjs` (últimas órdenes y stock).

---

## 19. Deuda técnica conocida

Puntos asumidos conscientemente o pendientes de cerrar. **Ninguno bloquea el funcionamiento actual**, pero conviene resolverlos por orden de impacto.

| # | Deuda | Impacto | Acción sugerida |
|---|---|---|---|
| 1 | **Resend en modo test** — sin dominio verificado solo entrega a `andreselgameroscuro@gmail.com` y suele caer en Spam | 🔴 Alto | Verificar dominio (SPF/DKIM/DMARC) y cambiar `MAIL_FROM` a `no-reply@tudominio`. Ver §18. |
| 2 | ~~Stripe en modo test~~ — **cerrado**: Stripe se retiró (F1-23) | ✅ | — |
| 3 | ~~Webhook de Stripe con lógica duplicada~~ — **cerrado**: Mercado Pago es la única pasarela | ✅ | — |
| 4 | **Campo `precio` vs `price`**: productos usan `precio`, planes usan `price`; `create-payment` lee `precio ?? price` como parche | 🟡 Medio | Unificar a un único nombre de campo en productos y planes (migración + código). |
| 5 | ~~ESLint no está instalado~~ — **cerrado**: `eslint.config.mjs` (Next 16) y lint + build en la CI. Quedan ~250 avisos (`any`, reglas del React Compiler) | 🟢 Bajo | Bajar los avisos de a poco; no rompen la CI. |
| 6 | **`force-dynamic` global + CSP con nonce** → todas las rutas son dinámicas (ƒ), sin caché/ISR | 🟡 Medio | El nonce obliga a SSR; evaluar ISR/caché si se prioriza rendimiento sobre la CSP estricta. |
| 7 | **Imágenes sin optimizar** (`images.unoptimized: true`) | 🟢 Bajo | Necesario hoy por las rutas locales de `public/Imagenes/...`; migrar a Cloudinary/optimizador para rendimiento. |
| 8 | **Carpeta `scripts/` sin versionar** (`.gitignore`) — bootstrap y diagnóstico no están en el repo | 🟡 Medio | Versionar los scripts no sensibles (`grant-admin`, `manage-claims`, `verify-mail`, `check-*`) o documentarlos para recrearlos. |
| 9 | **`scripts/simulate_sale.js` con ruta fija** al JSON de la cuenta de servicio | 🟢 Bajo | Migrarlo a leer credenciales de `.env.local` (como el resto). |
| 10 | **9 vulnerabilidades moderadas** (cadena de `firebase-admin` y `exceljs`); 0 altas y 0 críticas tras Next 16.4.3 | 🟢 Bajo | Requieren versiones mayores (`firebase-admin` 14, `exceljs` 3.4 → revisar compatibilidad). La CI falla ante **altas**. |
| 11 | **Rotación de credenciales no realizada** (decisión D-1): la contención fue purgar el historial de git (T-03) | 🟡 Medio | Si el repo estuvo público, quien lo clonó conserva copias. Ante actividad rara (Stripe/Gmail) → rotar esa clave puntual. |
| 12 | ~~`STRIPE_WEBHOOK_SECRET` local vs producción~~ — **cerrado** (Stripe retirado) | ✅ | — |
| 13 | **Datos de prueba en Firestore** — órdenes `sim_*`, `pi_mock_*`, `pi_lowstock_*` de pruebas | 🟢 Bajo | Limpiar colecciones de prueba antes de salir a producción real. |
| 14 | **Archivos auxiliares de diagnóstico** en la raíz (`deep_diag.js`, `fix_env.js`, `tmp_check_key.js`, `tmp_fix_key.js`), gitignored | 🟢 Bajo | Eliminarlos cuando ya no se usen. |

> El detalle ampliado y el estado por tarea de seguridad están en `tareas-seguridad.md`.

---

## Licencia y contacto
Sistema interno del gimnasio FITMANIA. Para dudas o reportes use la sección **PQRS** integrada en la plataforma o contacte a la administración en el punto físico.