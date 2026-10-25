# Modo sandbox

Copia del sitio para que cualquier visitante (un reclutador, un cliente potencial) pruebe
FITMANIA completo —como socio, recepcionista y administrador— sin tocar la aplicación real.

## Cómo funciona

```
Sitio real (fitmania)                          Sitio sandbox (fitmania-sandbox)
┌──────────────────────────┐   botón del menú   ┌───────────────────────────────────┐
│ Firebase: proyecto real  │ ─────────────────► │ Firebase: proyecto SOLO de pruebas │
│ Mercado Pago real        │  "Modo Sandbox"    │ Pasarela simulada                  │
│ Correos reales (Resend)  │                    │ Correos al buzón simulado          │
└──────────────────────────┘ ◄───────────────── └───────────────────────────────────┘
                                "Salir y borrar mis datos"
```

- **Aislamiento total.** El sandbox es otro despliegue del mismo código, con otro proyecto
  de Firebase. No tiene las credenciales del real, así que ningún error puede tocar esos datos.
- **Cuenta temporal.** "Entrar al sandbox" crea una cuenta con los tres roles (socio,
  recepción y admin), válida por 2 horas. No hay registro ni contraseña.
- **Datos de ejemplo.** 14 socios con distintos planes (activos, por vencer, vencidos,
  uno congelado), 3 semanas de ingresos, ventas, 12 publicaciones en el foro, noticias,
  PQRS y un reporte. Salen de `lib/sandbox/seed.ts`, siempre iguales.
- **Pagos.** `/pago/sandbox` reemplaza a Mercado Pago. El pago se aplica con la misma
  función que un webhook real (`syncMercadoPagoPayment`): activa el plan o descuenta el
  stock, crea la orden, avisa al panel y manda el recibo.
- **Correos.** Ninguno sale a internet. Se guardan en `sandbox_mail` y el visitante los
  lee en el **buzón simulado** de la barra del sandbox.
- **Diferencial.** Marco de avatar "Explorador" 🧪 (verde con franjas de advertencia), barra
  flotante con tiempo restante, cambio de rol con un clic y una lista de **misiones**.
- **Limpieza.**
  - "Salir y borrar mis datos" (o cerrar sesión) borra la cuenta y todo lo que hizo.
  - Si cierra la pestaña sin salir, se borra cuando vence (en la siguiente visita o en el cron diario).
  - Si un visitante entra y no hay nadie más, los datos de ejemplo se restauran completos.
  - El cron diario (`/api/cron/sandbox`) restaura todo si no hay nadie dentro.
- **Doble seguro.** Para borrar o restaurar datos, el despliegue debe tener
  `NEXT_PUBLIC_SANDBOX_MODE=true` **y** `SANDBOX_FIREBASE_PROJECT_ID` igual a su
  `FIREBASE_PROJECT_ID`. Si alguien activa el modo por error en el sitio real, el reinicio
  se niega.
- **Protecciones.**
  - Hasta 6 visitas por hora por red y 40 visitas simultáneas.
  - Un visitante no puede modificar ni borrar la cuenta de otro desde el panel.
  - El sitio sandbox no se indexa en buscadores.

## Probarlo en tu computador (sin crear nada)

```bash
npm run sandbox:local          # emuladores + next dev → http://localhost:3400/sandbox
npm run test:e2e:sandbox       # las 4 pruebas automáticas del recorrido
```

Requiere Java 21 (el emulador de Firestore). Todo vive en los emuladores: al cerrarlos se borra.

## Publicarlo (lo haces tú, ~30 minutos)

### 1. Proyecto de Firebase solo para el sandbox
1. [console.firebase.google.com](https://console.firebase.google.com) → **Agregar proyecto** →
   nombre `fitmania-sandbox` (sin Analytics). El plan gratuito (Spark) alcanza.
2. **Firestore Database** → Crear base de datos → modo producción → misma región que el real.
3. **Authentication** → Comenzar. No hace falta activar proveedores: el sandbox entra con
   tokens propios.
4. **Configuración del proyecto → General → Tus apps → Web** → registra una app y copia la
   configuración (`apiKey`, `authDomain`, `projectId`, `appId`, `messagingSenderId`).
5. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** →
   descarga el JSON (es la credencial del servidor del sandbox; no la subas a git).
6. Publica reglas e índices en ESE proyecto:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project sandbox
   ```
   (El alias `sandbox` está en `.firebaserc`. Si tu proyecto tiene otro ID, cámbialo ahí.)

### 2. Segundo proyecto de Vercel
1. Vercel → **Add New → Project** → importa el **mismo repositorio** → nombre
   `fitmania-sandbox`. El plan Hobby sirve para un portafolio.
2. **Settings → Environment Variables** (Production):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SANDBOX_MODE` | `true` |
| `NEXT_PUBLIC_MAIN_SITE_URL` | URL del sitio real, p. ej. `https://fitmania.vercel.app` |
| `SANDBOX_FIREBASE_PROJECT_ID` | el ID del proyecto del sandbox (igual a `FIREBASE_PROJECT_ID`) |
| `NEXT_PUBLIC_FIREBASE_*` | la configuración web del **proyecto sandbox** (paso 1.4) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY_B64` | del JSON del **proyecto sandbox** (paso 1.5) |
| `ADMIN_GATE_KEY`, `RECEPTION_GATE_KEY` | llaves NUEVAS (no las del real): `openssl rand -hex 32` |
| `CRON_SECRET` | uno nuevo |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | recomendado: una base gratuita aparte en Upstash |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | opcional; mejor una cuenta gratuita aparte (las subidas van a `fitmania-sandbox/` y se vacían al reiniciar) |
| `NEXT_PUBLIC_SITE_URL` | la URL del sandbox |

**No pongas** en el sandbox: `MERCADOPAGO_*`, `RESEND_API_KEY`, `ADMIN_AUTHORIZED_EMAIL`,
`RECEPTION_AUTHORIZED_EMAIL`, `ADMIN_REQUIRE_MFA` ni ninguna credencial del proyecto real.

3. Despliega. Abre `https://<tu-sandbox>.vercel.app/sandbox` y pulsa **Entrar al sandbox**.
   La primera visita tarda unos segundos más: siembra los datos de ejemplo.

### 3. Botón en el sitio real
En el proyecto de Vercel del sitio **real** agrega `NEXT_PUBLIC_SANDBOX_URL` con la URL del
sandbox y vuelve a desplegar. Aparece el botón verde **"Modo Sandbox"** en la barra superior,
en el menú del celular y en el menú de cuenta (sin sesión).

## Costos y límites
- Cada restauración completa escribe unos 1.000 documentos. El plan gratuito de Firestore
  da 20.000 escrituras al día: alcanza para unas 15 visitas diarias "en solitario" más el uso
  normal. Si el portafolio recibe mucho tráfico, pasa el proyecto del sandbox a Blaze con un
  presupuesto con alerta (por ejemplo, USD 1).
- Las cuentas temporales se crean y borran en Firebase Auth (sin costo en este volumen).
