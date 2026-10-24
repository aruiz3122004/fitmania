/**
 * Perfil público del socio (F1-09): nombre y foto que se muestran en el foro.
 * Vive en `public_profiles/{uid}` (lectura pública, escritura solo del servidor) para
 * no exponer `users/{uid}` ni copiar la foto en cada post. Sin imports del proyecto
 * para poder probarlo con `node --test`.
 */

// Misma política que `safeImageUrl` en firestore.rules: Cloudinary o imágenes del sitio.
const SAFE_IMAGE = /^(https:\/\/res\.cloudinary\.com\/.*|\/Imagenes\/.*)$/;

export function isSafeImageUrl(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 500 && SAFE_IMAGE.test(v);
}

export function publicProfileOf(data: { username?: unknown; photoURL?: unknown }) {
  return {
    username: String(data.username || 'Socio').slice(0, 40),
    photoURL: isSafeImageUrl(data.photoURL) ? data.photoURL : null,
  };
}
