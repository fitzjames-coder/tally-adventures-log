// CSV export: one CSV per table (chapters, paragraphs, legs, moments, photos,
// documents), packed into a single zip by the Worker. Trashed rows are included
// (their deleted_at is set). Pure and testable: buildCsvExport returns the file
// list; the zip packing is separate.

import { columnsOf } from './schema.js';
import { serializeRow } from './serialize.js';

// Everything the brief asks the CSV to cover.
export const CSV_TABLES = ['chapters', 'paragraphs', 'legs', 'moments', 'photos', 'documents'];

const META_HEAD = ['created_at', 'updated_at', 'deleted_at'];

function cell(value) {
  if (value === null || value === undefined) return '';
  let s;
  if (Array.isArray(value) || typeof value === 'object') s = JSON.stringify(value);
  else s = String(value);
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function columnsForTable(table) {
  return ['id', ...columnsOf(table), ...META_HEAD];
}

/**
 * @returns {Promise<Array<{name:string, content:string, rows:number}>>}
 */
export async function buildCsvExport(store) {
  const files = [];
  for (const table of CSV_TABLES) {
    const columns = columnsForTable(table);
    const raw = await store.list(table, { includeDeleted: true, orderBy: { col: 'created_at', dir: 'asc' } });
    const rows = raw.map((r) => serializeRow(table, r));
    files.push({ name: `${table}.csv`, content: toCsv(rows, columns), rows: rows.length });
  }
  return files;
}
