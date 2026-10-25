# Staging y respaldos

Guía para dos pendientes de la salida a producción: un entorno de pruebas separado de los datos reales y los respaldos de la base de datos con su simulacro de restauración (checklist B7, F2-01 y F2-02).

Hoy todo usa el proyecto `fitmania-e1748`. Al salir a producción ese proyecto pasa a tener datos reales, así que las pruebas de pagos, migraciones y carga deben hacerse en otro lado.

---

## 1. Entorno de staging

### 1.1 Proyecto de Firebase

1. Consola de Firebase → **Agregar proyecto** → `fitmania-staging`. Si el ID ya está tomado, usa otro y cámbialo en `.firebaserc`.
2. **Authentication** → Método de acceso → activar *Correo/contraseña* (y TOTP si se quiere probar).
3. **Firestore** → Crear base de datos en la **misma ubicación** que producción.
4. Configuración del proyecto:
   - Tus apps → **Web**: copiar las variables `NEXT_PUBLIC_FIREBASE_*`.
   - Cuentas de servicio → **Generar clave privada**: de ahí salen `FIREBASE_*`.
5. Desde la carpeta del proyecto:

   ```bash
   npx firebase use staging          # alias definido en .firebaserc
   npx firebase deploy --only firestore:rules,firestore:indexes
   npx firebase use fitmania         # volver a producción
   ```

6. Datos mínimos:
   - Crear una cuenta en el sitio de staging y darle el rol de admin con `node scripts/grant-admin.js <correo>`, con `.env.local` apuntando a staging.
   - Cargar los planes y productos desde el panel admin; los productos se pueden importar.

### 1.2 Despliegue en Vercel

1. Vercel → el proyecto → Settings → **Environment Variables**. Cargar en el entorno **Preview** las variables de `.env.example` con los valores de staging:
   - Firebase: las del proyecto `fitmania-staging`.
   - Mercado Pago: credenciales de **prueba** (`TEST-...`) y el secreto del webhook de esa misma aplicación.
   - `ADMIN_GATE_KEY`, `RECEPTION_GATE_KEY`, `CRON_SECRET`: valores **distintos** a los de producción.
   - Pase QR: un par de llaves propio (`node tools/generate-qr-keys.mjs`).
   - Upstash: una base aparte (el plan gratuito permite varias).
   - `NEXT_PUBLIC_SITE_URL`: la URL de staging.
2. Crear la rama `staging` y, en Settings → Domains, asignarle un dominio como `staging.tudominio.com`.
3. En Mercado Pago (aplicación de prueba) → Webhooks: `https://staging.tudominio.com/api/payments/mercadopago/webhook`.

Las variables *Preview* aplican a todas las ramas que no son `main`. Así, cualquier PR se despliega contra staging y nunca contra los datos reales.

### 1.3 Para qué se usa

- Pagos de prueba con tarjetas de prueba de Mercado Pago antes de cada salida.
- Simular y ejecutar migraciones nuevas antes de correrlas en producción.
- La prueba de carga: `k6 run tools/load-test.js` con la URL de staging.
- Pruebas E2E de navegador (Playwright).
- El simulacro de restauración de respaldos (sección 2.4).

---

## 2. Respaldos

Requiere el plan **Blaze** en el proyecto de producción. Los comandos usan la [CLI de Google Cloud](https://cloud.google.com/sdk/docs/install) (`gcloud auth login` una vez).

```bash
gcloud config set project fitmania-e1748
```

### 2.1 Recuperación a un punto en el tiempo (PITR)

Permite leer la base tal como estaba en cualquier minuto de los últimos 7 días.

```bash
gcloud firestore databases update --database='(default)' --enable-pitr
```

### 2.2 Respaldos programados

```bash
# Diario, se conserva 14 semanas (el máximo)
gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14w

# Verificar
gcloud firestore backups schedules list --database='(default)'
gcloud firestore backups list --location=<ubicación de la base, p. ej. nam5>
```

### 2.3 Copia fuera de la base (mensual)

Los respaldos de Firestore viven en el mismo proyecto. Una exportación mensual a un bucket da una copia independiente que se puede guardar por más tiempo.

```bash
gcloud storage buckets create gs://fitmania-respaldos --location=<misma ubicación>
gcloud firestore export gs://fitmania-respaldos/$(date +%Y-%m-%d)
```

**Las cuentas de usuario no están en Firestore.** Firebase Auth se respalda aparte:

```bash
npx firebase auth:export usuarios-$(date +%Y-%m-%d).json --project fitmania-e1748
```

El archivo incluye los hashes de las contraseñas. Hay que guardarlo cifrado y fuera del repositorio.

### 2.4 Simulacro de restauración (trimestral)

Objetivo: tener la base recuperada en **4 horas o menos** (RTO) y perder **como máximo 1 minuto** de datos (RPO, con PITR).

1. Elegir el respaldo más reciente: `gcloud firestore backups list --location=<ubicación>`.
2. Restaurar en una base **nueva**. Nunca encima de `(default)`:

   ```bash
   gcloud firestore databases restore \
     --source-backup=projects/fitmania-e1748/locations/<ubicación>/backups/<ID> \
     --destination-database=restauracion-prueba
   ```

3. Verificar en la consola, en la base `restauracion-prueba`, que estén `users`, `orders`, `payments` y `entry_logs`, y que los conteos sean parecidos a los de producción.
4. Anotar el tiempo total en la tabla de abajo.
5. Borrar la base de prueba: `gcloud firestore databases delete --database=restauracion-prueba`.

Si hay que restaurar de verdad, lo más seguro es recuperar solo lo dañado:
- exportar desde la base restaurada solo las colecciones afectadas (`gcloud firestore export ... --collection-ids=orders,payments`);
- importarlas en `(default)` con `gcloud firestore import`.

Así no se pisan los datos buenos que llegaron después del respaldo.

| Fecha | Respaldo usado | Tiempo total | Resultado | Responsable |
|---|---|---|---|---|
| | | | | |
