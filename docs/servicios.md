# Inventario de servicios — FITMANIA

F2-27. Cada servicio debe estar **a nombre del negocio** (no del desarrollador), con 2FA y alertas de presupuesto. Completar las columnas marcadas.

| Servicio | Uso | Dueño de la cuenta | Plan | Límite / costo relevante | Variables | Si falla |
|---|---|---|---|---|---|---|
| Vercel | Hosting, API, cron diario | [completar] | **Pro** (Hobby prohíbe uso comercial) | Funciones y ancho de banda por plan | todas las de la app | Runbook §1 |
| Firebase / GCP | Auth, Firestore, Cloud Messaging, backups | [completar] | **Blaze** (backups y PITR) | Lecturas/escrituras Firestore; alertas de presupuesto en GCP | `FIREBASE_*`, `NEXT_PUBLIC_FIREBASE_*` | Runbook §2 |
| Mercado Pago (Checkout Pro) | Cobros: tarjeta, PSE, Efecty (única pasarela) | [completar] | Comisión por transacción | Webhook `/api/payments/mercadopago/webhook`, evento *Pagos*, firma `x-signature` | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Runbook §5 |
| Resend | Correos transaccionales | [completar] | [completar] | Requiere dominio verificado (SPF/DKIM/DMARC) | `RESEND_API_KEY`, `MAIL_FROM`, `ADMIN_COPY_EMAIL` | Los pagos siguen; revisar `email_events` |
| Upstash Redis | Rate limiting | [completar] | Free/Pay-as-you-go | Comandos por día | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | La app sigue; paneles fail-closed |
| Cloudinary | Imágenes del foro y avatares | [completar] | Free/Plus | Créditos de almacenamiento y transformación | `NEXT_PUBLIC_CLOUDINARY_*`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Imágenes rotas; el resto funciona |
| Dominio y DNS | URL pública y correo | [completar] | Anual | Renovación automática activada | `NEXT_PUBLIC_SITE_URL` | Todo inaccesible por nombre |
| reCAPTCHA Enterprise (App Check) | Protección de Firestore/Auth contra abuso | [completar] | Gratuito hasta un umbral | — | `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` | Desactivar el enforcement en la consola |
| Monitor de uptime | Alertas de caída (`/api/health`) | [completar] | [completar] | — | — | — |
| Facturación electrónica (DIAN) | Facturas de cada pago | [completar] | [completar] | Por documento | [pendiente de integración] | Emitir manualmente desde el proveedor |

## Variables de configuración (no secretas)
| Variable | Efecto |
|---|---|
| `ADMIN_REQUIRE_MFA=true` | El panel admin exige verificación en dos pasos (activar después de inscribir el TOTP). |
| `QR_REQUIRE_SIGNED=true` | Recepción rechaza los QR antiguos (UID); activar cuando todos los socios tengan la app actualizada. |
| `RECEPTION_AUTHORIZED_EMAIL` | Opcional: lista de correos de recepción separados por coma (además del claim). |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Activa las notificaciones push. |

## Revisión periódica
- **Mensual:** costos vs presupuesto, `email_events` fallidos, cron (`/api/health`), conteos de inventario pendientes.
- **Trimestral:** probar la restauración de un backup en staging (Runbook §7).
- **Anual:** rotar todas las credenciales (Runbook §8) y renovar el dominio.
