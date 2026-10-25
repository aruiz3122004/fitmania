# Checklist de salida a producción (F4-05)

Congelamiento de código previsto: **29-dic-2026**. Este documento se completa y lo firma el dueño antes del despliegue final. Estado al **25-oct-2026**.

Leyenda: ✅ cerrado · 🟡 código listo, falta configuración o trámite · ❌ pendiente.

## 1. Bloqueantes del plan de mejora (B1–B10)

| # | Bloqueante | Estado | Qué falta |
|---|---|---|---|
| B1 | Pasarela local (PSE, tarjeta, Efecty) | 🟡 | Mercado Pago listo y probado en sandbox; Stripe ya retirado (F1-23). Falta verificar la cuenta y pasar a credenciales de producción (F0-01) |
| B2 | Cliente crea su perfil con `plan` | ✅ | El perfil lo crea el servidor; las reglas no permiten `create` desde el cliente |
| B3 | Activación del plan según el nombre | ✅ | Duración desde `planes/{id}.days` (los 3 planes la tienen) |
| B4 | Webhook sin idempotencia | ✅ | Mercado Pago: transición de estado en una transacción, 5xx ante fallos y pruebas F1-28 |
| B5 | Reinicio libre del rate limit | ✅ | Endpoint eliminado |
| B6 | QR = UID fijo | 🟡 | Pase firmado listo (F2-05). Generar con `node tools/generate-qr-keys.mjs` y cargar `QR_SIGNING_PRIVATE_KEY`, `NEXT_PUBLIC_QR_PUBLIC_KEY` y `QR_REQUIRE_SIGNED=true` en Vercel |
| B7 | Sin backups | ❌ | Backups diarios + PITR (F2-01), copia de Firebase Auth y simulacro de restauración (F2-02). Comandos en `docs/staging-y-respaldos.md` |
| B8 | Credenciales sin rotar | ❌ | Rotar todas antes del go-live (F0-04) |
| B9 | Política de datos y consentimiento | 🟡 | Consentimientos implementados. Falta la revisión legal de los textos y los datos del responsable (F3-09) |
| B10 | Planes de Vercel y Firebase | ❌ | Vercel Pro + Firebase Blaze con alertas de presupuesto (F0-02) |
| B11 | Correo con dominio propio | ❌ | Verificar el dominio en Resend y definir `MAIL_FROM`. En modo de prueba solo llega correo al dueño de la cuenta: sin esto no llegan recibos ni códigos de verificación en dos pasos |
| B12 | Datos legales reales | ❌ | Razón social, NIT, correo de habeas data y teléfono en `lib/legal.ts` y `components/layout/footer.tsx`; subir `LEGAL_VERSION` |
| B13 | Facturación electrónica DIAN | ❌ | Proveedor autorizado o concepto del contador |
| B14 | Entorno de staging | ❌ | Proyecto Firebase y entorno Preview de Vercel aparte (`docs/staging-y-respaldos.md`). Hoy pruebas y producción comparten `fitmania-e1748` |

## 1b. Hecho el 25-oct-2026

- ✅ Stripe retirado: Mercado Pago es la única pasarela.
- ✅ Verificación en dos pasos opcional por correo para socios, recepción y admin, con códigos de recuperación. Se exige también en las reglas de Firestore.
- ✅ CI con tipos, 80 pruebas unitarias, 17 pruebas de reglas en el emulador, lint, build, 18 corridas E2E (Playwright) y `npm audit`.
- ✅ Marco de color por plan, página de preguntas frecuentes, pantallas de carga y avisos de proyecto ficticio y de contenido asistido por IA.
- ✅ Cola sin conexión de recepción con almacenamiento persistente, aviso al cerrar y respaldo CSV.
- ✅ Conciliación de pagos con presupuesto de tiempo; un checkout abandonado vence a las 24 h.
- ✅ Rutas sin uso eliminadas (`/api/public/planes`, `/api/public/products`, `/api/admin/stats`, `/api/diag`).

## 2. Despliegue

Hacerlo **en este orden** y en la misma ventana: las reglas nuevas cierran escrituras que el código anterior todavía usa.

1. [ ] Variables en Vercel (Production): todas las de `.env.example` (y `readme.md` §14) + `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `SENTRY_DSN`, `CRON_SECRET`, `UPSTASH_*`, `QR_*`, `CLOUDINARY_API_*`. **No** definir `MERCADOPAGO_PUBLIC_URL` ni `MERCADOPAGO_API_URL`.
2. [ ] Merge de `fix/fase1-criticos` a `main` y deploy en Vercel.
3. [ ] `firebase deploy --only firestore:rules,firestore:indexes --project fitmania-e1748` **inmediatamente después** del deploy del código. Entre uno y otro, las publicaciones premium del foro fallan (las reglas viejas no conocen `autor_plan_tier`).
4. [ ] Panel admin → Sistema → Migraciones: simular y ejecutar `004_public_profiles` y `005_close_historical_daily_stats`.
5. [ ] Mercado Pago (producción) → Webhooks: URL `https://<dominio>/api/payments/mercadopago/webhook`, evento *Pagos*; copiar la clave en `MERCADOPAGO_WEBHOOK_SECRET` y re-desplegar. La clave debe ser de **la misma aplicación** que el access token; si no, todos los avisos reales dan 401.

## 3. Verificación después del deploy

- [ ] `GET /api/health` → `status: ok` y `config: ok`.
- [ ] `/fitministration` y `/fitception` sin llave → 404; con el botón del menú de cuenta → entran.
- [ ] Pago real de bajo monto con tarjeta y con PSE, y su reembolso desde Mercado Pago (F4-03): orden, plan o stock, correo y notificación al admin.
- [ ] Cron diario: en el panel (Sistema) aparece la última ejecución del día; `system/cron` incluye `payments` y `attendance`.
- [ ] Un error forzado aparece en Sentry con su `requestId` (F2-11).
- [ ] Cambiar la foto de perfil se ve en los posts del foro.
- [ ] Recepción: escanear un pase firmado, registrar un ingreso y ver el directorio por estado.

## 4. Operación

- [ ] Backup restaurado en staging con RTO ≤ 4 h (F2-02).
- [ ] Simulacro del plan B: 30 min sin internet en recepción (F4-02).
- [ ] Capacitación de recepción (F4-04).
- [ ] Contactos y dueños completos en `docs/runbook.md` y `docs/servicios.md`.
- [ ] Datos de prueba borrados de Firestore: `node scripts/clean-test-data.mjs` (simula) y luego con `--apply --project=fitmania-e1748`. Con `--scope=prelaunch` se reinicia todo lo transaccional; después, revisar el stock.
- [ ] Cuentas de prueba borradas desde el panel admin.
- [ ] Recepción sabe que no debe borrar los datos del navegador con ingresos pendientes (la cola sin internet vive en el equipo).
- [ ] App Check con reCAPTCHA Enterprise en modo obligatorio (`NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY`).
- [ ] Monitor externo de `/api/health` cada 5 min con alerta por correo.

## 5. Firma

| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| Dueño | | | |
| Desarrollo | | | |
