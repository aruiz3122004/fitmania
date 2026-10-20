/**
 * Datos legales del responsable del tratamiento (F3-09). COMPLETAR antes de
 * producción y hacer revisar los textos de /legal/* por un abogado.
 *
 * Cambiar `LEGAL_VERSION` cada vez que cambie el texto de términos o política:
 * queda guardada en cada consentimiento (`consents/*`) como prueba ante la SIC.
 */
export const LEGAL_VERSION = '2026-10-20-borrador';

export const LEGAL_ENTITY = {
  nombre: 'FITMANIA',
  razonSocial: '[RAZÓN SOCIAL — completar]',
  nit: '[NIT — completar]',
  direccion: '[Dirección de la sede], Barranquilla, Atlántico, Colombia',
  correoDatos: '[correo para habeas data — completar]',
  telefono: '[teléfono — completar]',
};

/** Encargados que almacenan datos fuera de Colombia (transferencia/transmisión internacional). */
export const DATA_PROCESSORS = [
  { nombre: 'Google Firebase (Google LLC)', uso: 'Autenticación y base de datos', pais: 'Estados Unidos' },
  { nombre: 'Vercel Inc.', uso: 'Alojamiento de la aplicación', pais: 'Estados Unidos' },
  { nombre: 'Cloudinary Ltd.', uso: 'Almacenamiento de imágenes del foro y perfil', pais: 'Estados Unidos / Israel' },
  { nombre: 'Resend Inc.', uso: 'Envío de correos transaccionales', pais: 'Estados Unidos' },
  { nombre: 'Pasarela de pagos', uso: 'Procesamiento de pagos (no almacenamos datos de tarjeta)', pais: 'Según el proveedor' },
];
