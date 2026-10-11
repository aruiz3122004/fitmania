# 🦸 FITMANIA — Mapa de Desarrollo

> *Documento de presentación del software: cómo nació, qué lógica usa, cómo se decidió cada cosa, quiénes participan y cómo funciona de punta a punta.*
>
> **Versión documentada:** rama `main` — commit `6ed227d` (merge completo)
> **Proyecto:** `fitmania-e1748` · **Repo:** `github.com/aruiz3122004/fitmania`

---

## 1. El problema que resuelve

**FITMANIA** es un gimnasio con identidad de "superhéroes". Antes de esta aplicación, su operación era manual:

| Problema cotidiano | Cómo lo resolvía antes | Cómo lo resuelve FITMANIA ahora |
|---|---|---|
| Comprar membresías | En efectivo en la recepción, anotado a mano | **Pago en línea con tarjeta (Stripe)** y activación automática del plan en la base de datos |
| Saber quién tiene plan activo | Cuaderno de asistencia físico | **Panel de recepción con lector QR**: se escanea el código del miembro y se registra la entrada, con su estado de plan |
| Vender suplementos, snacks y ropa | Inventario mental / cuaderno | **Tienda en línea con carrito y descuentos**, stock controlado con alertas automáticas |
| Comunicación con el gimnasio | WhatsApp suelto | **Foro comunitario** y módulo **PQRS** con respuesta oficial del administrador |
| Seguimiento de ventas y clientes | Ninguno | **Panel administrativo** con estadísticas, gestión de usuarios, planes y órdenes |
| Control interno | Confianza | **Auditoría de acciones**, bloqueo por intentos fallidos y registros de entrada inmutables |

**Necesidad central:** digitalizar el ciclo completo del miembro — *"llegar, comprar su plan, ingresar por recepción, participar en la comunidad"* — y dar al dueño visibilidad total de la operación.

---

## 2. Roles del software

```
┌────────────────────────────────────────────────────────────────────┐
│                        VISITANTE (sin cuenta)                       │
│   Explora catálogo público: planes, tienda, entrenadores, foro      │
│   Lee el contenido del home y los planes (lectura pública)         │
└────────────────────────────────────────────────────────────────────┘
                              │ registrarse / ingresar
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                           MIEMBRO / CLIENTE                         │
│   · Compra planes ($) y productos (carrito)                         │
│   · Tiene QR personal en su perfil (identificador UID)              │
│   · Participa en el foro y reporta contenido                        │
│   · Envía PQRS y ve la respuesta del admin                          │
│   · Ve su historial de compras, check-ins y estado de su plan       │
└────────────────────────────────────────────────────────────────────┘
                              │  (roles internos, rutas ocultas)
                              ▼
┌─────────────────────────────┐        ┌─────────────────────────────┐
│   ADMINISTRADOR              │        │   RECEPCIONISTA             │
│   Ruta: /fitministration     │        │   Ruta: /fitception         │
│   · Estadísticas globales    │        │   · Escanear QR de ingreso  │
│   · Gestión de usuarios      │        │   · Registrar entradas      │
│   · Inventario y stock       │        │   · Directorio de miembros  │
│   · Precios de planes        │        │   · Historial de entradas   │
│   · Resolver PQRS            │        │   · Exportar a Excel/JSON   │
│   · Órdenes de venta         │        │   · Ver estado de plan      │
│   · Notificaciones y alertas │        └─────────────────────────────┘
│   · Logs de auditoría        │
└─────────────────────────────┘
```

**Acceso interno:** tanto admin como recepción requieren una **puerta con llave** (`?key=…`) y, después, un **login con credenciales** cuya sesión se guarda en una cookie `HttpOnly`. Las URLs reales no aparecen en los menús públicos (seguridad por oscuridad + autenticación real en cada petición).

---

## 3. Arquitectura general

