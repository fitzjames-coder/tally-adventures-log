// Unit-tests the service worker's fetch strategies in Node by loading sw.js in
// a fake Service Worker environment (fake self/caches/fetch) and invoking the
// registered fetch handler. No browser needed.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SW_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sw.js');

const handlers = {};
let fetchMode = 'ok'; // 'ok' | 'fail'

const urlOf = (req) => (typeof req === 'string' ? req : req.url);

class FakeCache {
  constructor() { this.map = new Map(); }
  async match(req) { return this.map.get(urlOf(req)); }
  async put(req, res) { this.map.set(urlOf(req), res); }
  async addAll() {}
}

function makeCaches(seed = {}) {
  const m = new Map();
  for (const [name, entries] of Object.entries(seed)) {
    const c = new FakeCache();
    for (const [u, body] of Object.entries(entries)) c.map.set('https://app.test' + u, new Response(body, { status: 200 }));
    m.set(name, c);
  }
  return {
    _m: m,
    async open(n) { if (!m.has(n)) m.set(n, new FakeCache()); return m.get(n); },
  };
}

// Install globals, then load the worker (registers its handlers).
globalThis.self = { addEventListener: (t, fn) => { handlers[t] = fn; }, skipWaiting() {}, clients: { claim() {} } };
globalThis.location = { origin: 'https://app.test' };
globalThis.fetch = async (req) => {
  if (fetchMode === 'fail') throw new Error('offline');
  return new Response('NET:' + urlOf(req), { status: 200 });
};

before(async () => { await import(SW_PATH); });

const req = (path, mode = 'cors') => ({ url: 'https://app.test' + path, method: 'GET', mode });

function dispatch(request) {
  let out;
  handlers.fetch({ request, respondWith(p) { out = p; } });
  return out;
}

test('shell JS is network-first: serves fresh and refreshes the cache', async () => {
  globalThis.caches = makeCaches({ 'tally-shell-v3': { '/js/main.js': 'OLD-JS' } });
  fetchMode = 'ok';
  const res = await dispatch(req('/js/main.js'));
  assert.equal(await res.text(), 'NET:https://app.test/js/main.js', 'serves fresh network copy, not stale cache');
  const cache = await globalThis.caches.open('tally-shell-v3');
  assert.equal(await (await cache.match(req('/js/main.js'))).text(), 'NET:https://app.test/js/main.js', 'cache refreshed');
});

test('shell CSS falls back to cache when offline', async () => {
  globalThis.caches = makeCaches({ 'tally-shell-v3': { '/css/styles.css': 'OLD-CSS' } });
  fetchMode = 'fail';
  const res = await dispatch(req('/css/styles.css'));
  assert.equal(await res.text(), 'OLD-CSS', 'offline falls back to cached copy');
});

test('fonts stay cache-first (served from cache without revalidation)', async () => {
  globalThis.caches = makeCaches({ 'tally-shell-v3': { '/fonts/B612-Regular.ttf': 'CACHED-FONT' } });
  fetchMode = 'ok';
  const res = await dispatch(req('/fonts/B612-Regular.ttf'));
  assert.equal(await res.text(), 'CACHED-FONT', 'font served from cache, not re-fetched');
});

test('/api is network-only (never cached)', async () => {
  globalThis.caches = makeCaches({});
  fetchMode = 'ok';
  const ok = await dispatch(req('/api/health'));
  assert.equal(await ok.text(), 'NET:https://app.test/api/health');
  fetchMode = 'fail';
  const off = await dispatch(req('/api/health'));
  assert.equal(off.status, 503, 'offline API returns 503, not a cached response');
});

test('/media is cache-first, cached only after being fetched', async () => {
  globalThis.caches = makeCaches({ 'tally-media-v1': { '/media/thumbs/x.webp': 'CACHED-IMG' } });
  fetchMode = 'ok';
  const hit = await dispatch(req('/media/thumbs/x.webp'));
  assert.equal(await hit.text(), 'CACHED-IMG', 'viewed photo served from cache');

  const miss = await dispatch(req('/media/web/new.webp'));
  assert.equal(await miss.text(), 'NET:https://app.test/media/web/new.webp', 'new photo fetched');
  const media = await globalThis.caches.open('tally-media-v1');
  assert.ok(await media.match(req('/media/web/new.webp')), 'cached after first view');
});
