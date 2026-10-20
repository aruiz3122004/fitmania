/**
 * Validación con lista blanca para las escrituras del panel admin (F1-04).
 *
 * Antes las rutas hacían `update({ ...data })` con el body tal cual (mass
 * assignment): cualquier campo enviado terminaba en Firestore. Aquí solo pasan
 * los campos conocidos y con su tipo; los desconocidos se ignoran y un valor con
 * tipo inválido produce un error 400.
 */

export class ValidationError extends Error {}

type FieldParser = (value: unknown, field: string) => unknown;

const text = (max: number): FieldParser => (value, field) => {
  if (typeof value !== 'string') throw new ValidationError(`"${field}" debe ser texto.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ValidationError(`"${field}" supera ${max} caracteres.`);
  return trimmed;
};

const number = (min: number, max: number, integer = false): FieldParser => (value, field) => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw new ValidationError(`"${field}" debe ser un número${integer ? ' entero' : ''} entre ${min} y ${max}.`);
  }
  return n;
};

const bool: FieldParser = (value, field) => {
  if (typeof value !== 'boolean') throw new ValidationError(`"${field}" debe ser verdadero o falso.`);
  return value;
};

const textList = (maxItems: number, maxLen: number): FieldParser => (value, field) => {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new ValidationError(`"${field}" debe ser una lista de hasta ${maxItems} elementos.`);
  }
  return value.map((item, i) => text(maxLen)(item, `${field}[${i}]`));
};

function pick(schema: Record<string, FieldParser>, data: unknown, required: string[] = []) {
  if (!data || typeof data !== 'object') throw new ValidationError('Cuerpo de la solicitud inválido.');
  const source = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [field, parse] of Object.entries(schema)) {
    if (source[field] === undefined || source[field] === null) continue;
    result[field] = parse(source[field], field);
  }
  for (const field of required) {
    if (result[field] === undefined || result[field] === '') {
      throw new ValidationError(`Falta el campo obligatorio "${field}".`);
    }
  }
  return result;
}

const PLAN_SCHEMA: Record<string, FieldParser> = {
  name: text(100),
  description: text(500),
  price: number(0, 100_000_000),
  days: number(1, 3650, true),
  features: textList(30, 200),
  featured: bool,
  ribbon: text(50),
  icon: text(30),
};

const PRODUCT_SCHEMA: Record<string, FieldParser> = {
  nombre: text(120),
  descripcion: text(1000),
  precio: number(0, 100_000_000),
  categoria: text(40),
  stock: number(0, 1_000_000, true),
  imagen_url: text(500),
  badge: text(40),
  colores: textList(30, 30),
  tallas: textList(30, 20),
};

/** Alta de plan: exige nombre, precio y duración. */
export const parsePlanCreate = (data: unknown) => pick(PLAN_SCHEMA, data, ['name', 'price', 'days']);
/** Edición parcial de plan. */
export const parsePlanUpdate = (data: unknown) => pick(PLAN_SCHEMA, data);
/** Alta de producto: exige nombre y precio. */
export const parseProductCreate = (data: unknown) => pick(PRODUCT_SCHEMA, data, ['nombre', 'precio']);
/** Edición parcial de producto. */
export const parseProductUpdate = (data: unknown) => pick(PRODUCT_SCHEMA, data);

/** ID de documento seguro: sin '/', no '.' ni '..', longitud acotada (admite IDs con tildes ya existentes). */
export function parseDocId(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !/^[^/]{1,150}$/.test(value) || value === '.' || value === '..') {
    throw new ValidationError(`"${field}" no es un identificador válido.`);
  }
  return value;
}
