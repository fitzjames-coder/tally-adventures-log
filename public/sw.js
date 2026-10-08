// Service worker.
//  - App shell: precache the essentials, cache the rest of the shell at runtime.
//  - /api: network only; API responses are never cached as permanent truth.
//  - /media: cache-first, but a photo is only added to the cache after it has
//    actually been fetched (i.e. viewed). Nothing is pre-downloaded.

const SHELL = 'tally-shell-v2';
const MEDIA = 'tally-media-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/css/fonts.css',
  '/css/styles.css',
  '/manifest.webmanifest',
  '/js/main.js',
  '/fonts/B612-Regular.ttf',
  '/fonts/B612-Bold.ttf',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
  '/brand/icon-1024.png',
  '/brand/apple-touch-icon.png',
  '/brand/wordmark-on-navy.png',
  '/brand/wordmark-on-cream.png',
  '/brand/plane-top.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
  } else if (url.pathname.startsWith('/media/')) {
    event.respondWith(cacheFirstMedia(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(navigateShell(request));
  } else {
    event.respondWith(shellAsset(request));
  }
});

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ error: 'You appear to be offline.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirstMedia(request) {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone()); // cached only now that it was viewed
    return res;
  } catch {
    return hit || Response.error();
  }
}

async function navigateShell(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL);
    return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
  }
}

async function shellAsset(request) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return hit || Response.error();
  }
}
