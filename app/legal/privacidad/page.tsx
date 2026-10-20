import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { DATA_PROCESSORS, LEGAL_ENTITY } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Política de tratamiento de datos personales',
  description: 'Cómo FITMANIA recolecta, usa y protege tus datos personales (Ley 1581 de 2012).',
  alternates: { canonical: '/legal/privacidad' },
}

export default function PrivacidadPage() {
  const e = LEGAL_ENTITY
  return (
    <LegalPage title="Política de tratamiento de datos personales">
      <p>
        En cumplimiento de la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y demás
        normas concordantes, {e.razonSocial} (&quot;{e.nombre}&quot;), identificada con NIT {e.nit}, adopta la presente
        política para el tratamiento de los datos personales de sus usuarios, socios y visitantes.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li>Razón social: {e.razonSocial} · NIT: {e.nit}</li>
        <li>Dirección: {e.direccion}</li>
        <li>Correo para asuntos de datos personales: {e.correoDatos}</li>
        <li>Teléfono: {e.telefono}</li>
      </ul>

      <h2>2. Datos que recolectamos</h2>
      <ul>
        <li>Identificación y contacto: nombre de usuario, correo electrónico, género (opcional).</li>
        <li>Membresía: plan adquirido, fechas de inicio y vencimiento, acompañante registrado.</li>
        <li>Asistencia: fecha y hora de cada ingreso a la sede y quién lo registró.</li>
        <li>Compras: productos, valores y referencias de pago. No almacenamos datos de tarjetas.</li>
        <li>Contenido que publicas en el foro (textos, imágenes y videos) y tus PQRS.</li>
        <li>
          <strong>Datos sensibles (opcionales):</strong> peso y altura. Solo se tratan si nos das tu autorización
          expresa y separada; no estás obligado a suministrarlos y negarte no afecta tu acceso al servicio.
        </li>
      </ul>

      <h2>3. Finalidades</h2>
      <ul>
        <li>Crear y administrar tu cuenta y tu membresía, y validar tu ingreso a la sede.</li>
        <li>Procesar pagos, emitir recibos y facturas, y atender garantías y devoluciones.</li>
        <li>Atender peticiones, quejas, reclamos y sugerencias (PQRS).</li>
        <li>Enviarte notificaciones del servicio (ingreso registrado, vencimiento de tu plan, respuestas).</li>
        <li>Elaborar estadísticas agregadas de asistencia para mejorar el servicio (horarios, aforo).</li>
        <li>Moderar el foro y garantizar la seguridad de la plataforma (registros de auditoría).</li>
        <li>Enviar información comercial solo si lo autorizas, en los horarios permitidos por la Ley 2300 de 2023.</li>
      </ul>

      <h2>4. Derechos del titular</h2>
      <p>Como titular puedes: conocer, actualizar y rectificar tus datos; solicitar prueba de la autorización; ser
        informado del uso de tus datos; presentar quejas ante la Superintendencia de Industria y Comercio (SIC);
        revocar la autorización y solicitar la supresión de tus datos cuando no exista un deber legal de conservarlos;
        y acceder gratuitamente a tus datos.</p>
      <p>Desde tu perfil puedes <strong>descargar tus datos</strong>, <strong>revocar la autorización de datos sensibles</strong> y
        <strong> eliminar tu cuenta</strong>. Los registros de compras se conservan por el término que exige la ley contable
        (Código de Comercio, art. 60).</p>

      <h2>5. Procedimiento para consultas y reclamos</h2>
      <ul>
        <li>Canales: sección PQRS (tipo &quot;Datos personales&quot;) o el correo {e.correoDatos}.</li>
        <li>Consultas: se responden en máximo diez (10) días hábiles, prorrogables cinco (5) días hábiles.</li>
        <li>Reclamos: se responden en máximo quince (15) días hábiles, prorrogables ocho (8) días hábiles.</li>
      </ul>

      <h2>6. Transferencia y transmisión internacional</h2>
      <p>Para prestar el servicio usamos proveedores que almacenan o procesan datos fuera de Colombia, bajo contratos
        que exigen medidas de seguridad adecuadas:</p>
      <ul>
        {DATA_PROCESSORS.map((p) => (
          <li key={p.nombre}>{p.nombre} — {p.uso} ({p.pais})</li>
        ))}
      </ul>

      <h2>7. Seguridad</h2>
      <p>Aplicamos cifrado en tránsito (HTTPS), control de acceso por roles, registros de auditoría y copias de
        seguridad. Ningún sistema es infalible; si ocurre un incidente que afecte tus datos, te informaremos y lo
        reportaremos a la SIC conforme a la ley.</p>

      <h2>8. Menores de edad</h2>
      <p>El registro de menores de 18 años requiere la autorización de su representante legal y se respetará su
        interés superior.</p>

      <h2>9. Vigencia</h2>
      <p>Esta política rige desde su publicación. Los cambios sustanciales se informarán en la plataforma y, cuando
        corresponda, se solicitará una nueva autorización.</p>
    </LegalPage>
  )
}
