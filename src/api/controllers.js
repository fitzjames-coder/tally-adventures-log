// Controllers: all API business logic, independent of HTTP and of the storage
// backend. The Worker parses a request and calls these with a store; the tests
// call them with an in-memory store. Each returns plain data or throws ApiError.

import { validate } from '../lib/validation.js';
import { serializeRow } from '../lib/serialize.js';
import { TABLES, isTable } from '../lib/schema.js';
import { ApiError, badRequest, notFound } from '../lib/errors.js';

const ORDER = {
  adventures: { col: 'created_at', dir: 'asc' },
  destinations: { col: 'sort_order', dir: 'asc' },
  legs: { col: 'flight_date', dir: 'asc' },
  moments: { col: 'sort_order', dir: 'asc' },
  leg_destinations: { col: 'created_at', dir: 'asc' },
  photos: { col: 'created_at', dir: 'desc' },
};

// Which query-string filters each collection accepts.
const FILTERS = {
  destinations: ['adventure_id', 'status', 'tier'],
  legs: ['adventure_id', 'status'],
  moments: ['leg_id', 'phase', 'photo_id'],
  leg_destinations: ['leg_id', 'destination_id'],
  adventures: ['status'],
  photos: [],
};

function ser(table, row) {
  return serializeRow(table, row);
}

async function ensureParent(store, table, id, label) {
  const row = await store.get(table, id);
  if (!row) throw badRequest(`${label} does not exist`);
  return row;
}

// --- generic CRUD, reused by every top-level resource ---

function collection(table) {
  return {
    async list(store, query = {}) {
      const filter = {};
      for (const key of FILTERS[table] || []) {
        if (query[key] !== undefined && query[key] !== '') filter[key] = String(query[key]);
      }
      const rows = await store.list(table, { filter, orderBy: ORDER[table] });
      return rows.map((r) => ser(table, r));
    },

    async get(store, id) {
      const row = await store.get(table, id);
      if (!row) throw notFound();
      return ser(table, row);
    },

    async create(store, body) {
      const values = validate(table, body);
      await checkReferences(store, table, values);
      const row = await store.create(table, values);
      return ser(table, row);
    },

    async update(store, id, body) {
      const values = validate(table, body, { partial: true });
      if (Object.keys(values).length === 0) throw badRequest('No fields to update');
      await checkReferences(store, table, values);
      const row = await store.update(table, id, values);
      return ser(table, row);
    },

    async remove(store, id) {
      const row = await store.softDelete(table, id);
      return ser(table, row);
    },
  };
}

// Verify foreign-key-style references point at live rows, with clear messages.
async function checkReferences(store, table, values) {
  if (table === 'destinations' && values.adventure_id) {
    await ensureParent(store, 'adventures', values.adventure_id, 'Adventure');
  }
  if (table === 'legs' && values.adventure_id) {
    await ensureParent(store, 'adventures', values.adventure_id, 'Adventure');
  }
  if (table === 'moments') {
    if (values.leg_id) await ensureParent(store, 'legs', values.leg_id, 'Flight');
    if (values.photo_id) await ensureParent(store, 'photos', values.photo_id, 'Photo');
  }
  if (table === 'leg_destinations') {
    if (values.leg_id) await ensureParent(store, 'legs', values.leg_id, 'Flight');
    if (values.destination_id) await ensureParent(store, 'destinations', values.destination_id, 'Destination');
  }
}

export const adventures = collection('adventures');
export const destinations = collection('destinations');
export const legs = collection('legs');
export const moments = collection('moments');
export const legDestinations = collection('leg_destinations');

// --- moments: reorder within a leg ---

export async function reorderMoments(store, legId, orderedIds) {
  if (!Array.isArray(orderedIds)) throw badRequest('Expected a list of moment ids');
  const leg = await store.get('legs', legId);
  if (!leg) throw notFound('Flight not found');

  const current = await store.list('moments', { filter: { leg_id: legId } });
  const byId = new Map(current.map((m) => [m.id, m]));

  if (orderedIds.length !== current.length) {
    throw badRequest('The order must list every moment in this flight exactly once');
  }
  const seen = new Set();
  for (const id of orderedIds) {
    if (!byId.has(id)) throw badRequest(`Moment ${id} is not part of this flight`);
    if (seen.has(id)) throw badRequest('A moment id appears more than once');
    seen.add(id);
  }

  const updated = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const row = await store.update('moments', orderedIds[i], { sort_order: i });
    updated.push(ser('moments', row));
  }
  return updated;
}

