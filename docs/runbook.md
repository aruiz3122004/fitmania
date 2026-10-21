# Runbook de contingencias — FITMANIA

Qué hacer cuando algo falla (F2-08). Mantener impreso en recepción y actualizado. Responsable de turno: ver contactos al final.

## 0. Diagnóstico rápido (2 minutos)
1. Abrir `https://<dominio>/api/health`:
   - `firestore: false` → **§2 Base de datos**.
   - `rateLimit: false` → la protección contra fuerza bruta está apagada; la app funciona igual. Revisar Upstash.
   - `cron: false` → el job diario no corrió (avisos de vencimiento y noticias pendientes). Revisar Vercel → Crons.
2. Si la URL no responde → **§1 Hosting** o **§3 Internet de la sede**.
3. Página de estado pública: `<URL del status page>` (configurar, F2-12).

## 1. Cae Vercel (la app no carga desde ningún lado)
1. Confirmar en https://www.vercel-status.com.
2. Recepción pasa a **contingencia en papel** (§4) si el panel no estaba abierto.
3. Avisar a los socios (WhatsApp / redes): los pases ya cargados en el celular siguen sirviendo para identificarse.
4. Al volver: cargar la planilla (Recepción → Historial → "Cargar planilla en papel").

## 2. Cae Firebase (Auth / Firestore)
1. Confirmar en https://status.firebase.google.com.
2. Recepción: si el panel está abierto, sigue operando **sin conexión** (pase firmado + cola local). Si no, planilla en papel (§4).
3. Pagos: el webhook reintenta solo (responde 5xx si no puede escribir). Revisar al día siguiente que todas las órdenes del día existan.

## 3. Se cae el internet de la sede
1. El panel de recepción muestra **"Sin conexión"**: seguir escaneando. Los pases firmados se verifican localmente y los ingresos quedan en cola.
2. QR antiguos (UID) solo se aceptan si el socio está en el directorio guardado.
3. Al volver la red, la cola se sincroniza sola (indicador "pendientes"). No cerrar el navegador mientras haya pendientes.
4. Si se reinicia el equipo sin red: usar la planilla en papel (§4).

## 4. Contingencia en papel
1. Imprimir `/planilla-ingresos` (tener 5 copias impresas en recepción).
2. Anotar hora, nombre, documento o correo y si el plan está vigente (según el pase del celular).
3. Al restablecerse, cargar cada fila con su **hora real** (máximo 7 días atrás). Los duplicados se detectan solos.
4. Archivar la planilla firmada.

## 5. Pagos
- **Pago cobrado pero el plan no se activó**: buscar el ID de la transacción en Admin → Compras. Si no está, revisar los eventos del webhook en la pasarela y reenviarlo (es idempotente).
- **Reembolso**: hacerlo desde la pasarela. El webhook revierte días del plan o repone stock automáticamente (reembolso total).
- **Venta sin stock**: el sistema reembolsa automáticamente las unidades faltantes y avisa en la campana del admin. Si falla, la notificación dice "ACCIÓN REQUERIDA".

## 6. Seguridad
- **Credencial expuesta** (clave en un chat, repositorio, correo): rotarla de inmediato (§8) y revisar `audit_logs`.
- **Cuenta de admin comprometida**: desde otra cuenta admin (o la consola de Firebase) quitar el claim, revocar sesiones (`revokeRefreshTokens`) y rotar contraseñas; revisar `audit_logs` por `requestId` e IP.
- **Bloqueo por rate limit del panel**: esperar el tiempo indicado; el contador se reinicia tras un login correcto.

## 7. Restaurar un backup de Firestore
1. Consola GCP → Firestore → Backups (o PITR para los últimos 7 días).
2. **Restaurar SIEMPRE primero en el proyecto de staging** y verificar.
3. Para recuperar solo una colección o documento: exportar del backup a GCS e importar selectivamente con `gcloud firestore import`.
4. Registrar la hora de inicio y fin (RTO objetivo ≤ 4 h).

## 8. Rotar una credencial
| Credencial | Dónde se genera | Variable |
|---|---|---|
| Cuenta de servicio Firebase | GCP → IAM → Cuentas de servicio → Claves | `FIREBASE_PRIVATE_KEY_B64`, `FIREBASE_CLIENT_EMAIL` |
| Pasarela de pagos | Panel de la pasarela | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (o los de la nueva pasarela) |
| Resend | resend.com → API Keys | `RESEND_API_KEY` |
| Upstash | console.upstash.com | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Cloudinary | cloudinary.com → API Keys | `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Llaves de paneles | Generar 32+ caracteres aleatorios | `ADMIN_GATE_KEY`, `RECEPTION_GATE_KEY` |
| Pase de acceso QR | `node tools/generate-qr-keys.mjs` | `QR_SIGNING_PRIVATE_KEY`, `NEXT_PUBLIC_QR_PUBLIC_KEY` (rotarla invalida los pases de 24 h guardados) |
| Secretos internos | Aleatorios | `CRON_SECRET`, `INTERNAL_MIDDLEWARE_SECRET` |

Después de cambiar variables en Vercel hay que **re-desplegar**. Revocar la credencial vieja solo cuando la nueva esté funcionando.

## 9. Contactos
| Rol | Nombre | Teléfono | Correo |
|---|---|---|---|
| Dueño / administrador | [completar] | [completar] | [completar] |
| Soporte técnico | [completar] | [completar] | [completar] |
| Pasarela de pagos (soporte) | — | [completar] | [completar] |
