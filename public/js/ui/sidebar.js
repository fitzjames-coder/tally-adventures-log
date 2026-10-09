// The fixed navy sidebar (desktop) / slide-in drawer (phone): brand, primary
// nav, and the journey's destinations in flying order.

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { chaptersOrdered } from '../state.js';
import { openChapterForm } from './forms.js';
import { navigate } from '../router.js';

const NAV = [
  { name: 'book', label: 'Journal', icon: 'journal', match: ['book', 'chapter', 'paragraph'] },
  { name: 'map', label: 'Map', icon: 'map', match: ['map'] },
  { name: 'photos', label: 'Photos', icon: 'photos', match: ['photos'] },
  { name: 'statistics', label: 'Statistics', icon: 'statistics', match: ['statistics'] },
  { name: 'settings', label: 'Settings', icon: 'settings', match: ['settings'] },
  { name: 'trash', label: 'Trash', icon: 'trash', match: ['trash'] },
];

export function renderSidebar(app) {
  const side = el('aside', { class: 'sidebar', id: 'sidebar' });
  // Inner wrapper holds the content and stays pinned while the navy column
  // itself stretches to the full page height (see .sidebar / .sidebar-inner).
  const inner = el('div', { class: 'sidebar-inner' });
  side.append(inner);

  inner.append(el('div', { class: 'brand' },
    el('img', { class: 'brand-wordmark', src: '/brand/wordmark-on-navy.png', alt: 'TALLY JOURNEY — Every flight has a story' })));

  const nav = el('nav', { class: 'nav', 'aria-label': 'Primary' });
  for (const item of NAV) {
    const active = item.match.includes(app.route.name);
    const link = el('a', { href: `#/${item.name}`, class: active ? 'active' : '' });
    link.append(icon(item.icon), el('span', { text: item.label }));
    link.addEventListener('click', () => closeDrawer());
    nav.append(link);
  }
  inner.append(nav);

  // Destinations in flying order
  const chapters = chaptersOrdered();
  const chapWrap = el('div', { class: 'chap-nav' });
  const head = el('div', { class: 'eyebrow', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
    el('span', { text: 'Destinations' }));
  const add = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'New destination', style: { width: '28px', height: '28px' } });
  add.append(icon('plus'));
  add.addEventListener('click', () => openChapterForm({ nextOrder: chapters.length, onSaved: (ch) => { navigate(`/chapter/${ch.id}`); return app.refresh(); } }));
  head.append(add);
  chapWrap.append(head);

  if (!chapters.length) {
    chapWrap.append(el('div', { class: 'muted', style: { padding: '8px 12px', fontSize: '12px' }, text: 'Add a destination to begin the journey.' }));
  } else {
    chapters.forEach((ch, i) => {
      const active = app.route.name === 'chapter' && app.route.param === ch.id;
      const item = el('a', { href: `#/chapter/${ch.id}`, class: 'chap-item' + (active ? ' active' : '') },
        el('span', { class: 'cn', text: String(i + 1).padStart(2, '0') }),
        el('span', { class: 'ct', text: ch.title }));
      item.addEventListener('click', () => closeDrawer());
      chapWrap.append(item);
    });
  }
  inner.append(chapWrap);
  return side;
}

export function toggleDrawer(force) {
  const side = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');
  if (!side) return;
  const open = force === undefined ? !side.classList.contains('open') : force;
  side.classList.toggle('open', open);
  if (scrim) scrim.classList.toggle('open', open);
}

export function closeDrawer() {
  toggleDrawer(false);
}
