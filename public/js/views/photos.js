// Photos: every moment photo across the current adventure, with phase filters.

import { el } from '../dom.js';
import { store, currentAdventure, getPhoto, getLeg } from '../state.js';
import { photoTile, openPhotoDialog } from '../ui/photo.js';
import { pageHead, emptyState } from './common.js';

const PHASES = ['pre-departure', 'departure', 'en-route', 'approach', 'arrival'];
const PHASE_LABEL = {
  'pre-departure': 'Pre-departure',
  departure: 'Departure',
  'en-route': 'En route',
  approach: 'Approach',
  arrival: 'Arrival',
};

export function renderPhotos(app) {
  const adv = currentAdventure();
  if (!adv) return emptyState({ mark: 'photos', title: 'No adventure selected', message: 'Create an adventure to collect its photos.' });

  const withPhotos = store.moments.filter((m) => m.photo_id && getPhoto(m.photo_id));

  const wrap = el('div', {});
  wrap.append(pageHead('Photos', `Every moment captured across “${adv.title}”`));

  if (!withPhotos.length) {
    wrap.append(emptyState({ mark: 'camera', title: 'No photos yet', message: 'Add a photo to a flight moment and it will appear here.' }));
    return wrap;
  }

  const state = { phase: 'all' };
  const counts = { all: withPhotos.length };
  for (const p of PHASES) counts[p] = withPhotos.filter((m) => m.phase === p).length;

  const filterRow = el('div', { class: 'phase-filter', role: 'group', 'aria-label': 'Filter by phase' });
  const gridHost = el('div', {});

  const makeBtn = (key, label) => {
    const b = el('button', { class: 'phase-btn', type: 'button', 'aria-pressed': String(state.phase === key) },
      el('span', { text: label }), el('span', { class: 'count', text: String(counts[key]) }));
    b.addEventListener('click', () => {
      state.phase = key;
      [...filterRow.children].forEach((c) => c.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      renderGrid();
    });
    return b;
  };
  filterRow.append(makeBtn('all', 'All'));
  for (const p of PHASES) filterRow.append(makeBtn(p, PHASE_LABEL[p]));

  function renderGrid() {
    const list = state.phase === 'all' ? withPhotos : withPhotos.filter((m) => m.phase === state.phase);
    gridHost.replaceChildren();
    if (!list.length) {
      gridHost.append(emptyState({ mark: 'camera', small: true, title: `Nothing from ${PHASE_LABEL[state.phase].toLowerCase()} yet`, message: 'Photos tagged to this phase will show here.' }));
      return;
    }
    const grid = el('div', { class: 'photo-grid' });
    for (const m of list) {
      const photo = getPhoto(m.photo_id);
      grid.append(photoTile(photo, { moment: m, onClick: () => openPhotoDialog(photo, { moment: m, onChanged: () => app.refresh() }) }));
    }
    gridHost.append(grid);
  }

  wrap.append(filterRow, gridHost);
  renderGrid();
  return wrap;
}
