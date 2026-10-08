// Hash-based router. Routes: journal[/legId], map, photos, statistics,
// settings, trash. Hash routing keeps the app a pure static SPA.

export function parseHash() {
  const raw = (location.hash || '').replace(/^#/, '');
  const parts = raw.split('/').filter(Boolean);
  const name = parts[0] || 'journal';
  return { name, param: parts[1] || null, parts };
}

export function navigate(to) {
  const next = to.startsWith('#') ? to : `#${to}`;
  if (location.hash === next) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = next;
  }
}

export function onRoute(fn) {
  window.addEventListener('hashchange', fn);
}
