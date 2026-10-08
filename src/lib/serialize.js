// Shape a raw database row into the object the API returns: JSON columns parsed
// into arrays, boolean columns into true/false. Shared by both stores.

import { TABLES } from './schema.js';

export function serializeRow(table, row) {
  if (!row) return row;
  const out = { ...row };
  const fields = TABLES[table].fields;
  for (const [name, field] of Object.entries(fields)) {
    if (field.type === 'json') {
      out[name] = parseJsonColumn(out[name]);
    } else if (field.type === 'bool') {
      out[name] = out[name] === 1 || out[name] === true;
    }
  }
  return out;
}

function parseJsonColumn(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
