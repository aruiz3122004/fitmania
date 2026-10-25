/**
 * Datos legales del responsable del tratamiento (F3-09).
 *
 * FITMANIA es un proyecto de portafolio: la empresa no existe y estos datos son
 * ficticios. Las páginas legales y el pie de página lo advierten (PROJECT_NOTICE).
 * Para usarlo con un negocio real: poner sus datos, `IS_FICTIONAL = false` y hacer
 * revisar los textos de /legal/* por un abogado.
 *
 * Cambiar `LEGAL_VERSION` cada vez que cambie el texto de términos o política:
 * queda guardada en cada consentimiento (`consents/*`) como prueba ante la SIC.
 */
export const LEGAL_VERSION = '2026-10-25';

export const IS_FICTIONAL = true;

export const LEGAL_ENTITY = {
  nombre: 'FITMANIA',
  razonSocial: 'Fitmania',
  nit: '901.091.256-0',
  direccion: 'Cra. 54 #66-12 Nte. Centro Histórico, Barranquilla, Atlántico, Colombia',
  correoDatos: 'andreselgameroscuro@gmail.com',
  telefono: '+57 300123456',
};

/** Horario de la sede: pie de página, preguntas frecuentes y datos estructurados (SEO). */
export const OPENING_HOURS = [
  { dias: 'Lunes a sábado', corto: 'Lun - Sab', horas: '5:00 AM - 10:00 PM', schemaDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '05:00', closes: '22:00' },
  { dias: 'Domingos y festivos', corto: 'Dom', horas: '7:00 AM - 4:00 PM', schemaDays: ['Sunday'], opens: '07:00', closes: '16:00' },
];

/** Avisos visibles en las páginas legales, el pie de página y las preguntas frecuentes. */
export const PROJECT_NOTICE = {
  fictional:
    'FITMANIA es un proyecto de portafolio que simula un gimnasio real. La empresa no existe: la razón social, el NIT, la dirección, el teléfono, el personal y los demás datos del negocio son ficticios. Los pagos funcionan en modo de prueba y no se presta ningún servicio real.',
  ai:
    'Parte del contenido de este sitio (textos, imágenes y código) se elaboró con asistencia de inteligencia artificial y fue revisado por el equipo del proyecto.',
};

/** Encargados que almacenan datos fuera de Colombia (transferencia/transmisión internacional). */
export const DATA_PROCESSORS = [
  { nombre: 'Google Firebase (Google LLC)', uso: 'Autenticación y base de datos', pais: 'Estados Unidos' },
  { nombre: 'Vercel Inc.', uso: 'Alojamiento de la aplicación', pais: 'Estados Unidos' },
  { nombre: 'Cloudinary Ltd.', uso: 'Almacenamiento de imágenes del foro y perfil', pais: 'Estados Unidos / Israel' },
  { nombre: 'Resend Inc.', uso: 'Envío de correos transaccionales', pais: 'Estados Unidos' },
  { nombre: 'Mercado Pago (Mercado Libre)', uso: 'Procesamiento de pagos (no almacenamos datos de tarjeta)', pais: 'Colombia / Estados Unidos' },
];
