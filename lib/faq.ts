import { LEGAL_ENTITY, OPENING_HOURS, PROJECT_NOTICE } from '@/lib/legal'

/**
 * Preguntas frecuentes de /preguntas-frecuentes. Basadas en la sección de usuarios de
 * preguntas_y_respuestas.txt, en lenguaje para socios.
 *
 * Cada respuesta es una lista de bloques: un texto es un párrafo y una lista de textos
 * se muestra como viñetas.
 */
export type FaqBlock = string | string[]
export interface FaqItem { id: string; q: string; a: FaqBlock[] }
export interface FaqCategory { id: string; title: string; items: FaqItem[] }

const horario = OPENING_HOURS.map((h) => `${h.dias}: ${h.horas}`)

export const FAQ: FaqCategory[] = [
  {
    id: 'cuenta',
    title: 'Cuenta y seguridad',
    items: [
      {
        id: 'registro',
        q: '¿Cómo creo mi cuenta?',
        a: [
          'Entra a "Registro", escribe tu nombre de usuario, tu correo y una contraseña, y acepta los términos y la política de tratamiento de datos.',
          'Después confirma tu correo con el enlace que te enviamos. Sin el correo verificado no puedes pagar ni publicar en el foro, porque allí llegan tus recibos.',
        ],
      },
      {
        id: 'contrasena',
        q: 'Olvidé mi contraseña, ¿qué hago?',
        a: [
          'En "Iniciar sesión", pulsa "Olvidé mi contraseña" y escribe tu correo. Si está registrado, te llega un enlace para crear una nueva.',
          'Si no lo ves en unos minutos, revisa la carpeta de spam o "Promociones".',
        ],
      },
      {
        id: 'dos-pasos',
        q: '¿Qué es la verificación en dos pasos y es obligatoria?',
        a: [
          'Es una protección extra para tu cuenta y no es obligatoria. Con ella activa, además de la contraseña, cada nuevo inicio de sesión te pide un código de 6 dígitos que llega a tu correo.',
          'Se activa en Perfil → "Verificación en dos pasos" → "Activar con mi correo". Necesitas tener el correo verificado.',
          'Si alguien conoce tu contraseña pero no tiene acceso a tu correo, no podrá ver ni cambiar nada de tu cuenta.',
          'Si ya usas una app autenticadora, también cuenta como segundo paso.',
        ],
      },
      {
        id: 'codigo-no-llega',
        q: 'No me llega el código de verificación',
        a: [
          [
            'Revisa la carpeta de spam o "Promociones". El asunto es "Tu código de verificación".',
            'Espera un minuto y pulsa "Reenviar código". Puedes pedir uno cada 60 segundos y hasta 5 cada 15 minutos.',
            'El código dura 10 minutos y acepta 5 intentos. Después tienes que pedir otro.',
            'Si no tienes acceso a tu correo, pulsa "No tengo acceso al correo" y usa uno de tus códigos de recuperación.',
            'Si tampoco tienes códigos de recuperación, escríbenos por PQRS o acércate a la recepción con tu documento. Verificamos tu identidad y te ayudamos a recuperar el acceso.',
          ],
        ],
      },
      {
        id: 'recuperacion',
        q: '¿Qué son los códigos de recuperación?',
        a: [
          'Son 8 códigos con el formato XXXXX-XXXXX que te mostramos una sola vez, al activar la verificación en dos pasos. Cada uno sirve una vez para entrar sin el código del correo.',
          [
            'En tu perfil ves cuántos te quedan.',
            'Guárdalos fuera de tu correo: en papel, en un gestor de contraseñas o en una nota segura del celular.',
            'Nadie del gimnasio puede verlos ni volver a mostrártelos, porque no los guardamos en claro.',
            'Si se te acaban, desactiva y vuelve a activar la verificación para recibir 8 nuevos.',
          ],
        ],
      },
      {
        id: 'codigo-otra-vez',
        q: '¿Por qué me pide el código otra vez si ya lo puse?',
        a: [
          'El código verifica un inicio de sesión, no un dispositivo. Si cierras sesión y vuelves a entrar, o entras desde otro celular o computador, te pedimos un código nuevo.',
          'Si solo recargas la página o abres otra pestaña con la misma sesión, no te lo pedimos de nuevo.',
        ],
      },
      {
        id: 'quien-ve',
        q: '¿Quién puede ver mi información?',
        a: [
          [
            'Tú: tu perfil, tus compras, tu plan y tus ingresos.',
            'Otros socios: solo tu nombre de usuario y tu foto en el foro, si publicas.',
            'Recepción: lo necesario para dejarte entrar y venderte productos (nombre, correo parcialmente oculto, plan y vencimiento).',
            'Administración: tu perfil, tus compras y tus ingresos, para gestionar el gimnasio. Cada acción que hace queda registrada.',
          ],
          'Nadie del gimnasio ve tu contraseña, tus datos de tarjeta ni tus códigos de verificación.',
        ],
      },
    ],
  },
  {
    id: 'planes',
    title: 'Planes y membresía',
    items: [
      {
        id: 'cual-plan',
        q: '¿Qué plan me conviene?',
        a: [
          'En "Planes" ves el precio, la duración y lo que incluye cada uno antes de pagar.',
          [
            'Plan Estándar: acceso completo a la sede durante un mes.',
            'Plan Parejas: además puedes traer un invitado 3 veces por semana (pareja, amigo o compañero de entreno).',
            'Plan Dos en Uno: dos meses con descuento y seguimiento personalizado.',
          ],
        ],
      },
      {
        id: 'marco',
        q: '¿Por qué mi foto tiene un marco de color?',
        a: [
          'El marco muestra que tienes un plan vigente y cambia según el plan: rojo, blanco y azul para el Plan Estándar; rosa y violeta para el Plan Parejas; dorado para el Plan Dos en Uno.',
          'Se ve en tu perfil, en el menú de tu cuenta y en tus publicaciones del foro. Si el plan vence o se congela, el marco desaparece.',
        ],
      },
      {
        id: 'renovar',
        q: '¿Qué pasa si renuevo antes de que se venza mi plan?',
        a: [
          'Los días nuevos se suman a tu fecha de vencimiento actual, así que no pierdes nada por renovar antes.',
          'Cuando falten 5 días o menos te avisamos por correo y en la app (y con notificación push si la activaste).',
        ],
      },
      {
        id: 'congelar',
        q: '¿Puedo congelar mi plan si me enfermo o viajo?',
        a: [
          'Sí. Pídelo en la recepción o por PQRS indicando el motivo. Lo hace la administración.',
          [
            'Al congelarlo, guardamos los días que te quedaban y el plan deja de dar acceso.',
            'Al reactivarlo, esos días se cuentan desde la fecha de reactivación. No pierdes ningún día.',
          ],
        ],
      },
      {
        id: 'acompanante',
        q: '¿Cómo registro a mi acompañante?',
        a: [
          'Solo aplica a los planes que incluyen acompañante. Con el plan vigente, entra a tu Perfil → "Acompañante", escribe su nombre, su correo y los días en que vendrá, y guarda.',
        ],
      },
    ],
  },
  {
    id: 'pagos',
    title: 'Pagos y compras',
    items: [
      {
        id: 'medios',
        q: '¿Cómo puedo pagar?',
        a: [
          'Los pagos se hacen en Mercado Pago: tarjeta de crédito o débito, PSE, Efecty o saldo de Mercado Pago.',
          'Necesitas haber iniciado sesión y tener el correo verificado. El precio lo calculamos nosotros con los valores vigentes del plan o de los productos.',
        ],
      },
      {
        id: 'seguro',
        q: '¿Es seguro? ¿Guardan los datos de mi tarjeta?',
        a: [
          'No los guardamos ni los vemos. Los datos de tu tarjeta, tus claves de PSE y tus cuentas bancarias se escriben directamente en Mercado Pago, que cumple el estándar de seguridad PCI DSS.',
          'Lo único que guardamos del pago es el monto, la fecha, el estado, el nombre del medio (por ejemplo "PSE" o "Tarjeta Visa") y el número de transacción.',
        ],
      },
      {
        id: 'pague-no-activo',
        q: 'Pagué pero mi plan no aparece activo',
        a: [
          'Normalmente se activa en segundos. Si la confirmación de Mercado Pago se retrasa, el sistema vuelve a consultar el pago automáticamente y lo aplica en cuanto se confirma. Nunca se cobra dos veces ni se activa dos veces.',
          'Con PSE puede tardar unos minutos. Con Efecty se confirma cuando pagues en el punto.',
          'Si después de varias horas sigue sin aparecer, escríbenos por PQRS con el número de transacción que aparece en tu correo o en "Mis compras".',
        ],
      },
      {
        id: 'sin-pagar',
        q: 'Salí de Mercado Pago sin terminar de pagar, ¿me cobraron?',
        a: [
          'No. Si no confirmaste el pago en Mercado Pago, no hay ningún cobro. Verás el aviso "Pago no completado" y tu carrito sigue guardado para cuando quieras intentarlo de nuevo.',
          'Si se te cayó la conexión después de confirmar el pago, Mercado Pago lo procesa igual: te llega el correo de confirmación y la compra aparece en "Mis compras".',
        ],
      },
      {
        id: 'en-proceso',
        q: 'Mi pago dice "En proceso"',
        a: [
          'Pasa con PSE (mientras el banco confirma) y con Efecty (hasta que pagues en el punto). Te enviamos un correo cuando se confirme.',
          'Si el Efecty vence sin pagarse, Mercado Pago lo cancela y el pedido queda como "Rechazado".',
        ],
      },
      {
        id: 'reembolso',
        q: '¿Puedo pedir un reembolso?',
        a: [
          'Escríbenos por PQRS con el número de transacción. Revisamos el caso según los términos y condiciones (incluido el derecho de retracto) y, si procede, el reembolso vuelve al mismo medio de pago.',
          'Con tarjeta, el tiempo depende de tu banco. Si se vendió un producto que ya no tenía unidades, la parte faltante se reembolsa sola.',
        ],
      },
      {
        id: 'productos',
        q: '¿Envían los productos de la tienda a domicilio?',
        a: ['No hacemos envíos. Los productos que compras en línea se reclaman en la recepción de la sede presentando el correo de confirmación o tu pase QR.'],
      },
      {
        id: 'mis-compras',
        q: '¿Dónde veo mis compras?',
        a: ['En tu Perfil → "Mis compras" ves cada compra con su estado, el medio de pago y el número de transacción. También te llega un recibo por correo cuando se aprueba.'],
      },
    ],
  },
  {
    id: 'acceso',
    title: 'Acceso a la sede',
    items: [
      {
        id: 'horario',
        q: '¿Cuál es el horario?',
        a: [horario],
      },
      {
        id: 'qr',
        q: '¿Cómo funciona el pase QR para entrar?',
        a: [
          [
            'En tu Perfil aparece el pase QR cuando tu plan está vigente.',
            'El pase está firmado digitalmente y cambia cada 5 minutos, así que una captura de pantalla vieja no sirve.',
            'La app guarda un pase del día (válido 24 horas) para que puedas entrar aunque tu celular no tenga internet en la puerta.',
            'Si tu celular no funciona, en recepción te buscan por nombre o documento y registran tu ingreso.',
          ],
        ],
      },
      {
        id: 'sin-internet',
        q: '¿Qué pasa si se cae el internet en la sede?',
        a: ['Puedes entrar igual. El escáner de recepción valida tu pase sin internet y registra tu ingreso cuando vuelve la conexión. Si no hay equipo disponible, se usa una planilla en papel.'],
      },
      {
        id: 'app',
        q: '¿Hay app para el celular?',
        a: [
          'Puedes instalar FITMANIA como app desde el navegador. En Android, abre el menú del navegador y elige "Instalar app" o "Agregar a pantalla de inicio". En iPhone, usa Compartir → "Agregar a inicio".',
          'Para recibir avisos de vencimiento y noticias, activa las notificaciones en tu Perfil.',
        ],
      },
    ],
  },
  {
    id: 'comunidad',
    title: 'Foro y PQRS',
    items: [
      {
        id: 'foro',
        q: '¿Por qué no puedo publicar en el foro?',
        a: [
          'Para publicar necesitas tener el correo verificado. Las publicaciones salen con tu nombre de usuario real: no se puede firmar como otra persona.',
          'Para que el foro no se llene, puedes hacer hasta 3 publicaciones seguidas; después hay una pausa de 5 minutos desde la última. El botón muestra cuánto falta, y durante la pausa puedes seguir comentando y dando likes.',
          'El foro muestra 10 publicaciones por página, de los últimos 30 días. Usa "Anterior" y "Siguiente" al final para moverte entre páginas.',
          'Puedes reportar publicaciones que incumplan las normas y la administración las revisa.',
        ],
      },
      {
        id: 'pqrs',
        q: '¿Para qué sirven las PQRS y cuánto tardan?',
        a: [
          'Son el canal oficial para peticiones, quejas, reclamos y sugerencias, y para tus solicitudes sobre datos personales. Cada una queda con número, fecha y estado, y la respuesta te llega al correo.',
          ['Peticiones: 5 días hábiles.', 'Quejas: 3 días hábiles.', 'Reclamos: 15 días hábiles.', 'Sugerencias: 10 días hábiles.'],
        ],
      },
    ],
  },
  {
    id: 'privacidad',
    title: 'Privacidad y datos',
    items: [
      {
        id: 'descargar-eliminar',
        q: '¿Cómo descargo o elimino mis datos?',
        a: [
          'Desde tu Perfil → "Privacidad y datos".',
          [
            '"Descargar mis datos" te entrega un archivo con todo lo que tenemos sobre ti: cuenta, compras, intentos de pago, ingresos, PQRS, foro y autorizaciones.',
            '"Eliminar mi cuenta" borra tu perfil, tus publicaciones y tu acceso. Tus ingresos y PQRS quedan anónimos para las estadísticas, y las órdenes de compra se conservan 10 años por obligación contable.',
          ],
          'La eliminación no se puede deshacer.',
        ],
      },
      {
        id: 'navegacion',
        q: '¿Guardan lo que hago en la página?',
        a: [
          'No guardamos tu historial de navegación: ni páginas visitadas, ni clics, ni búsquedas. Solo guardamos lo que haces a propósito, como tu cuenta, tus compras, tus ingresos y tus publicaciones.',
          'Las visitas se miden de forma anónima y agregada, sin cookies publicitarias. El detalle está en la página de Cookies.',
        ],
      },
      {
        id: 'contacto-datos',
        q: '¿A quién escribo sobre mis datos personales?',
        a: [`Por PQRS (tipo "Datos personales") o al correo ${LEGAL_ENTITY.correoDatos}.`],
      },
    ],
  },
  {
    id: 'personal',
    title: 'Para el personal de recepción',
    items: [
      {
        id: 'recepcion-offline',
        q: '¿Cómo trabaja la recepción si se cae el internet?',
        a: [
          [
            'El escáner sigue validando los pases QR con la firma digital, que no necesita internet.',
            'Cada ingreso se guarda en el equipo y se envía solo al volver la conexión. Si llega dos veces, cuenta una.',
            'Sin equipo, usa la planilla en papel (Planilla de ingresos, imprimible) y luego digita los ingresos.',
            'No borres los datos del navegador mientras haya ingresos pendientes: esa cola vive en el equipo.',
            'El punto de venta sí necesita conexión, porque valida el stock en el momento.',
          ],
        ],
      },
      {
        id: 'cierre-caja',
        q: '¿Cómo hago el cierre de caja?',
        a: [
          'Al final del turno abre "Cierre de caja". El sistema suma las ventas del turno por medio de pago (efectivo, datáfono y transferencia).',
          'Ingresa lo que cuentas en efectivo y el sistema muestra la diferencia. El cierre queda guardado con fecha, responsable y diferencias.',
        ],
      },
    ],
  },
  {
    id: 'proyecto',
    title: 'Sobre este sitio',
    items: [
      {
        id: 'es-real',
        q: '¿FITMANIA es un gimnasio real?',
        a: [PROJECT_NOTICE.fictional, 'Si ves datos de contacto o de la empresa, son parte de la simulación. No hagas pagos con datos reales.'],
      },
      {
        id: 'ia',
        q: '¿Usan inteligencia artificial?',
        a: [PROJECT_NOTICE.ai, 'Ningún contenido del sitio reemplaza la asesoría médica, nutricional ni profesional.'],
      },
      {
        id: 'sandbox',
        q: '¿Qué es el Modo Sandbox?',
        a: [
          'Una copia del sitio para probarlo todo sin registrarte: entras con una cuenta temporal que tiene los roles de socio, recepción y administración, y recorres el sistema con datos de ejemplo.',
          'Los pagos pasan por una pasarela simulada y los correos llegan a un buzón dentro del sandbox: no se cobra ni se envía nada. Nada de lo que hagas afecta al sitio real.',
          'Tu cuenta y todo lo que hiciste se borran al pulsar "Salir y borrar mis datos" o, como máximo, a las 2 horas.',
        ],
      },
    ],
  },
]
