'use client';

import React, { useState } from 'react';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Importador CSV de productos (F2-28). Columnas (encabezados en la primera fila):
 * nombre, precio, categoria, stock, lowStockThreshold, descripcion, imagen_url, badge,
 * colores, tallas (listas separadas por "|"). Separador "," o ";".
 */
const TEMPLATE = 'nombre;precio;categoria;stock;lowStockThreshold;descripcion;imagen_url;badge;colores;tallas\n' +
  'Proteína Whey 2 lb;120000;suplementos;20;5;Proteína de suero sabor vainilla;;NUEVO;;\n' +
  'Camiseta FITMANIA;45000;ropa;30;5;;;;#000000|#DC2626;S|M|L\n';

/** Parser CSV simple con comillas dobles (soporta separadores dentro de comillas). */
function parseCsv(text: string): Record<string, string>[] {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);

  const [header, ...data] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.replace(/^\uFEFF/, '').trim());
  return data.map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? '').trim()])));
}

interface RowResult { row: number; id?: string; nombre?: string; error?: string }

export function ProductImport({ onImported }: { onImported: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (dryRun: boolean, data = rows) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: data, dryRun }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error);
      setResults(body.results);
      if (!dryRun && !body.dryRun) {
        toast.success(`Importación lista: ${body.created} creados, ${body.updated} actualizados.`);
        setRows([]);
        setResults(null);
        onImported();
      }
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo procesar el archivo.');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseCsv(await file.text());
    if (parsed.length === 0) return toast.error('El archivo no tiene filas.');
    setRows(parsed);
    await send(true, parsed); // simulación: valida antes de importar
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-productos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const errors = results?.filter((r) => r.error) || [];

  return (
    <div className="bg-white border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h3 className="font-black uppercase italic text-xl flex items-center gap-2"><FileUp className="w-5 h-5" /> Importar productos (CSV)</h3>
        <button onClick={downloadTemplate} className="ml-auto px-3 py-2 border-2 border-black rounded-lg font-black uppercase text-[10px] bg-zinc-100">Descargar plantilla</button>
        <label className="px-3 py-2 border-2 border-black rounded-lg font-black uppercase text-[10px] bg-black text-white cursor-pointer">
          Elegir archivo
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      <p className="text-[11px] font-bold text-zinc-500">Se valida todo antes de guardar. Si el nombre ya existe, el producto se actualiza.</p>

      {results && (
        <div className="mt-4">
          <p className="text-sm font-black mb-2">
            {rows.length} filas · {errors.length === 0 ? <span className="text-green-700">todas válidas</span> : <span className="text-red-600">{errors.length} con errores</span>}
          </p>
          {errors.length > 0 && (
            <ul className="text-xs font-bold text-red-600 max-h-40 overflow-y-auto mb-3 space-y-1">
              {errors.map((e) => <li key={e.row}>Fila {e.row}: {e.error}</li>)}
            </ul>
          )}
          <div className="flex gap-2">
            <button onClick={() => send(false)} disabled={busy || errors.length > 0} className="px-4 py-2 bg-red-600 text-white border-2 border-black rounded-lg font-black uppercase text-xs disabled:opacity-50">
              {busy ? 'Importando…' : `Importar ${rows.length} productos`}
            </button>
            <button onClick={() => { setRows([]); setResults(null); }} className="px-4 py-2 bg-white border-2 border-black rounded-lg font-black uppercase text-xs">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
