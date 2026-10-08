// Schema-driven input validation. Pure and dependency-free so it runs both in
// the Worker and under `node --test`. Returns a map of column -> database-ready
// value, or throws ApiError(400) listing every problem.

import { TABLES, isTable } from './schema.js';
import { ApiError } from './errors.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ICAO_RE = /^[A-Z0-9]{2,8}$/;

function isBlank(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

// Coerce one field. Pushes a message to `errors` and returns undefined on failure.
function coerce(name, field, raw, errors) {
  const label = name;

  switch (field.type) {
    case 'string':
    case 'text': {
      const s = String(raw).trim();
      if (field.max && s.length > field.max) {
        errors.push(`${label} must be ${field.max} characters or fewer`);
        return undefined;
      }
      return s;
    }

    case 'enum': {
      const s = String(raw).trim();
      if (!field.values.includes(s)) {
        errors.push(`${label} must be one of: ${field.values.join(', ')}`);
        return undefined;
      }
      return s;
    }

    case 'date': {
      const s = String(raw).trim();
      if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) {
        errors.push(`${label} must be a valid date (YYYY-MM-DD)`);
        return undefined;
      }
      return s;
    }

    case 'datetime': {
      const s = String(raw).trim();
      if (Number.isNaN(Date.parse(s))) {
        errors.push(`${label} must be a valid date/time`);
        return undefined;
      }
      return s;
    }

    case 'int': {
      const n = Number(raw);
      if (!Number.isInteger(n)) {
        errors.push(`${label} must be a whole number`);
        return undefined;
      }
      if (field.min !== undefined && n < field.min) {
        errors.push(`${label} must be at least ${field.min}`);
        return undefined;
      }
      if (field.max !== undefined && n > field.max) {
        errors.push(`${label} must be at most ${field.max}`);
        return undefined;
      }
      return n;
    }

    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        errors.push(`${label} must be a number`);
        return undefined;
      }
      if (field.min !== undefined && n < field.min) {
        errors.push(`${label} must be at least ${field.min}`);
        return undefined;
      }
      if (field.max !== undefined && n > field.max) {
        errors.push(`${label} must be at most ${field.max}`);
        return undefined;
      }
      return n;
    }

    case 'bool': {
      if (raw === true || raw === 1 || raw === '1' || raw === 'true') return 1;
      if (raw === false || raw === 0 || raw === '0' || raw === 'false') return 0;
      errors.push(`${label} must be true or false`);
      return undefined;
    }

    case 'icao': {
      const s = String(raw).trim().toUpperCase();
      if (!ICAO_RE.test(s)) {
        errors.push(`${label} must be an airport identifier (2-8 letters or digits)`);
        return undefined;
      }
      return s;
    }

    case 'id': {
      const s = String(raw).trim();
      if (s.length === 0 || s.length > 100) {
        errors.push(`${label} must be a valid id`);
        return undefined;
      }
      return s;
    }

    case 'json': {
      const value = coerceJson(label, field.shape, raw, errors);
      return value === undefined ? undefined : JSON.stringify(value);
    }

    default:
      errors.push(`${label} has an unknown field type`);
      return undefined;
  }
}

function coerceJson(label, shape, raw, errors) {
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      errors.push(`${label} must be valid JSON`);
      return undefined;
    }
  }
  if (!Array.isArray(arr)) {
    errors.push(`${label} must be a list`);
    return undefined;
  }

  if (shape === 'string-array') {
    const out = [];
    for (const item of arr) {
      if (typeof item !== 'string') {
        errors.push(`${label} must be a list of text notes`);
        return undefined;
      }
      const t = item.trim();
      if (t) out.push(t);
    }
    return out;
  }

  if (shape === 'pilot-notes') {
    const out = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') {
        errors.push(`${label} entries must be objects with kind and text`);
        return undefined;
      }
      const kind = String(item.kind || '').trim();
      const text = String(item.text || '').trim();
      if (!['positive', 'practice'].includes(kind)) {
        errors.push(`${label} kind must be "positive" or "practice"`);
        return undefined;
      }
      if (!text) continue; // skip empty notes rather than fail
      out.push({ kind, text });
    }
    return out;
  }

  return arr;
}

/**
 * Validate a request body against a table's schema.
 * @param {string} table
 * @param {object} body
 * @param {{partial?: boolean}} opts  partial=true for PATCH/update (only given fields).
 * @returns {object} map of column -> database-ready value
 * @throws {ApiError} 400 with { errors: string[] }
 */
export function validate(table, body, opts = {}) {
  const partial = opts.partial === true;
  if (!isTable(table)) throw new ApiError(500, `Unknown table: ${table}`);
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }

  const { fields } = TABLES[table];
  const errors = [];
  const values = {};

  for (const [name, field] of Object.entries(fields)) {
    const present = Object.prototype.hasOwnProperty.call(body, name);
    const raw = body[name];

    // Field omitted entirely.
    if (!present || (partial && isBlank(raw) && field.type !== 'bool')) {
      if (!partial) {
        if (field.required && isBlank(raw)) {
          errors.push(`${name} is required`);
          continue;
        }
        if (field.default !== undefined) {
          values[name] = field.type === 'bool'
            ? (field.default ? 1 : 0)
            : field.default;
        }
      }
      // On partial update, a blank clears the value (except required fields).
      if (partial && present && isBlank(raw)) {
        if (field.required) {
          errors.push(`${name} cannot be empty`);
        } else {
          values[name] = null;
        }
      }
      continue;
    }

    // Field present and blank on create: required -> error, else null.
    if (isBlank(raw) && field.type !== 'bool') {
      if (field.required) errors.push(`${name} is required`);
      else values[name] = null;
      continue;
    }

    const coerced = coerce(name, field, raw, errors);
    if (coerced !== undefined) values[name] = coerced;
  }

  if (errors.length) {
    throw new ApiError(400, errors[0], { errors });
  }
  return values;
}
