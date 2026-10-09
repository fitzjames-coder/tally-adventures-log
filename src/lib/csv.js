// CSV export: one CSV per table, packed into a single zip by the Worker. The
// chapters/paragraphs tables are written out under their user-facing names —
// destinations.csv and stages.csv — and the chapter_id / paragraph_id column
// headers are renamed to destination_id / stage_id in the CSV output. The
// underlying table and column names are unchanged; only the exported file names
// and header row carry the journey wording. Trashed rows are included (their
// deleted_at is set). Pure and testable: buildCsvExport returns the file list;
// the zip packing is separate.

import { columnsOf } from './schema.js';
import { serializeRow } from './serialize.js';

// Everything the brief asks the CSV to cover.
export const CSV_TABLES = ['chapters', 'paragraphs', 'legs', 'moments', 'photos', 'documents'];

const META_HEAD = ['created_at', 'updated_at', 'deleted_at'];

// User-facing CSV file names for the renamed levels (data/columns stay as-is).
const FILE_NAMES = { chapters: 'destinations', paragraphs: 'stages' };

// User-facing column header renames, applied to the CSV header row only.
const COLUMN_RENAME = { chapter_id: 'destination_id', paragraph_id: 'stage_id' };

function cell(value) {
  if (value === null || value === undefined) return '';
  let s;
  if (Array.isArray(value) || typeof value === 'object') s = JSON.stringify(value);
  else s = String(value);
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Rows are read by their real column names; the header row may differ (renamed).
export function toCsv(rows, columns, headers = columns) {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function columnsForTable(table) {
  return ['id', ...columnsOf(table), ...META_HEAD];
}

// The CSV header row: real column names with the user-facing renames applied.
export function headersForColumns(columns) {
  return columns.map((c) => COLUMN_RENAME[c] || c);
}

// The user-facing CSV file name for a table.
export function fileNameForTable(table) {
  return `${FILE_NAMES[table] || table}.csv`;
}

/**
 * @returns {Promise<Array<{name:string, content:string, rows:number}>>}
 */
export async function buildCsvExport(store) {
  const files = [];
  for (const table of CSV_TABLES) {
    const columns = columnsForTable(table);
    const headers = headersForColumns(columns);
    const raw = await store.list(table, { includeDeleted: true, orderBy: { col: 'created_at', dir: 'asc' } });
    const rows = raw.map((r) => serializeRow(table, r));
    files.push({ name: fileNameForTable(table), content: toCsv(rows, columns, headers), rows: rows.length });
  }
  return files;
}
