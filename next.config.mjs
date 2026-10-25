import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // No anunciar el framework en las cabeceras (X-Powered-By).
  poweredByHeader: false,
  // Solo desarrollo: permite navegar el servidor local a través de un túnel https
  // (pruebas de Mercado Pago con retorno automático y webhook).
  allowedDevOrigins: ['*.trycloudflare.com'],
  turbopack: {
    root: __dirname,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
