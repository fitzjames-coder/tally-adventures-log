// In-memory store. Used by the test suite to exercise the real controller logic
// (create / soft-delete / restore / empty-trash) without a live D1, and handy
// for local experiments. Mirrors D1Store's interface and invariants exactly:
//   - soft delete only sets deleted_at; the row is never removed,
//   - there is no per-row hard delete,
//   - emptyTrash() is the single hard-delete path.

import { TABLE_NAMES } from './schema.js';
import { notFound } from './errors.js';

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

export class MemoryStore {
  constructor() {
    this.tables = {};
    for (const t of TABLE_NAMES) this.tables[t] = new Map();
    this.objects = new Map(); // R2 stand-in: key -> { body, contentType }
  }

  async create(table, values) {
    const ts = now();
    const { id: providedId, ...rest } = values;
    const row = { id: providedId || uuid(), ...rest, created_at: ts, updated_at: ts, deleted_at: null };
    this.tables[table].set(row.id, row);
    return { ...row };
  }

  async get(table, id, { includeDeleted = false } = {}) {
    const row = this.tables[table].get(id);
    if (!row) return null;
    if (!includeDeleted && row.deleted_at !== null) return null;
    return { ...row };
  }

  async list(table, { filter = {}, includeDeleted = false, onlyDeleted = false, orderBy = null } = {}) {
    let rows = [...this.tables[table].values()];
    rows = rows.filter((r) => {
      if (onlyDeleted) return r.deleted_at !== null;
      if (!includeDeleted) return r.deleted_at === null;
      return true;
    });
    for (const [k, v] of Object.entries(filter)) {
      rows = rows.filter((r) => r[k] === v);
    }
    if (orderBy) {
      rows.sort((a, b) => cmp(a[orderBy.col], b[orderBy.col]) * (orderBy.dir === 'desc' ? -1 : 1));
    }
    return rows.map((r) => ({ ...r }));
  }

  async update(table, id, patch) {
    const row = this.tables[table].get(id);
    if (!row || row.deleted_at !== null) throw notFound();
    Object.assign(row, patch, { updated_at: now() });
    return { ...row };
  }

  async softDelete(table, id) {
    const row = this.tables[table].get(id);
    if (!row || row.deleted_at !== null) throw notFound();
    row.deleted_at = now();
    row.updated_at = row.deleted_at;
    return { ...row };
  }

  async restore(table, id) {
    const row = this.tables[table].get(id);
    if (!row || row.deleted_at === null) throw notFound('Nothing to restore');
    row.deleted_at = null;
    row.updated_at = now();
    return { ...row };
  }

  async emptyTrash() {
    const counts = {};
    const photoKeys = [];
    const docKeys = [];
    for (const t of TABLE_NAMES) {
      const map = this.tables[t];
      let n = 0;
      for (const [id, row] of [...map.entries()]) {
        if (row.deleted_at === null) continue;
        if (t === 'photos') {
          for (const key of [row.original_key, row.web_key, row.thumb_key]) {
            if (key) photoKeys.push(key);
          }
        }
        if (t === 'documents' && row.r2_key) docKeys.push(row.r2_key);
        map.delete(id);
        n += 1;
      }
      if (n) counts[t] = n;
    }
    for (const key of [...photoKeys, ...docKeys]) this.objects.delete(key);
    return { counts, photoKeys, docKeys };
  }

  // --- media (R2 stand-in) ---
  async putObject(key, body, contentType) {
    this.objects.set(key, { body, contentType });
  }

  async getObject(key) {
    return this.objects.get(key) || null;
  }

  async deleteObject(key) {
    this.objects.delete(key);
  }
}

function cmp(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return a < b ? -1 : 1;
}