```
┌─────────────────────────── Browser (Next.js 16 · React 19) ───────────────────────────┐
│                                                                                        │
│  Páginas públicas          Páginas privadas/ocultas        Estado global (zustand)     │
│  · / · /planes · /tienda   · /fitministration (admin)      · useAuth (perfil)          │
│  · /carrito · /entrenadores · /fitception (recepción)      · useCart (carrito)         │
│  · /registro · /login · /perfil · /foro · /pqrs · /game    · useUI (menús)             │
│  · /pago → /pago/resultado                                 │                           │
└───────────┬──────────────────────────────┬───────────────────────────────────────────┘
            │ (fetch / API Routes)         │ (SDK de Firebase cliente: onSnapshot en vivo)
            ▼                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│   NEXT.JS API ROUTES (Serverless en Vercel)                                           │
│                                                                                       │
│   /api/auth/verify .............. verifica cookie HttpOnly para admin/recepción        │
│   /api/admin/login|logout ....... crea/borra la cookie de sesión del admin             │
│   /api/admin/users|products|planes|orders|pqrs|stats|logs|notifications|archive-sales │
│       ............... gestión completa del negocio (Admin SDK verificando la sesión)  │
│   /api/recepcion/login|entry-log ... login de recepción y registro de entradas         │
│   /api/stripe/create-payment .... crea PaymentIntent (precio validado en servidor)     │
│   /api/stripe/webhook ........... verifica firma STRIPE → activa plan / baja stock     │
│   /api/send-email ............... correos transaccionales (⚠ ver auditoría)            │
│   /api/security/check|log-block . soporte del rate limiting                            │
│   /api/diag ............... diagnóstico de conexión Firebase (⚠ solo dev)              │
│                                                                                       │
│   Middleware (edge): rate limiting (Upstash Redis), cabeceras de seguridad (CSP,      │
│   HSTS, X-Frame, nosniff), puertas de acceso a /fitministration y /fitception,        │
│   custodia de cookies.                                                                │
└─────┬───────────────────────┬──────────────────────┬──────────────────────────────────┘
      ▼                       ▼                      ▼
┌───────────┐      ┌──────────────────┐      ┌─────────────────────┐
│  Firebase │      │      Stripe      │      │ Servicios auxiliares│
│  Auth     │      │  PaymentIntents  │      │ · Cloudinary (img)  │
│  Firestore│      │  Webhooks firmados│      │ · Gmail SMTP        │
│  Storage  │      └──────────────────┘      │ · Upstash Redis     │
└───────────┘                                │ · Vercel Analytics  │
                                             └─────────────────────┘
```

**Principio rector:** el **cliente nunca define precios ni activa planes**. La lógica de negocio sensible vive en el servidor (API Routes + Admin SDK) y se dispara por eventos verificados (webhook de Stripe).

---

## 4. Mapa de decisiones (decidimos esto y por qué)

| # | Decisión | Alternativa considerada | Por qué se eligió así |
|---|---|---|---|
| 1 | **Next.js App Router full-stack** (frontend + backend en el mismo deploy) | API externa separada (Express/Nest) | Un solo repositorio y un solo despliegue; las API Routes funcionan serverless en Vercel sin infraestructura propia; SSR para SEO del catálogo. |
| 2 | **Firebase** (Auth + Firestore + Storage) | Supabase, MongoDB Atlas | Integración casi cero entre sesión, reglas de seguridad y datos; `onSnapshot` da **tiempo real gratis** (planes, inventario, foro); el trigger de pagos viaja con el Admin SDK. |
| 3 | **Stripe PaymentIntents (tarjeta / Daviplata)** | Wompi, PSE (se exploró antes) | Stripe está optimizado para tarjetas y webhooks confiables; la firma del webhook (`STRIPE_WEBHOOK_SECRET`) permite confiar en la activación. El flujo **PSE quedó documentado-comentado** en `/pago` como aprendizaje/línea futura. |
| 4 | **Sesiones por cookie HttpOnly** (`fitmania_session`) | Token en `localStorage` | XSS no puede leer la cookie; cada llamada API re-verifica el `ID Token` con `verifyIdToken` (nunca se confía en el cliente). |
| 5 | **Roles con claims de Firebase** (`admin`, `receptionist`) | Tabla de roles en Firestore | Los claims viajan firmados en el token; las reglas de Firestore los leen (`request.auth.token.admin`), el middleware y las APIs también. Una sola fuente de verdad de permisos. |
| 6 | **Rate limiting con Upstash Redis en el middleware** | En memoria por instancia | Vercel escala por regiones; un contador en memoria no sirve. Redis da bloqueos progresivos (1m→5m→15m→…→1h) compartidos entre instancias. |
| 7 | **Precios y planes en Firestore** (no hardcode) | Constantes en el código | El administrador edita precios y descripciones desde el panel; el servidor **recalcula el monto** leyendo la base (el cliente solo envía el `planId`). |
| 8 | **Activación de planes vía webhook server-side** | Marcar plan desde el cliente | El webhook verifica la firma de Stripe y escribe con el Admin SDK (reglas `write: false` en cliente). Nada de "autopremium". |
| 9 | **Identidad QR = UID del usuario** | QR con hash secreto | El UID es estable y único; la recepción lee el código y consulta el estado del plan en vivo. El QR **no** contiene información sensible, solo referencia. |
| 10 | **Cloudinary para subida de imágenes** | Firebase Storage directo | Preset firmado/semi-privado, entrega por CDN y transformaciones; Firebase Storage se reserva para avatares/posts con límites de tipo y tamaño. |
| 11 | **Diseño "cómic"** (bordes duros, sombras de bloque, tipografía Bangers) | UI corporativa neutra | La marca del gimnasio es superheroica; la UI refuerza personalidad, diferenciación y engagement (incluso hay una página `/game`). |
| 12 | **Páginas internas con URL "secreta"** (`/fitministration`, `/fitception`) | Acceso directo desde el menú | Reducir superficie de ataque: el contenido interno no se enlaza públicamente y además exige llave + sesión. |

