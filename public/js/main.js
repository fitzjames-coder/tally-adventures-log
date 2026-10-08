// Bootstrap: register the service worker, request persistent storage once, load
// data, and render the current route. No framework, no build step.

import { el, mount } from './dom.js';
import { icon } from './icons.js';
import { parseHash, navigate, onRoute } from './router.js';
import { loadAll, loadCurrent, currentAdventure } from './state.js';
import { renderSidebar, toggleDrawer, closeDrawer } from './ui/sidebar.js';
import { renderJournal } from './views/journal.js';
import { renderMap } from './views/map.js';
import { renderPhotos } from './views/photos.js';
import { renderStatistics } from './views/statistics.js';
import { renderSettings } from './views/settings.js';
import { renderTrash } from './views/trash.js';

const root = document.getElementById('app');

const VIEWS = {
  journal: renderJournal,
  map: renderMap,
  photos: renderPhotos,
  statistics: renderStatistics,
  settings: renderSettings,
  trash: renderTrash,
};

const NAV_TITLE = { journal: 'Journal', map: 'Map', photos: 'Photos', statistics: 'Statistics', settings: 'Settings', trash: 'Trash' };

const app = {
  route: parseHash(),
  navigate,
  render,
  async refresh() { await loadCurrent(); render(); },
  async reloadAll() { await loadAll(); render(); },
};

function renderView() {
  const fn = VIEWS[app.route.name] || renderJournal;
  try {
    return fn(app);
  } catch (err) {
    console.error(err);
    return el('div', { class: 'empty' }, el('h3', { text: 'Something went wrong' }), el('p', { class: 'muted', text: err?.message || String(err) }));
  }
}

function topbar() {
  const menu = el('button', { class: 'menu-btn', type: 'button', 'aria-label': 'Open menu' });
  menu.append(icon('menu'));
  menu.addEventListener('click', () => toggleDrawer());
  const adv = currentAdventure();
  const title = app.route.name === 'journal' && adv ? adv.title : (NAV_TITLE[app.route.name] || 'TALLY');
  return el('div', { class: 'topbar' }, menu, el('div', { class: 'tb-title', text: title }));
}

function render() {
  app.route = parseHash();

  const shell = el('div', { class: 'app' });
  const main = el('div', { class: 'main' });
  const canvas = el('div', { class: 'canvas', id: 'canvas' });
  canvas.append(renderView());
  main.append(topbar(), canvas);
  shell.append(renderSidebar(app), main);

  const scrim = el('div', { class: 'scrim', id: 'scrim' });
  scrim.addEventListener('click', () => closeDrawer());

  mount(root, el('div', {}, shell, scrim));
  window.scrollTo(0, 0);
}

function fatal(message) {
  mount(root, el('div', { class: 'canvas' },
    el('div', { class: 'empty' },
      el('h3', { text: 'Could not start' }),
      el('p', { class: 'muted', text: message }),
    )));
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW registration failed', err));
  });
}

function requestPersistOnce() {
  if (!navigator.storage || !navigator.storage.persist) return;
  if (localStorage.getItem('tally.persistAsked')) return;
  localStorage.setItem('tally.persistAsked', '1');
  navigator.storage.persist().catch(() => {});
}

async function boot() {
  registerServiceWorker();
  requestPersistOnce();
  try {
    await loadAll();
  } catch (err) {
    console.error(err);
    fatal(err?.message || 'The journal could not load. Check that the database migration has been applied.');
    return;
  }
  if (!location.hash) location.hash = '#/journal';
  onRoute(render);
  render();
}

boot();
