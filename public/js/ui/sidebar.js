// The fixed navy sidebar (desktop) / slide-in drawer (phone): brand, current
// adventure, primary nav, and the list of flight legs.

import { el, svgEl } from '../dom.js';
import { icon } from '../icons.js';
import { store, currentAdventure, setCurrent, loadCurrent } from '../state.js';
import { openDialog } from './dialog.js';
import { openAdventureForm, openLegForm } from './forms.js';

const MARK = `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="2" y="2" width="60" height="60" rx="15" fill="#163973"/>
  <path fill="#F5E8D8" d="M52 12 L12 30 L28 34 Z"/>
  <path fill="#F5E8D8" d="M52 12 L28 34 L34 50 Z"/>
  <path fill="#163973" opacity="0.28" d="M52 12 L28 34 L31 41 Z"/>
  <rect x="16" y="54" width="32" height="4" rx="2" fill="#F09A1F"/>
</svg>`;

export function brandMark(cls = 'mark') {
  const svg = svgEl(MARK);
  svg.setAttribute('class', cls);
  return svg;
}

const NAV = [
  { name: 'journal', label: 'Journal', icon: 'journal' },
  { name: 'map', label: 'Map', icon: 'map' },
  { name: 'photos', label: 'Photos', icon: 'photos' },
  { name: 'statistics', label: 'Statistics', icon: 'statistics' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
  { name: 'trash', label: 'Trash', icon: 'trash' },
];

export function renderSidebar(app) {
  const adv = currentAdventure();
  const side = el('aside', { class: 'sidebar', id: 'sidebar' });

  // Brand
  const brand = el('div', { class: 'brand' },
    brandMark(),
    el('div', { class: 'wordmark' }, 'TALLY', el('small', { text: 'Adventures Log' })),
  );
  side.append(brand);

  // Current adventure switch
  const switchBtn = el('button', { class: 'adv-switch', type: 'button' },
    el('div', { class: 'eyebrow', text: adv ? 'Current adventure' : 'No adventure yet' }),
    el('div', { class: 'title', text: adv ? adv.title : 'Create your first one' }),
  );
  switchBtn.addEventListener('click', () => openAdventurePicker(app));
  side.append(switchBtn);

  // Primary nav
  const nav = el('nav', { class: 'nav', 'aria-label': 'Primary' });
  for (const item of NAV) {
    const link = el('a', { href: `#/${item.name}`, class: app.route.name === item.name ? 'active' : '' });
    link.append(icon(item.icon), el('span', { text: item.label }));
    link.addEventListener('click', () => closeDrawer());
    nav.append(link);
  }
  side.append(nav);

  // Flight legs
  const legWrap = el('div', { class: 'leg-list' });
  const head = el('div', { class: 'eyebrow', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
    el('span', { text: 'Flights' }),
  );
  if (adv) {
    const add = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'New flight', style: { width: '28px', height: '28px' } });
    add.append(icon('plus'));
    add.addEventListener('click', () => openLegForm({ section: 'new', adventureId: adv.id, onSaved: (leg) => { app.navigate(`/journal/${leg.id}`); return app.refresh(); } }));
    head.append(add);
  }
  legWrap.append(head);

  if (!adv) {
    legWrap.append(el('div', { class: 'muted', style: { padding: '8px 12px', fontSize: '12px' }, text: 'Start an adventure to log flights.' }));
  } else if (store.legs.length === 0) {
    legWrap.append(el('div', { class: 'muted', style: { padding: '8px 12px', fontSize: '12px' }, text: 'No flights logged yet.' }));
  } else {
    for (const leg of store.legs) {
      const active = app.route.name === 'journal' && app.route.param === leg.id;
      const route = [leg.dep_icao, leg.arr_icao].filter(Boolean).join(' → ') || 'Flight';
      const item = el('a', { href: `#/journal/${leg.id}`, class: 'leg-item' + (active ? ' active' : '') },
        el('div', { class: 'route', text: leg.title || route }),
        el('div', { class: 'meta' },
          el('span', { class: 'dot' + (leg.status === 'flown' ? '' : ' draft') }),
          el('span', { text: leg.flight_date || 'Draft' }),
          leg.title ? el('span', { text: route }) : null,
        ),
      );
      item.addEventListener('click', () => closeDrawer());
      legWrap.append(item);
    }
  }
  side.append(legWrap);

  return side;
}

function openAdventurePicker(app) {
  const body = el('div', {});
  const list = el('div', { class: 'trash-list' });
  if (store.adventures.length === 0) {
    list.append(el('p', { class: 'muted', text: 'No adventures yet. Create your first to begin logging flights.' }));
  }
  for (const a of store.adventures) {
    const pick = el('button', { class: 'btn btn-ghost', type: 'button', style: { flex: '1', justifyContent: 'flex-start' }, text: a.title });
    pick.addEventListener('click', async () => {
      setCurrent(a.id);
      await loadCurrent();
      handle.close();
      app.navigate('/journal');
      app.render();
    });
    const edit = el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Edit ${a.title}` });
    edit.append(icon('edit'));
    edit.addEventListener('click', () => { handle.close(); openAdventureForm({ adventure: a, onSaved: () => app.reloadAll() }); });
    const row = el('div', { class: 'trash-row' },
      a.id === store.currentId ? el('span', { class: 'pill flown', text: 'Current' }) : null,
      pick, el('div', { class: 'right' }, edit));
    list.append(row);
  }
  body.append(list);

  const create = el('button', { class: 'btn btn-primary', type: 'button' });
  create.append(icon('plus'), document.createTextNode(' New adventure'));
  create.addEventListener('click', () => {
    handle.close();
    openAdventureForm({ onSaved: async (adv) => { setCurrent(adv.id); await app.reloadAll(); app.navigate('/journal'); } });
  });
  const close = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Close' });
  const handle = openDialog({ title: 'Adventures', body, actions: [close, create] });
  close.addEventListener('click', () => handle.close());
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
