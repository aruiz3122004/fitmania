'use client'

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="print:hidden px-4 py-2 border-2 border-black font-bold uppercase text-xs">
      Imprimir
    </button>
  )
}
