import type { Metadata } from 'next'
import { PrintButton } from './print-button'

export const metadata: Metadata = {
  title: 'Planilla de ingresos (contingencia)',
  robots: { index: false, follow: false },
}

// F2-07: planilla imprimible para registrar ingresos cuando el sistema no está disponible.
// Después se cargan en Recepción → Historial → "Cargar planilla en papel".
export default function PlanillaIngresosPage() {
  const rows = Array.from({ length: 30 }, (_, i) => i + 1)
  return (
    <main className="bg-white text-black p-8 print:p-0 max-w-[900px] mx-auto font-body">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="font-display text-3xl uppercase">FITMANIA — Planilla de ingresos</h1>
          <p className="text-sm">Contingencia por falla del sistema. Fecha: ____ / ____ / ________ · Recepcionista: ______________________</p>
        </div>
        <PrintButton />
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {['#', 'Hora', 'Nombre del socio', 'Documento / correo', '¿Plan vigente? (Sí/No)', 'Firma'].map((h) => (
              <th key={h} className="border border-black p-2 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n}>
              <td className="border border-black p-2 w-8">{n}</td>
              <td className="border border-black p-2 w-20" />
              <td className="border border-black p-2" />
              <td className="border border-black p-2" />
              <td className="border border-black p-2 w-28" />
              <td className="border border-black p-2 w-32" />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs mt-4">Al restablecerse el sistema, cargar cada fila con su hora real en el panel de recepción y archivar esta planilla.</p>
    </main>
  )
}
