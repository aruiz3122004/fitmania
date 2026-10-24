# Checklist de salida a producción (F4-05)

Congelamiento de código previsto: **29-dic-2026**. Este documento se completa y lo firma el dueño antes del despliegue final. Estado al **24-oct-2026**.

Leyenda: ✅ cerrado · 🟡 código listo, falta configuración o trámite · ❌ pendiente.

## 1. Bloqueantes del plan de mejora (B1–B10)

| # | Bloqueante | Estado | Qué falta |
|---|---|---|---|
| B1 | Pasarela local (PSE, tarjeta, Efecty) | 🟡 | Mercado Pago listo y probado en sandbox. Falta verificar la cuenta y pasar a credenciales de producción (F0-01). Retirar Stripe (F1-23) |
| B2 | Cliente crea su perfil con `plan` | ✅ | El perfil lo crea el servidor; las reglas no permiten `create` desde el cliente |
| B3 | Activación del plan según el nombre | ✅ | Duración desde `planes/{id}.days` (los 3 planes la tienen) |
| B4 | Webhook sin idempotencia | ✅ | Mercado Pago: transición de estado en una transacción, 5xx ante fallos y pruebas F1-28 |
| B5 | Reinicio libre del rate limit | ✅ | Endpoint eliminado |
| B6 | QR = UID fijo | 🟡 | Pase firmado listo (F2-05). Faltan `QR_SIGNING_PRIVATE_KEY` y `NEXT_PUBLIC_QR_PUBLIC_KEY` en Vercel |
| B7 | Sin backups | ❌ | Backups diarios + PITR (F2-01) y simulacro de restauración (F2-02) |
| B8 | Credenciales sin rotar | ❌ | Rotar todas antes del go-live (F0-04) |
| B9 | Política de datos y consentimiento | 🟡 | Consentimientos implementados. Falta la revisión legal de los textos y los datos del responsable (F3-09) |
| B10 | Planes de Vercel y Firebase | ❌ | Vercel Pro + Firebase Blaze con alertas de presupuesto (F0-02) |

## 2. Despliegue

Hacerlo **en este orden** y en la misma ventana: las reglas nuevas cierran escrituras que el código anterior todavía usa.

1. [ ] Variables en Vercel (Production): todas las de `readme.md` §14 + `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `SENTRY_DSN`, `CRON_SECRET`, `UPSTASH_*`, `QR_*`, `CLOUDINARY_API_*`. **No** definir `MERCADOPAGO_PUBLIC_URL` ni `MERCADOPAGO_API_URL`.
2. [ ] Merge de `fix/fase1-criticos` a `main` y deploy en Vercel.
3. [ ] `firebase deploy --only firestore:rules,firestore:indexes --project fitmania-e1748` **inmediatamente después** del deploy del código.
4. [ ] Panel admin → Sistema → Migraciones: simular y ejecutar `004_public_profiles` y `005_close_historical_daily_stats`.
5. [ ] Mercado Pago (producción) → Webhooks: URL `https://<dominio>/api/payments/mercadopago/webhook`, evento *Pagos*; copiar la clave en `MERCADOPAGO_WEBHOOK_SECRET` y re-desplegar.

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
- [ ] Datos de prueba borrados de Firestore (órdenes `sim_*`, `pi_mock_*`, `pi_lowstock_*`).

## 5. Firma

| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| Dueño | | | |
| Desarrollo | | | |
