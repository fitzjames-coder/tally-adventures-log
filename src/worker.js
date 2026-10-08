// TALLY ADVENTURES Log - Worker entry point.
// Responsibilities: the JSON API under /api, photo bytes under /media, and
// handing everything else to the static asset server (the app shell).

import { D1Store } from './lib/d1store.js';
import { ApiError, badRequest, notFound, methodNotAllowed } from './lib/errors.js';
import * as c from './api/controllers.js';

const RESOURCES = {
  adventures: c.adventures,
  destinations: c.destinations,
  legs: c.legs,
  moments: c.moments,
  'leg-destinations': c.legDestinations,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        return await handleApi(request, env, url);
      }
      if (pathname.startsWith('/media/')) {
        return await handleMedia(request, env, pathname);
      }
    } catch (err) {
      return errorResponse(err);
    }

    // Static app shell (index.html, css, js, fonts, icons, manifest, sw).
    return env.ASSETS.fetch(request);
  },
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function handleApi(request, env, url) {
  const store = new D1Store(env);
  const method = request.method.toUpperCase();
  const segments = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const parts = segments.slice(1);
  const query = Object.fromEntries(url.searchParams.entries());

  // /api/health
  if (parts.length === 1 && parts[0] === 'health') {
    return json({ ok: true, app: 'TALLY JOURNEY' });
  }

  // /api/export
  if (parts[0] === 'export') {
    requireMethod(method, 'GET');
    const payload = await c.exportAll(store);
    return json(payload, 200, {
      'Content-Disposition': 'attachment; filename="tally-adventures-log-export.json"',
    });
  }

  // /api/trash, /api/trash/restore, /api/trash/empty
  if (parts[0] === 'trash') {
    if (parts.length === 1) {
      requireMethod(method, 'GET');
      return json(await c.listTrash(store));
    }
    if (parts.length === 2 && parts[1] === 'restore') {
      requireMethod(method, 'POST');
      return json(await c.restore(store, await readJson(request)));
    }
    if (parts.length === 2 && parts[1] === 'empty') {
      requireMethod(method, 'POST');
      return json(await c.emptyTrash(store));
    }
    throw notFound();
  }

  // /api/photos ...
  if (parts[0] === 'photos') {
    return handlePhotos(store, request, method, parts);
  }

  // /api/legs/:id/moments/reorder
  if (parts[0] === 'legs' && parts.length === 4 && parts[2] === 'moments' && parts[3] === 'reorder') {
    requireMethod(method, 'POST');
    const body = await readJson(request);
    const order = Array.isArray(body) ? body : body.order;
    return json(await c.reorderMoments(store, parts[1], order));
  }

  // /api/<resource> and /api/<resource>/:id
  const ctrl = RESOURCES[parts[0]];
  if (ctrl) {
    if (parts.length === 1) {
      if (method === 'GET') return json(await ctrl.list(store, query));
      if (method === 'POST') return json(await ctrl.create(store, await readJson(request)), 201);
      throw methodNotAllowed();
    }
    if (parts.length === 2) {
      const id = parts[1];
      if (method === 'GET') return json(await ctrl.get(store, id));
      if (method === 'PATCH' || method === 'PUT') return json(await ctrl.update(store, id, await readJson(request)));
      if (method === 'DELETE') return json(await ctrl.remove(store, id));
      throw methodNotAllowed();
    }
  }

  throw notFound('Unknown API endpoint');
}

async function handlePhotos(store, request, method, parts) {
  if (parts.length === 1) {
    if (method === 'POST') {
      const form = await readFormData(request);
      const fileOf = (name) => form.get(name);
      const toPart = async (name) => {
        const f = fileOf(name);
        if (!f || typeof f === 'string') return null;
        return { bytes: await f.arrayBuffer(), type: f.type };
      };
      const metaKeys = ['original_filename', 'mime', 'width', 'height', 'bytes', 'sha256', 'alt', 'caption', 'taken_at'];
      const meta = {};
      for (const k of metaKeys) {
        const v = form.get(k);
        if (v !== null && typeof v === 'string') meta[k] = v;
      }
      const result = await c.createPhoto(store, {
        original: await toPart('original'),
        web: await toPart('web'),
        thumb: await toPart('thumb'),
        meta,
      });
      return json(result, 201);
    }
    if (method === 'GET') {
      return json((await store.list('photos', { orderBy: { col: 'created_at', dir: 'desc' } })).map((r) => r));
    }
    throw methodNotAllowed();
  }

  if (parts.length === 2) {
    const id = parts[1];
    if (method === 'GET') {
      const row = await store.get('photos', id);
      if (!row) throw notFound();
      return json(row);
    }
    if (method === 'PATCH' || method === 'PUT') return json(await c.updatePhoto(store, id, await readJson(request)));
    if (method === 'DELETE') return json(await c.removePhoto(store, id));
    throw methodNotAllowed();
  }

  throw notFound();
}

// ---------------------------------------------------------------------------
// Media (R2)
// ---------------------------------------------------------------------------

async function handleMedia(request, env, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') throw methodNotAllowed();
  const key = decodeURIComponent(pathname.slice('/media/'.length));
  if (!/^(originals|web|thumbs)\/[A-Za-z0-9._-]+$/.test(key)) throw notFound('Invalid media key');

  const object = await env.MEDIA.get(key);
  if (!object) throw notFound('Media not found');

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  if (!headers.get('Content-Type')) headers.set('Content-Type', 'application/octet-stream');

  const body = request.method === 'HEAD' ? null : object.body;
  return new Response(body, { headers });
}

// ---------------------------------------------------------------------------
// Request/response helpers
// ---------------------------------------------------------------------------

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function errorResponse(err) {
  if (err instanceof ApiError) {
    const payload = { error: err.message };
    if (err.details) payload.details = err.details;
    return json(payload, err.status);
  }
  // Unexpected: keep the message generic, log for the operator.
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  return json({ error: 'Internal server error' }, 500);
}

function requireMethod(method, expected) {
  if (method !== expected) throw methodNotAllowed();
}

async function readJson(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return {};
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw badRequest('Expected a JSON request body');
  try {
    return await request.json();
  } catch {
    throw badRequest('Request body is not valid JSON');
  }
}

async function readFormData(request) {
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) throw badRequest('Expected a multipart/form-data upload');
  try {
    return await request.formData();
  } catch {
    throw badRequest('Could not read the upload');
  }
}
