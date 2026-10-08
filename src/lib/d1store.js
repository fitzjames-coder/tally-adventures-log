// D1 + R2 backed store. Same interface and invariants as MemoryStore. Table and
// column names come only from the fixed schema (never from request data), so the
// dynamic SQL below is not an injection surface; all values are bound.

import { TABLE_NAMES, isTable } from './schema.js';
import { notFound, ApiError } from './errors.js';

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

export class D1Store {
  constructor(env) {
    this.db = env.DB;
    this.bucket = env.MEDIA;
  }

  async create(table, values) {
    assertTable(table);
    const ts = now();
    const { id: providedId, ...rest } = values;
    const row = { id: providedId || uuid(), ...rest, created_at: ts, updated_at: ts, deleted_at: null };
    const cols = Object.keys(row);
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    await this.db.prepare(sql).bind(...cols.map((c) => row[c])).run();
    return this.get(table, row.id, { includeDeleted: true });
  }

  async get(table, id, { includeDeleted = false } = {}) {
    assertTable(table);
    const sql = `SELECT * FROM ${table} WHERE id = ?${includeDeleted ? '' : ' AND deleted_at IS NULL'}`;
    return (await this.db.prepare(sql).bind(id).first()) || null;
  }

  async list(table, { filter = {}, includeDeleted = false, onlyDeleted = false, orderBy = null } = {}) {
    assertTable(table);
    const where = [];
    const params = [];
    if (onlyDeleted) where.push('deleted_at IS NOT NULL');
    else if (!includeDeleted) where.push('deleted_at IS NULL');
    for (const [k, v] of Object.entries(filter)) {
      where.push(`${k} = ?`);
      params.push(v);
    }
    let sql = `SELECT * FROM ${table}`;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    if (orderBy) sql += ` ORDER BY ${orderBy.col} ${orderBy.dir === 'desc' ? 'DESC' : 'ASC'}`;
    const { results } = await this.db.prepare(sql).bind(...params).all();
    return results || [];
  }

  async update(table, id, patch) {
    assertTable(table);
    const next = { ...patch, updated_at: now() };
    const cols = Object.keys(next);
    const sql = `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND deleted_at IS NULL`;
    const res = await this.db.prepare(sql).bind(...cols.map((c) => next[c]), id).run();
    if (!res.meta.changes) throw notFound();
    return this.get(table, id);
  }

  async softDelete(table, id) {
    assertTable(table);
    const ts = now();
    const sql = `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`;
    const res = await this.db.prepare(sql).bind(ts, ts, id).run();
    if (!res.meta.changes) throw notFound();
    return this.get(table, id, { includeDeleted: true });
  }

  async restore(table, id) {
    assertTable(table);
    const sql = `UPDATE ${table} SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL`;
    const res = await this.db.prepare(sql).bind(now(), id).run();
    if (!res.meta.changes) throw notFound('Nothing to restore');
    return this.get(table, id);
  }

  async emptyTrash() {
    const counts = {};
    const photoKeys = [];
    const docKeys = [];

    const trashedPhotos = await this.list('photos', { onlyDeleted: true });
    for (const p of trashedPhotos) {
      for (const key of [p.original_key, p.web_key, p.thumb_key]) {
        if (key) photoKeys.push(key);
      }
    }
    const trashedDocs = await this.list('documents', { onlyDeleted: true });
    for (const d of trashedDocs) {
      if (d.r2_key) docKeys.push(d.r2_key);
    }

    for (const t of TABLE_NAMES) {
      const res = await this.db.prepare(`DELETE FROM ${t} WHERE deleted_at IS NOT NULL`).run();
      if (res.meta.changes) counts[t] = res.meta.changes;
    }

    const objectKeys = [...photoKeys, ...docKeys];
    if (this.bucket && objectKeys.length) {
      await this.bucket.delete(objectKeys);
    }
    return { counts, photoKeys, docKeys };
  }

  // --- media (R2) ---
  async putObject(key, body, contentType) {
    await this.bucket.put(key, body, {
      httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
    });
  }

  async getObject(key) {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return { body: obj.body, contentType: obj.httpMetadata?.contentType, object: obj };
  }

  async deleteObject(key) {
    await this.bucket.delete(key);
  }
}

function assertTable(table) {
  if (!isTable(table)) throw new ApiError(500, `Unknown table: ${table}`);
}