---

## 5. Frontend

### 5.1 Stack y estructura

- **Next.js 16** (App Router) + **React 19** + **TypeScript**, estilos con **Tailwind CSS v4** y paquete de animaciones `tw-animate-css`.
- **Estado global:** `zustand` con persistencia en `localStorage` — `fitmania-cart` (carrito) y `fitmania-auth` (usuario), más un `useUIStore` para menús móviles.
- **Autenticación en cliente:** `AuthContext` se suscribe a `onAuthStateChanged` de Firebase; el login se hace con `signInWithEmailAndPassword`.
- **Componentes:** `components/layout` (Topbar, Footer), `components/home` (Hero, Planes, Productos, Entrenadores), `components/admin`, `components/recepcion`, `components/ui` (modales, encabezados de sección, tema).

### 5.2 Páginas

| Ruta | Página | Lógica destacada |
|---|---|---|
| `/` | Home | Hero + Planes + Productos + Entrenadores |
| `/planes` | Planes | **lee la colección `planes` en vivo** (`onSnapshot`); el botón manda solo el `planId` al checkout |
| `/tienda` | Tienda | Productos por categorías (suplementos, snacks, ropa), stock en vivo |
| `/carrito` | Carrito | Agrega/resta cantidades, talla/color en ropa, total persistente |
| `/pago` | Checkout | CardElement de Stripe, `<Elements>`; consigue `clientSecret` del servidor |
| `/pago/resultado` | Resultado | Confirma el estado tras redirección del pago |
| `/registro` · `/login` | Acceso | Firebase Auth, fondos e identidad visual |
| `/perfil` | Perfil | Datos del miembro, **QR personal**, estado del plan, historial |
| `/foro` | Foro | Posts de la comunidad, reportes, avatares |
| `/pqrs` | PQRS | Peticiones/quejas/reclamos con seguimiento |
| `/entrenadores` | Equipo | ==== sección de entrenadores del gimnasio |
| `/game` | Minijuego | Enganche de marca (Gamificación) |
| `/fitministration` | Panel admin | Dashboard oculto (puerta `?key=`) |
| `/fitception` | Recepción | Panel oculto con **escáner QR** (`@yudiel/react-qr-scanner`) |

### 5.3 Flujo de compra (cliente)

1. El usuario agrega al carrito o elige un plan → redirige a `/pago?planId=…`.
2. El frontend pide al servidor `POST /api/stripe/create-payment` **sin decidir precios**.
3. El servidor valida precios contra Firestore y devuelve `client_secret`.
4. Stripe Element confirma el pago con la tarjeta (se acepta la Mastercard virtual de Daviplata; prueba: `4242 4242 4242 4242`).
5. `payment_intent.succeeded` llega al webhook → activa plan / descuenta stock / notifica / envía recibo.

---

## 6. Diseño

### 6.1 Sistema visual "Cómic superheroico"

- **Tipografías (Google Fonts, en `layout.tsx`):**
  - `Bangers` → titulares de bloque (`--font-display`).
  - `Epilogue` → encabezados (`--font-heading`).
  - `Plus Jakarta Sans` → cuerpo (`--font-body`).
  - `Space Grotesk` → etiquetas técnicas (`--font-label`).
- **Paleta (`globals.css`):** rojo `#DC2626`, navy `#1a1a2e`, amarillo `#FACC15`, blanco/negro, con tokens semánticos Tailwind (`primary`, `secondary`, `accent`).
- **Reglas visuales:** bordes gruesos (2–4 px), **sombras duras de bloque** (`--shadow-comic: 4px 4px 0 var(--navy)`), esquinas `--radius: 0px`, retículas de puntos tipo *halftone*, "speed lines" al hacer hover y animaciones de comic (`animate-shake`, zoom/scale).
- **Mascota:** `Fitman` (avatares en `public/Imagenes/Avatares`), usada en login, registro e identidad.

