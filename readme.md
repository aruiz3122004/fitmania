# FITMANIA 💪 — Sistema de Gimnasio

> **Tu Pasión. Tu Fuerza.** Plataforma web completa para el gimnasio FITMANIA: venta de planes de membresía, tienda de suplementos/snacks/ropa, foro comunitario, sistema PQRS, panel de administración, estación de recepción con control de acceso por código QR y un mini-juego.

Aplicación construida con **Next.js (App Router)** + **Firebase** + **Stripe**, desplegada en **Vercel**.

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
12. [Juego (Game)](#12-juego-game)
13. [Modelo de datos en Firestore](#13-modelo-de-datos-en-firestore)
14. [Reglas de seguridad](#14-reglas-de-seguridad)
15. [Variables de entorno](#15-variables-de-entorno)
16. [Scripts y datos de prueba](#16-scripts-y-datos-de-prueba)
17. [Instalación y ejecución](#17-instalación-y-ejecución)
18. [Notas técnicas y despliegue](#18-notas-técnicas-y-despliegue)

---

## 1. Descripción general

FITMANIA es un **monolito Next.js** que combina:

- **Sitio público**: home con hero, planes, productos y entrenadores; página de tienda, planes, foro, PQRS y entrenadores.
- **Flujo comercial**: carrito de compras (zustand con persistencia en `localStorage`), checkout con **Stripe PaymentIntents** (tarjeta, moneda COP).
- **Backend**: API Routes de Next.js que usan el **Firebase Admin SDK** para operaciones privilegiadas (asignar admin, estadísticas, CRUD de productos, responder PQRS, notificaciones, archivar ventas).
- **Panel Admin**: dashboard con pestañas de resumen, usuarios, inventario, PQRS y compras, más exportación de datos y campana de notificaciones.
- **Panel Recepción**: control de ingresos físicos escaneando el código QR del miembro (búsqueda por UID) o simulando el escaneo, con registro de *check-ins*, historial de compras y directorio de miembros activos.
- **Comunidad**: foro con publicaciones, likes, comentarios y subida de imágenes.
- **Extras**: mini-juego de plataformas en canvas y avatares estilo cómic.

La UI usa un **estilo cómic/superhéroe** (colores rojo/azul/amarillo, bordes gruesos negros, tipografías Bangers/Epilogue/Plus Jakarta/Space Grotesk) y componentes **shadcn/ui** con Tailwind CSS v4.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js **16.2.0** (App Router, React 19) |
| Lenguaje | TypeScript 5.7 |
| Estilos | Tailwind CSS v4 + shadcn/ui (Radix UI) + `tw-animate-css` |
| Estado global | zustand 5 (carrito, sesión, UI) |
| Backend/Firebase | Firebase 12 (Auth, Firestore, Storage) |
| Admin SDK | firebase-admin 13 (autoridad para webhooks y rutas API) |
| Pagos | Stripe 21 (`PaymentIntent`, currency `cop`) |
| Correos | nodemailer (Gmail SMTP) |
| Imágenes | Cloudinary (subida de avatares/perfil) |
| QR | `@yudiel/react-qr-scanner` + `react-qr-code` |
| PDFs/export | jspdf + jspdf-autotable (exportación admin) |
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
│   ├── admin/page.tsx            # Panel de administración
│   ├── api/                      # API Routes
│   │   ├── admin/
│   │   │   ├── auth/route.ts         # POST: asignar claim admin (token secreto + uid)
│   │   │   ├── stats/route.ts        # GET: total usuarios/admins/PQRS
│   │   │   ├── users/route.ts        # GET/PATCH/DELETE: CRUD usuarios
│   │   │   ├── products/route.ts     # GET/POST/PATCH/DELETE: CRUD productos
│   │   │   ├── orders/route.ts       # GET: órdenes no archivadas (últimas 500)
│   │   │   ├── pqrs/route.ts         # GET: listar PQRS
│   │   │   ├── pqrs/respond/route.ts # POST: responder PQRS + email + estado
│   │   │   ├── notifications/route.ts# GET/PATCH/DELETE: notificaciones + auto-gen planes a vencer
│   │   │   └── archive-sales/route.ts# POST: archivar ventas (batch update)
│   │   ├── send-email/route.ts       # POST: envía correos de pago (legacy/inline)
│   │   ├── stripe/
│   │   │   ├── create-payment/route.ts# POST: crea PaymentIntent en COP
│   │   │   └── webhook/route.ts       # POST: evento Stripe → stock, órdenes, planes, emails
│   │   └── test-admin/route.ts        # GET: diagnóstico de Firebase Admin
│   ├── carrito/page.tsx           # Carrito de compras
│   ├── context/AuthContext.tsx    # AuthProvider (onAuthStateChanged de Firebase)
│   ├── entrenadores/page.tsx      # Entrenadores
│   ├── foro/page.tsx              # Foro con noticias + posts
│   ├── game/page.tsx              # Mini-juego canvas
│   ├── login/page.tsx             # Inicio de sesión
│   ├── pago/
│   │   ├── page.tsx               # Checkout Stripe (CardElement) — /pago?concepto&monto
│   │   └── resultado/page.tsx     # Resultado del pago (redirect_status)
│   ├── perfil/page.tsx            # Perfil: avatar, datos, acompañante del plan
│   ├── planes/page.tsx            # Página de planes
│   ├── pqrs/page.tsx              # Formulario PQRS
│   ├── recepcion/page.tsx         # Panel de recepción (QR check-in)
│   ├── registro/page.tsx          # Registro de usuarios
│   ├── services/mail.ts           # (placeholder vacío, duplicado)
│   └── tienda/page.tsx            # Tienda
├── components/
│   ├── admin/
│   │   ├── admin-login-form.tsx   # Login admin: email+password+token
│   │   └── product-modal.tsx      # Modal crear/editar producto
│   ├── home/                      # hero, planes, productos, entrenadores
│   ├── layout/                    # topbar, footer, user-dropdown
│   ├── recepcion/reception-login-form.tsx  # Login recepción (triple capa)
│   ├── ui/                        # shadcn/ui + fit-avatar + comic-modal
│   └── theme-provider.tsx
├── hooks/
├── lib/
│   ├── firebase.ts                # Cliente Firebase (browser)
│   ├── firebase-admin.ts          # Admin SDK lazy (server)
│   ├── store.ts                   # zustand: carrito, auth, UI
│   ├── avatar-utils.ts            # Avatares (getAvatarUrlById)
│   └── utils.ts                   # cn() etc.
├── public/
│   ├── images/                    # gym1/2/3.jpg (hero/foro)
│   └── Imagenes/                  # productos, avatares, snacks, ropa
├── scripts/
│   └── simulate_sale.js           # Simula compra con Admin SDK (ruta local fija)
├── services/
│   ├── cloudinary.ts              # uploadToCloudinary()
│   └── mail.ts                    # Plantillas de correo (nodemada/Gmail)
├── firestore.rules                # Reglas de seguridad Firestore
├── storage.rules                  # Reglas de seguridad Storage
├── firebase.json / .firebaserc    # Config Firebase (proyecto fitmania-e1748)
├── init_products.js               # Seed de productos (raíz)
├── verify_flow.js                 # Test de stock/orden (raíz)
└── next.config.mjs                # ignoreBuildErrors, images.unoptimized
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
| `/pago` | `app/pago/page.tsx` | Checkout con tarjeta Stripe (`/pago?concepto=&monto=`) |
| `/pago/resultado` | `app/pago/resultado/page.tsx` | Pantalla de resultado según `redirect_status` |
| `/foro` | `app/foro/page.tsx` | Foro: noticias + posts con likes/comentarios |
| `/pqrs` | `app/pqrs/page.tsx` | Formulario de Peticiones/Quejas/Reclamos/Sugerencias |
| `/entrenadores` | `app/entrenadores/page.tsx` | Equipo de entrenadores |
| `/perfil` | `app/perfil/page.tsx` | Datos del usuario, avatar, acompañante del plan |
| `/game` | `app/game/page.tsx` | Mini-juego de plataformas (canvas) |
| `/fitministration` | `app/fitministration/page.tsx` | Panel admin — **oculto** (requiere llave `?key=` + login con claim `admin`) |
| `/fitception` | `app/fitception/page.tsx` | Estación de recepción — **oculta** (requiere llave `?key=` + login con email autorizado) |

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

### Sesión y estado
- El estado de sesión se mantiene en **dos lugares**:
  - `AuthContext` (React context) con el usuario de Firebase.
  - `useAuthStore` (zustand + persistencia) con el perfil enriquecido (`username`, `avatar`, `plan`, etc.) — es el que usan carrito, perfil, PQRS y demás.
- El logout limpia el usuario del store y de Firebase Auth.

### Roles
- **Usuario normal**: creado en Auth + documento `users/{uid}`.
- **Admin**: usuario con el **custom claim** `{ admin: true }` en Firebase Auth. Bootstrap: `node scripts/grant-admin.js <email>`.
- **Recepcionista**: el **claim** `{ receptionist: true }` se asigna automáticamente al hacer login con un correo que coincida con `RECEPTION_AUTHORIZED_EMAIL`.

> Los dos paneles internos son URLs **invisibles** (`/fitministration` y `/fitception`); no aparecen en el menú público y exigen primero la llave `?key=` (ver [§7](#7-panel-de-administración) y [§8](#8-panel-de-recepción)).

---

## 6. Flujo de pago (planes y tienda)

FITMANIA procesa pagos con **Stripe PaymentIntents** en **COP (pesos colombianos)**, usando el `CardElement` de Stripe. Hay un único endpoint que crea el cobro y un **webhook** que ejecuta toda la lógica de negocio del lado del servidor (fuente de verdad).

### 6.1 Planes (membresías)
Definidos en `components/home/planes.tsx`:

| Plan | Precio | Duración | Bono |
|---|---|---|---|
| Plan Estándar | $80.000 | 30 días | Básico |
| Plan Parejas | $95.000 | 40 días | Invitado 3 veces/semana (acompañante) |
| Plan Dos en Uno | $140.000 | 60 días | 25% OFF, seguimiento semanal |

Al hacer clic en un plan:
```js
router.push(`/pago?concepto=${encodeURIComponent(plan.name)}&monto=${plan.price}`)
```

### 6.2 Tienda (carrito)
- El usuario agrega productos al carrito (zustand, clave `fitmania-cart`).
- En `/carrito` se calcula el total y se redirige:
  ```js
  router.push(`/pago?concepto=Compra+Fitmania&monto=${total}`)
  ```
- El checkout envía `items` (id, cantidad) en el cuerpo para que Stripe los lleve como metadata.

### 6.3 Creación del cobro — `POST /api/stripe/create-payment`
```js
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amount * 100),   // centavos
  currency: 'cop',
  payment_method_types: ['card'],
  description: concept,
  receipt_email: customerEmail,
  metadata: { customerName, customerEmail, concept, uid, items: "id:qty,id:qty" }
})
```
- Con `items` se guarda un resumen `id:cantidad,id:cantidad` (máx 500 caracteres) en metadata.
- Devuelve `{ clientSecret }`.

### 6.4 Checkout en el cliente — `app/pago/page.tsx`
1. Carga `stripePromise = loadStripe(NEXT_PUBLIC_STRIPE_PUBLIC_KEY)`.
2. `CheckoutForm` recibe `concepto` y `monto` desde `useSearchParams`, y el carrito desde el store.
3. Llama a `create-payment` y con el `clientSecret` ejecuta `stripe.confirmCardPayment` con el `CardElement`.
4. **Si triunfa** (`paymentIntent.status === 'succeeded'`):
   - Llama a `/api/send-email` con `type: 'success'` (correo de confirmación o recibo si hay items).
   - Limpia el carrito.
   - **Solo si el concepto incluye** `plan`, `mensualidad`, `parejas` o `dos en uno`, actualiza en Firestore `users/{uid}.plan` con `{ nombre, precio, dias_total, inicio, expira }` (duración según reglas: parejas=40, dos en uno=60, resto=30). Esto evita corromper la membresía con compras de la tienda.
5. Muestra pantalla de éxito o error inline.

> El archivo conserva un bloque antiguo (comentado) de PSE con `BANCOS_PSE`; la lista de bancos aún vive en el webhook para identificar el origen del pago en emails y órdenes.

### 6.5 Webhook de Stripe — `POST /api/stripe/webhook`
Es el **procesador autoritativo** de pagos. Verifica la firma con `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`.

**Evento `payment_intent.succeeded`:**
- **Si hay `meta.items`** (compra de tienda):
  1. Lee cada producto de Firestore (`products/{id}`) para obtener nombre/precio.
  2. En una **transacción**: descuenta stock (`Math.max(0, stock - cantidad)`) y, si baja de 5 unidades, crea una notificación `low_stock`.
  3. Crea la **orden** en `orders/{paymentIntent.id}` con `{ uid, customerName, customerEmail, items, total, banco, fecha, status: 'paid' }`.
  4. Crea una notificación `purchase` para el admin.
  5. Envía el **recibo detallado** (`sendOrderReceiptEmail`) con la lista de items.
- **Si hay `meta.uid` y el concepto incluye "plan"/"mensualidad"**: activa el plan en `users/{uid}` (40/60/30 días según el nombre) y envía `sendPaymentSuccessEmail` con el extracto (banco, fecha, ID de transacción, total).
- El nombre del banco se resuelve desde `BANCOS_PSE` (Bancolombia, Davivienda, Nequi, etc.), o "Tarjeta/Otro".

**Evento `payment_intent.payment_failed`:** envía `sendPaymentFailedEmail` al cliente.

### 6.6 Resultado del pago — `/pago/resultado`
Página (legacy/3DS) que lee `redirect_status` y `payment_intent`:
- `succeeded` → pantalla verde de éxito con ID de transacción.
- `failed` → pantalla roja con enlace a `/pqrs` y botón "Intentar nuevamente".
- `pending` → amarilla "Pago en proceso".

### 6.7 Tarjeta de prueba
Stripe en modo test: **4242 4242 4242 4242**, cualquier fecha futura y CVC cualquiera. (Comentario en código como guía de uso con Daviplata/tarjeta virtual.)

---

## 7. Panel de administración

### Acceso (`/fitministration`)
El panel vive en una URL **oculta** y protegida en dos capas (`components/admin/admin-login-form.tsx`):

1. **Puerta de llave**: al visitar `/fitministration` el middleware exige `?key=<ADMIN_GATE_KEY>` (o una cookie `fitmania_admin_gate` válida por 1 hora, o una sesión admin ya iniciada). Sin esto responde **404**. El formulario limpia la llave de la barra de direcciones tras entrar.
2. **Login real**: `signInWithEmailAndPassword` de Firebase, y luego `POST /api/admin/login` re-verifica en el servidor que el usuario tenga el **custom claim `admin: true`** y, si está definida, que el correo coincida con `ADMIN_AUTHORIZED_EMAIL`.

Si pasa ambas capas, el servidor crea una **cookie `HttpOnly`** (`fitmania_session`, 1 h) que las rutas `/api/admin/*` re-validan con `verifyAdminRequest`.

> ¿Cómo hago que mi cuenta sea admin (primera vez)? `node scripts/grant-admin.js <email>` desde la carpeta del proyecto (lee `.env.local` y asigna `{ admin: true }`). Luego cierra sesión y vuelve a entrar para que Firebase emita un token con el claim.

### Dashboard (`app/fitministration/page.tsx`)
Pestañas:
- **Resumen (overview)**: estadísticas vía `GET /api/admin/stats` — total usuarios, admins, PQRS, y listado de usuarios; montos/formato COP; exportación **CSV/JSON** (jspdf para PDF).
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

Todas las rutas admin re-validan la sesión con `verifyAdminRequest` (cookie `HttpOnly` + claim `admin`), salvo `/api/admin/planes`, que depende solo del middleware (⚠ ver `auditoría.md`, hallazgo C-4).

---

## 8. Panel de recepción

Estación de control de ingresos del gimnasio en `/fitception` (URL también **oculta**).

### Acceso (doble capa) — `reception-login-form.tsx`
1. **Puerta de llave**: al visitar `/fitception` el middleware exige `?key=<RECEPTION_GATE_KEY>` (o cookie `fitmania_reception_gate` válida por 1 hora, o una sesión de recepción ya iniciada). Sin esto responde **404**.
2. **Login real**: `signInWithEmailAndPassword` de Firebase, y luego `POST /api/recepcion/login` exige que el correo coincida exactamente con **`RECEPTION_AUTHORIZED_EMAIL`** (si la variable no está definida, el servidor responde 500). Al loguearse se **asigna automáticamente el claim `receptionist: true`** para las reglas de Firestore.

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
- Las reglas de Firestore restringen la creación (autor_id == auth.uid, campos requeridos) y las actualizaciones solo a los campos `likes`/`comentarios` (ver §14).

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

## 12. Juego (Game)

`/game` (`app/game/page.tsx`): mini-juego de plataformas 2D sobre **canvas HTML5** (sin librería):
- Jugador con gravedad, salto y movimiento horizontal (teclado).
- Plataformas con nombres de zonas (Cliff, Valley, Waterfall, Coral, Forest, Glacier), obstáculos, coleccionables e interactivos (señales de nivel) — quedó como prototipo/sección de entretenimiento.

---

## 13. Modelo de datos en Firestore

Proyecto Firebase: **`fitmania-e1748`** (`.firebaserc`).

| Colección | Documento | Campos principales | Escritores |
|---|---|---|---|
| `users` | `{uid}` (UID de Auth) | `username`, `email`, `gender`, `avatar`, `photoURL`, `peso`, `altura`, `plan` (`{nombre, precio, dias_total, inicio, expira, acompanante?}`) | Usuario (create/update de sí mismo), Admin, Webhook |
| `products` | `{id}` (slug: `creatina`, `proteina`, …) | `nombre`, `precio`, `categoria`, `imagen_url`, `descripcion`, `stock`, `colores`, `tallas`, `badge`, `created_at` | Solo Admin (webhook descuenta stock) |
| `orders` | `{paymentIntent.id}` | `uid`, `customerName`, `customerEmail`, `items[]` (`{id, nombre, precio, cantidad}`), `total`, `banco`, `fecha`, `status`, `archived?` | Solo webhook/Admin SDK |
| `posts` | `{auto}` | `autor_id`, `autor_username`, `autor_avatar`, `contenido`, `imagen_url`, `likes[]`, `comentarios[]`, `created_at` | Usuario autenticado |
| `pqrs` | `{auto}` | `tipo`, `mensaje`, `userId`, `userName`, `userEmail`, `fecha`, `hora`, `createdAt`, `status`, `respuesta_admin?`, `fecha_respuesta?` | Usuario (create) / Admin (update) |
| `notifications` | `{auto}` o `plan5_{uid}_{fecha}` | `tipo` (`low_stock`, `purchase`, `plan_expiry`), `mensaje`, `leido`, `fecha`, + ids (`id_producto`, `id_orden`, `uid`) | Admin SDK (webhook + auto-gen) |
| `checkIns` | `{auto}` | `userId`, `userName`, `timestamp`, `authorizedBy` | Recepción (cliente autenticado) |
| `reportes` | `{auto}` | reportes de posts del foro | Usuario autenticado |
| `logs` | `{auto}` | (reservada para logging/rate limiting) | Usuario autenticado |

---

## 14. Reglas de seguridad

### Firestore (`firestore.rules`, rules_version '2')
- Funciones auxiliares: `isSignedIn()`, `isOwner(uid)`, `isAdmin()` (`request.auth.token.admin == true`).
- **`users/{uid}`**: read/update solo el dueño o admin; create del dueño; **delete prohibido** (el borrado se hace vía Admin SDK).
- **`posts`**: read público; create autenticado con `autor_id == auth.uid` y campos obligatorios (`hasAll([...])`); update solo de `likes`/`comentarios` (`affectedKeys().hasOnly`); delete por autor o admin (moderación).
- **`pqrs`**: read quien la creó o admin; create autenticado (`userId == auth.uid`); update/delete solo admin.
- **`logs`**: read solo admin; create autenticado; **update/delete prohibidos**.
- **`products`**: read público; write solo admin.
- **`orders`**: read el dueño (`uid`) o admin; **write solo admin** → solo el webhook (Admin SDK) o un admin crean órdenes.
- **`notifications`**: read/write solo admin.

> Importante: el webhook escribe Firestore con **Firebase Admin SDK**, que **omite las reglas de seguridad** (es código de servidor con credenciales). Las reglas protegen el acceso del cliente.

### Storage (`storage.rules`)
- Solo imágenes (`image/*`) y < **5 MB**.
- `users/{uid}/**`: write solo el dueño (fotos de perfil).
- `posts/{uid}/**`: write solo el dueño (imágenes del foro).
- Read público para ambos.

> En la práctica los avatares se suben a **Cloudinary** (`services/cloudinary.ts`, preset `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`) y la URL se guarda en `users/{uid}.photoURL`.

---

## 15. Variables de entorno

Archivo: **`.env.local`** en `fitmania/fitmania/` (¡nunca subir a Git!). Nombres usados por el código:

```env
# Firebase (cliente - browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin (server - cuenta de servicio)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=            # con saltos de línea; el código limpia comillas y \n

# Stripe
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Correos (Gmail App Password)
GMAIL_USER=
GMAIL_APP_PASSWORD=

# Puerta de acceso a paneles internos (urls /fitministration y /fitception)
ADMIN_GATE_KEY=
RECEPTION_GATE_KEY=

# Correos autorizados para el login de admin y recepción
ADMIN_AUTHORIZED_EMAIL=          # opcional; refuerza el login del admin (además del claim)
RECEPTION_AUTHORIZED_EMAIL=      # obligatorio para /fitception

# Rate limiting (Upstash Redis - opcional pero recomendado)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
```

La PRIVATE_KEY suele traer `\n` literales: `lib/firebase-admin.ts` los convierte en saltos reales y quita comillas para evitar el error *"Invalid PEM formatted message"*.

---

## 16. Scripts y datos de prueba

| Script | Qué hace |
|---|---|
| `init_products.js` (raíz) | Pobla la colección `products` con los 12 productos base (suplementos, snacks, ropa) leyendo credenciales de `.env.local`. |
| `scripts/grant-admin.js` | **Bootstrap del panel admin**: asigna el custom claim `admin:true` a un email/UID (`node scripts/grant-admin.js <email>`). Se usa una sola vez para habilitar el primer login de `/fitministration`. |
| `scripts/simulate_sale.js` | Simula una venta completa con el Admin SDK: usuario+producto, descuenta stock, crea orden y notificaciones y activa un plan. ⚠️ **Tiene ruta fija** al JSON de la cuenta de servicio (`C:\Users\...\fitmania-e1748-firebase-adminsdk-*.json`) — ajustarla o migrarla a `.env.local`. |
| `verify_flow.js` (raíz) | Prueba el flujo de compra masiva + alerta de stock bajo (compra 14 unidades de `creatina`, genera orden y notificación `low_stock`). |
| `app/api/test-admin/route.ts` | Diagnóstico por HTTP: lista las colecciones de Firestore para confirmar que el Admin SDK está bien configurado. |

Para desplegar reglas: `firebase deploy --only firestore:rules,storage:rules` (proyecto `fitmania-e1748`).

---

## 17. Instalación y ejecución

```bash
# 1. Posicionarse en la carpeta del proyecto (la que tiene package.json)
cd fitmania/fitmania

# 2. Instalar dependencias
npm install

# 3. Crear y llenar .env.local (ver §15)

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

> **Webhook local**: para probar pagos con webhooks en desarrollo se recomienda Stripe CLI:
> `stripe listen --forward-to localhost:3000/api/stripe/webhook` y usar ese secreto como `STRIPE_WEBHOOK_SECRET`.

---

## 18. Notas técnicas y despliegue

### Configuración de Next.js (`next.config.mjs`)
```js
{ typescript: { ignoreBuildErrors: true }, images: { unoptimized: true } }
```
- Los errores de TS **no bloquean** el build.
- Las imágenes se sirven sin optimización (necesario para las rutas locales de `public/Imagenes/...`).

### Flujo doble de confirmación de pago
El pago se confirma **dos veces**:
1. Cliente: `confirmCardPayment` + actualización directa del plan en Firestore para dar respuesta inmediata en UI (solo para conceptos de plan).
2. Servidor: **webhook Stripe** (`payment_intent.succeeded`) como fuente de verdad — descuenta stock, crea la orden y reactiva el plan. Es redundante a propósito para tolerar fallos.

### Seguridad del admin
- Acceso en dos capas: **puerta de llave** (`?key=ADMIN_GATE_KEY` en el middleware) + **login Firebase** que exige el custom claim `admin:true` (y `ADMIN_AUTHORIZED_EMAIL` si está definida).
- El claim `admin:true` se asigna con `node scripts/grant-admin.js <email>` (solo se usa para el primer admin).
- Todas las rutas `/api/admin/*` re-validan la sesión con `verifyAdminRequest` (cookie `HttpOnly` `fitmania_session` + claim `admin`), salvo `/api/admin/planes` (⚠ `auditoría.md` C-4).
- Las reglas de Firestore bloquean cualquier intento de escritura no admin en `products`, `orders` y `notifications`.

### Seguridad de recepción
- Doble capa: **puerta de llave** (`?key=RECEPTION_GATE_KEY` en el middleware) + **login Firebase** que exige que el correo coincida con `RECEPTION_AUTHORIZED_EMAIL`.
- Al loguearse se asigna automáticamente el claim `receptionist:true`; la sesión vive en la cookie `HttpOnly` `fitmania_reception_session` (1 h).

### Despliegue
- La app vive desplegada en **Vercel** (`.vercel`).
- Firebase (Auth, Firestore, Storage, rules) en el proyecto **`fitmania-e1748`**.
- Para nuevos entornos, configurar las variables de §15 en el dashboard de Vercel.

### Archivos auxiliares
- `app/services/mail.ts`: placeholder vacío (duplicado); la implementación real está en `services/mail.ts`.
- `deep_diag.js`, `fix_env.js`, `tmp_check_key.js`, `tmp_fix_key.js`: utilidades de diagnóstico temporales en la raíz (no forman parte del flujo de la app).

---

## Licencia y contacto
Sistema interno del gimnasio FITMANIA. Para dudas o reportes use la sección **PQRS** integrada en la plataforma o contacte a la administración en el punto físico.