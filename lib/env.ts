/**
 * Validación de variables de entorno (F1-02).
 *
 * Se revisa al arrancar el servidor (instrumentation.ts) y en /api/health. Las
 * críticas impiden operar (base de datos, sesiones, pagos); las recomendadas
 * apagan una función concreta. Solo se informan NOMBRES, nunca valores.
 */
const CRITICAL = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'ADMIN_GATE_KEY',
  'RECEPTION_GATE_KEY',
] as const;

const RECOMMENDED: Record<string, string> = {
  UPSTASH_REDIS_REST_URL: 'rate limiting',
  UPSTASH_REDIS_REST_TOKEN: 'rate limiting',
  RESEND_API_KEY: 'correos',
  CRON_SECRET: 'job diario (vencimientos)',
  INTERNAL_MIDDLEWARE_SECRET: 'auditoría de bloqueos',
  NEXT_PUBLIC_SITE_URL: 'URLs absolutas (SEO, correos)',
  QR_SIGNING_PRIVATE_KEY: 'pase de acceso firmado',
  NEXT_PUBLIC_QR_PUBLIC_KEY: 'verificación del pase sin conexión',
  CLOUDINARY_API_KEY: 'subidas firmadas',
  CLOUDINARY_API_SECRET: 'subidas firmadas',
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: 'notificaciones push',
  MERCADOPAGO_ACCESS_TOKEN: 'pagos con Mercado Pago (tarjeta, PSE, Efecty)',
  MERCADOPAGO_WEBHOOK_SECRET: 'firma de los webhooks de Mercado Pago',
};

export interface EnvReport {
  missingCritical: string[];
  missingRecommended: { name: string; feature: string }[];
}

export function checkEnv(): EnvReport {
  const has = (name: string) => !!process.env[name]?.trim();
  const missingCritical: string[] = CRITICAL.filter((n) => !has(n));
  // La clave privada de Firebase admite dos formatos.
  if (!has('FIREBASE_PRIVATE_KEY_B64') && !has('FIREBASE_PRIVATE_KEY')) missingCritical.push('FIREBASE_PRIVATE_KEY_B64');
  const missingRecommended = Object.entries(RECOMMENDED)
    .filter(([name]) => !has(name))
    .map(([name, feature]) => ({ name, feature }));
  return { missingCritical, missingRecommended };
}

export function logEnvReport() {
  const { missingCritical, missingRecommended } = checkEnv();
  if (missingCritical.length) {
    console.error(`[env] FALTAN variables CRÍTICAS: ${missingCritical.join(', ')}. La app no funcionará correctamente.`);
  }
  for (const { name, feature } of missingRecommended) {
    console.warn(`[env] Falta ${name}: se desactiva ${feature}.`);
  }
}
