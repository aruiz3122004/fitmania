# Esquema de datos — FITMANIA (Firestore)

Documento de referencia (F2-16). Toda colección nueva o cambio de campos se documenta aquí y, si afecta datos existentes, va con su migración en `lib/migrations.ts`.

**Convenciones**
- Fechas: `Timestamp` de Firestore (se escriben como `Date` desde el servidor).
- Claves de día: `YYYY-MM-DD` en zona `America/Bogota` (`lib/datetime.ts`).
- "Servidor" = Admin SDK desde las rutas `/api/*` (ignora las reglas). "Cliente" = SDK web, sujeto a `firestore.rules`.

| Colección | Escribe | Lee | Notas |
|---|---|---|---|
| `users/{uid}` | Servidor (alta, plan, acompañante); el dueño solo `username, avatar, photoURL, peso, altura, gender` | Dueño, admin | El plan solo lo escribe el servidor |
| `planes/{id}` | Admin (vía API) | Público | `days` define la duración (B3) |
| `products/{id}` | Admin (vía API), webhook (stock) | Público | ID = slug del nombre |
| `orders/{ref}` | Webhook de Mercado Pago | Dueño, admin | ID = referencia del pago (`fm_…`) = idempotencia. Órdenes antiguas de Stripe usan el `paymentIntentId` |
| `payments/{ref}` | Servidor (checkout, webhook, cron) | — (vía API) | Intento de pago con la foto del checkout |
| `mfa_state/{uid}` | Servidor (`/api/auth/mfa`) | — (las reglas lo leen con `get()`) | Verificación en dos pasos: `enabled`, `sessions` (`auth_time` verificados), `recoveryHashes` |
| `mfa_challenges/{uid}` | Servidor | — | Código pendiente (hash con sal), vence en 10 min, 5 intentos |
| `posts/{id}` | Autor (crear/editar), terceros (solo su like), admin | Público | Exige correo verificado |
| `posts/{id}/comments/{id}` | Autor del comentario; borra también el autor del post o el admin | Público | F1-07 |
| `pqrs/{id}` | Dueño (crear), admin (responder) | Dueño, admin | |
| `reportes/{id}` | Usuario (crear) | Admin | |
| `entry_logs/{id}` | Servidor (recepción) | Admin (recepción vía API) | Un documento por ingreso |
| `checkIns/{entryId}` | Servidor | Admin (recepción vía API) | Copia resumida del ingreso |
| `daily_stats/{YYYY-MM-DD}` | Servidor (transacción del ingreso) | Admin vía API | Agregados de asistencia |
| `inventory_counts/{id}` | Servidor (recepción reporta, admin revisa) | Admin vía API | |
| `inventory_movements/{id}` | Servidor | Admin | Venta, ajuste manual, conteo |
| `notifications/{id}` | Servidor | Admin | Campana del panel |
| `audit_logs/{id}` | Servidor | Admin | Inmutable |
| `consents/{uid}_{tipo}` | Servidor | — | Prueba de autorización (Ley 1581) |
| `news/{id}` | Admin | Público (publicadas) | Noticias del foro |
| `_migrations/{id}` | Servidor | — | Registro de migraciones |
| `system/health` | — | Servidor | Lectura de prueba de `/api/health` |

## `users/{uid}`
| Campo | Tipo | Notas |
|---|---|---|
| uid, email | string | Del token al registrarse |
| username | string | 2–40 caracteres |
| avatar | string | id de `lib/avatar-utils.ts` |
| photoURL | string \| null | |
| gender | `'masculino' \| 'femenino' \| 'otro'` | opcional |
| peso, altura | number | opcionales; dato sensible (Ley 1581): solo con consentimiento |
| plan | objeto \| null | `{ nombre, planId, precio, dias_total, inicio, expira, acompanante? }` |
| plan.acompanante | `{ nombre, email, rutinaDias[] }` | máx. 3 días |
| lastEntryAt | Timestamp | último ingreso (lo actualiza recepción) |
| createdAt | Timestamp | |

## `planes/{id}`
`name, description, price (COP), days (int ≥ 1), features[], featured, ribbon, icon, createdAt, updatedAt`

## `products/{id}`
`nombre, descripcion, precio (COP), categoria, stock (int), lowStockThreshold (int, por defecto 5), imagen_url, badge, colores[], tallas[], created_at`

## `orders/{paymentIntentId}`
- Plan: `uid, customerName, customerEmail, type: 'plan', planId, concepto, total, fecha, status`
- Productos: `uid, customerName, customerEmail, items[{id, nombre, precio, cantidad}], total, banco, fecha, status, archived?`

## `entry_logs/{id}`
`userId, userName, userEmail, hasPlanActivo, planNombre, planExpira, timestamp, date (YYYY-MM-DD), source ('qr'|'manual'|'offline'), authorizedBy (correo), authorizedByUid`

## `daily_stats/{YYYY-MM-DD}`
`date, visits, uniqueMembers, withPlan, withoutPlan, byHour { "05": n, … "22": n }, updatedAt, rebuiltAt?`

## `inventory_counts/{id}`
`productId, productName, counted, systemStock, difference, note, status ('pending'|'approved'|'rejected'), reportedBy, reportedByUid, createdAt, reviewedBy?, reviewedAt?`

## `inventory_movements/{id}`
`productId, productName, type ('sale'|'manual_adjustment'|'count_adjustment'), before, after, delta, orderId?, countId?, actorEmail?, actorUid?, createdAt`

## `posts/{id}` y `posts/{id}/comments/{id}`
- Post: `autor_id, autor_username, autor_avatar, autor_is_premium, contenido (≤ 2000), imagen_url, imagen_public_id, tipo_recurso, likes[uid], comentarios[] (heredado; vacío tras la migración 001), created_at`
- Comentario: `autor_id, autor_username, autor_avatar, autor_is_premium, contenido (≤ 1000), created_at, edited_at?`

## `consents/{uid}_{tipo}`
`uid, type ('terms'|'privacy'|'sensitive_data'), granted (bool), version, ip, userAgent, createdAt`

## `news/{id}`
`titulo, descripcion, imagen_url, published (bool), publishAt, createdAt, createdBy`
