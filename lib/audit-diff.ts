/**
 * Cambios de un registro para la auditoría (F1-26): qué campo cambió y de qué valor
 * a cuál. Función pura, sin imports del proyecto, para probarla con `node --test`.
 */

export type AuditChanges = Record<string, { before: unknown; after: unknown }>;

// Marcas de tiempo técnicas: cambian siempre y no aportan a "qué cambió".
const IGNORED = new Set(['updatedAt', 'updated_at']);

/** Normaliza para comparar y guardar: fechas y Timestamps de Firestore → ISO. */
export function normalizeAuditValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    const v = value as any;
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (typeof v._seconds === 'number') return new Date(v._seconds * 1000).toISOString();
    if (Array.isArray(value)) return value.map(normalizeAuditValue);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(v).sort()) out[key] = normalizeAuditValue(v[key]);
    return out;
  }
  return value;
}

/** Solo los campos de `after` cuyo valor difiere del de `before`. */
export function auditChanges(before: Record<string, unknown> | null | undefined, after: Record<string, unknown>): AuditChanges {
  const changes: AuditChanges = {};
  for (const key of Object.keys(after)) {
    if (IGNORED.has(key)) continue;
    const b = normalizeAuditValue(before?.[key]);
    const a = normalizeAuditValue(after[key]);
    if (JSON.stringify(b) !== JSON.stringify(a)) changes[key] = { before: b, after: a };
  }
  return changes;
}