Esta decisión de diseño tiene un propósito de negocio: **diferenciación y fidelización** en un mercado (gimnasios) donde la UI suele ser genérica.

---

## 7. Backend

### 7.1 Autenticación y sesiones

1. Usuario firma con Firebase en cliente → obtiene un **ID Token**.
2. Lo envía a `POST /api/admin/login` (o `/api/recepcion/login`).
3. El servidor verifica el token con **Admin SDK**, comprueba **claim/email autorizado** y responde con una **cookie `HttpOnly`** (`fitmania_session` o `fitmania_reception_session`).
4. Cada API sensible re-valida el token server-side (`lib/auth-helpers: verifyAdminRequest`).
5. Logout elimina la cookie de inmediato.

### 7.2 Middleware (edge) — capa de defensa global

- **Rate limiting progresivo** para login y pagos (Upstash Redis; bloqueos de 1 min → 1 h con niveles de castigo persistidos 24 h).
- **Cabeceras de seguridad:** CSP, HSTS (prod), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
- **Puertas de acceso**: `/fitministration` y `/fitception` solo se renderizan con `?key=` correcta (cookie de gate temporal) o con sesión válida.
- **Custodia de cookies** para rutas `/api/admin/*` y `/api/recepcion/*` (excluye login).

### 7.3 Lógica de negocio clave

- **Registro de usuario:** crea el doc en `users/{uid}` con datos del perfil y avatares predefinidos.
- **Compra de plan:** `planes` → `create-payment` (monto 100% del servidor) → webhook → `users/{uid}.plan` con duración por concepto (`parejas`=40 días, `dos en uno`=60, resto=30).
- **Inventario:** el webhook descuenta stock en una transacción de Firestore y crea **notificaciones `low_stock`** (<5 unidades).
- **Notificaciones automáticas:** el GET de notificaciones del admin detecta planes que vencen en 5 días y en 1 día (IDs únicos por día para no duplicar).
- **Recepción:** escaneo QR (UID) → panel muestra perfil, plan, órdenes y check-ins → registra `entry_logs` (inmutable en reglas) → opcional exportar **Excel/JSON**.
- **PQRS:** el usuario crea su PQRS; el admin le responde y queda trazabilidad.
- **Foro:** posts con creación por usuario autenticado, reportes (`reportes`) y avatares.
- **Auditoría:** `recordAuditLog` registra logins, bloqueos y acciones admin en `audit_logs` (solo Admin SDK).

### 7.4 Seguridad (resumen)

Webhook firmado · cookies HttpOnly+SameSite+Secure · claims firmados · reglas Firestore por rol · rate limiting · auditoría inmutable · cabeceras de seguridad. *(Nota: la auditoría completa con hallazgos y plan de remediación está en `auditoría.md`.)*

---

## 8. Base de datos (Firestore)

### 8.1 Colecciones y modelo

| Colección | Uso | Escritura permitida |
|---|---|---|
| `users/{uid}` | Perfil, avatar, peso/altura, **plan** activo | Owner (perfil) / Admin / servidor (plan) |
| `planes/{id}` | Planes de membresía (precio, duración, features, icon) | Admin / servidor |
| `products/{id}` | Tienda: nombre, precio, stock, categoría | Admin / servidor (stock) |
| `orders/{id}` | Órdenes por pago (usuario, items, total, banco) | **Webhook (Admin SDK)** |
| `posts/{id}` | Foro: autor, contenido, likes, comentarios | Usuario autenticado (crear/editar propio) |
| `pqrs/{id}` | Peticiones y respuestas | Usuario (crear) / Admin (responder) |
| `notifications/{id}` | Alertas: low stock, compra, plan por vencer | Admin / servidor |
| `checkIns/{id}` | Ingresos por miembro (historial individual) | Admin / Recepción |
| `entry_logs/{id}` | Registro general de entradas de recepción | **Solo Admin SDK** (`write: false`) |
| `audit_logs/{id}` | Bitácora de seguridad | **Solo Admin SDK** (`write: false`) |
| `reportes/{id}` | Reportes del foro | Usuario (crear) / Admin |
| `logs/{id}` | Logs auxiliares | Usuario autenticado |

### 8.2 Reglas de seguridad (`firestore.rules`)