// --- photos: upload (three files already resized on the device) ---

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

function originalExt(filename, mime) {
  if (MIME_EXT[mime]) return MIME_EXT[mime];
  const m = String(filename || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  if (m) return m[1];
  return 'jpg';
}

/**
 * @param store
 * @param parts { original:{bytes,type}, web:{bytes,type}, thumb:{bytes,type}, meta:{} }
 *        each file part carries `bytes` (ArrayBuffer/Uint8Array/Blob) and `type`.
 */
export async function createPhoto(store, parts) {
  const { original, web, thumb, meta = {} } = parts;
  for (const [name, file] of [['original', original], ['web', web], ['thumb', thumb]]) {
    if (!file || file.bytes === undefined || file.bytes === null) {
      throw badRequest(`Missing "${name}" file in upload`);
    }
  }

  const photoId = crypto.randomUUID();
  const ext = originalExt(meta.original_filename, meta.mime);
  const keys = {
    original_key: `originals/${photoId}.${ext}`,
    web_key: `web/${photoId}.webp`,
    thumb_key: `thumbs/${photoId}.webp`,
  };

  // Validate only the client-supplied metadata; the server owns the keys.
  const metaValues = validate('photos', {
    original_filename: meta.original_filename,
    mime: meta.mime,
    width: meta.width,
    height: meta.height,
    bytes: meta.bytes,
    sha256: meta.sha256,
    alt: meta.alt,
    caption: meta.caption,
    taken_at: meta.taken_at,
  }, { partial: true });

  await store.putObject(keys.original_key, original.bytes, original.type || meta.mime || 'application/octet-stream');
  await store.putObject(keys.web_key, web.bytes, 'image/webp');
  await store.putObject(keys.thumb_key, thumb.bytes, 'image/webp');

  const row = await store.create('photos', { id: photoId, ...metaValues, ...keys });
  return ser('photos', row);
}

export async function updatePhoto(store, id, body) {
  // Only metadata may be edited; keys and bytes are immutable.
  const allowed = {};
  for (const k of ['alt', 'caption', 'taken_at', 'original_filename']) {
    if (body[k] !== undefined) allowed[k] = body[k];
  }
  const values = validate('photos', allowed, { partial: true });
  if (Object.keys(values).length === 0) throw badRequest('No photo fields to update');
  const row = await store.update('photos', id, values);
  return ser('photos', row);
}

export async function removePhoto(store, id) {
  const row = await store.softDelete('photos', id);
  return ser('photos', row);
}

// --- trash ---

function trashLabel(table, row) {
  switch (table) {
    case 'adventures': return row.title || 'Untitled adventure';
    case 'destinations': return row.name || 'Destination';
    case 'legs': {
      const route = [row.dep_icao, row.arr_icao].filter(Boolean).join(' → ');
      return row.title || route || 'Flight';
    }
    case 'moments': return row.title || row.phase || 'Moment';
    case 'photos': return row.original_filename || row.caption || 'Photo';
    case 'leg_destinations': return 'Flight–destination link';
    default: return table;
  }
}

const TRASH_TABLES = ['adventures', 'destinations', 'legs', 'moments', 'photos'];

export async function listTrash(store) {
  const items = [];
  for (const table of TRASH_TABLES) {
    const rows = await store.list(table, { onlyDeleted: true });
    for (const row of rows) {
      items.push({
        type: table,
        id: row.id,
        label: trashLabel(table, row),
        deleted_at: row.deleted_at,
        record: ser(table, row),
      });
    }
  }
  items.sort((a, b) => (a.deleted_at < b.deleted_at ? 1 : -1));
  return items;
}

export async function restore(store, body) {
  const type = String(body?.type || '');
  const id = String(body?.id || '');
  if (!isTable(type)) throw badRequest('Unknown item type to restore');
  if (!id) throw badRequest('Missing id to restore');
  const row = await store.restore(type, id);
  return ser(type, row);
}

export async function emptyTrash(store) {
  const result = await store.emptyTrash();
  return { emptied: true, counts: result.counts, removedPhotoObjects: result.photoKeys.length };
}

// --- export: every record as one JSON document ---

export async function exportAll(store) {
  const data = {};
  for (const table of Object.keys(TABLES)) {
    const rows = await store.list(table, { includeDeleted: true, orderBy: ORDER[table] });
    data[table] = rows.map((r) => ser(table, r));
  }
  return {
    app: 'TALLY ADVENTURES Log',
    schema_version: 1,
    exported_at: new Date().toISOString(),
    data,
  };
}