- Funciones **`isAdmin`** y **`isReceptionist`** leen los claims firmados del token.
- `users`: lectura para owner/admin/recepción; escritura owner o admin (⚠ revisar campo `plan` — ver auditoría, C-3).
- `orders`/`entry_logs`/`audit_logs`: solo el servidor (reglas forbid en cliente).
- `planes`/`products`: lectura pública; escritura solo admin.
- `posts`/`pqrs`/`reportes`: creación con sesión; moderación solo admin.

### 8.3 Storage

- Avatares y fotos de posts con protección de tipo (`image/*`) y tamaño (`< 5 MB`), solo el propietario puede escribir en su carpeta; lectura pública.

---

## 9. Deploy

| Pieza | Destino | Detalle |
|---|---|---|
| **Web app + API Routes** | **Vercel** | `npm run build`/`start`; despliegues por push a `main`; Analytics de Vercel activado |
| **Firebase** (Auth, Firestore, Storage) | Proyecto **`fitmania-e1748`** | Reglas desplegadas con `firebase deploy` (`firebase.json`) |
| **Stripe** | Dashboard Stripe | `STRIPE_SECRET_KEY` + webhook apuntando a `https://<dominio>/api/stripe/webhook` con `STRIPE_WEBHOOK_SECRET` |
| **CDN de imágenes** | **Cloudinary** | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` + `UPLOAD_PRESET` |
| **Rate limit compartido** | **Upstash Redis** | `UPSTASH_REDIS_REST_URL` / `_TOKEN` (ver auditoría A-1) |
| **Correos** | **Gmail SMTP** | `GMAIL_USER` + App Password |

**Variables de entorno (grupos):** públicas `NEXT_PUBLIC_*` (Firebase, Stripe, Cloudinary, tokens de gate de recepción) y privadas (Firebase Admin, Stripe secret, webhook secret, Gmail). El `.env.local` está en `.gitignore` (`env*.local`) — rotar credenciales históricas (ver auditoría C-1).

---

## 10. Cómo se construyó (evolución del proyecto)

| Etapa | Hito (commit) | Qué se agregó |
|---|---|---|
| 1 · Semilla | `42213dd fitmania Interface` | Primera interfaz "comic", idea de NoSQL y PSE/Wompi |
| 2 · Cobro | `0fcc939 Integration with stripe` | Stripe con tarjetas ficticias + correo al confirmar transacción |
| 3 · Admin | `018c17c → 7bee7f7 → 4717d17` | Panel admin: usuarios, inventario, notificaciones; *"login only for admins"* |
| 4 · Datos | `f8d4c16 → c9f821c → f2e9451` | PQRS en Firestore con reglas de seguridad |
| 5 · Comercio | `9dd1899` | Carrito con zustand + página de checkout |
| 6 · Comunidad | `5b5afd8 → d387559` | Foro, perfil, dropdown de usuario, avatares |
| 7 · Recepción | `b3a9038 → 8107667` | Historial de entradas, cookies HttpOnly, CSP y validación de middleware |
| 8 · Refactor | `e3a0b46 → 9d7dd64` | Login + dashboards de admin/recepción, QR en perfil, readme |
| 9 · Seguridad | Ramas con "fitception"/"fitministration", audit logs, rate limit, gate keys | Doble fachada de rutas, verificación server-side, bloques progresivos |
| 10 · Merge | `6ed227d Merge branch main` | Unificación de ambos flujos de trabajo; se resolvió el conflicto de `tsconfig.tsbuildinfo` |
| 11 · Auditoría | `auditoría.md` | Revisión de seguridad completa y hoja de ruta de remediación |

**Cómo se trabajó:** dos líneas de desarrollo en paralelo (una local y la remota) que finalmente se integraron; el mapeo de rutas se renombró a URLs "invisibles" (`admin`→`fitministration`, `recepcion`→`fitception`) por seguridad y consistencia de marca.

---

## 11. Próximos pasos (roadmap)

Según `auditoría.md`, el orden recomendado:

1. **Fase 0 (emergencia):** rotar credenciales y purgar secretos de historia; cerrar `/api/send-email`; quitar archivos scratch del repo.
2. **Fase 1 (producción):** endurecer reglas de Firestore (plan solo vía servidor), autenticar `/api/admin/planes`, eliminar el fallback de monto del cliente, configurar Upstash y llaves de gate, actualizar dependencias (`next`, `xlsx`, `nodemailer`).
3. **Fase 2 (robustez):** session cookies de Firebase con revocación, CSP con nonces, notificaciones por Cloud Functions, gestión central de claims, CI con `npm audit` y escaneo de secretos.

---

*Documento generado para la presentación del proyecto. Complementos: `readme.md` (guía técnica) y `auditoría.md` (revisión de seguridad).*