// Map: the adventure's planned and visited destinations, plus a placeholder for
// the real map (a later milestone). No route is drawn.

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { store, currentAdventure } from '../state.js';
import { api } from '../api.js';
import { openDestinationForm } from '../ui/forms.js';
import { confirmDialog, toast } from '../ui/dialog.js';
import { pageHead, sectionHead, editButton, emptyState, primaryButton } from './common.js';

const TIER_LABEL = { core: 'Core', significant: 'Significant', optional: 'Optional' };

export function renderMap(app) {
  const adv = currentAdventure();
  if (!adv) return emptyState({ mark: 'map', title: 'No adventure selected', message: 'Create an adventure to plan its destinations.' });

  const wrap = el('div', {});
  wrap.append(pageHead('Map', 'Planned story places for this adventure',
    [primaryButton(' Add destination', 'plus', () => openDestinationForm({ adventureId: adv.id, onSaved: () => app.refresh() }))]));

  const visited = store.destinations.filter((d) => d.status === 'visited');
  const planned = store.destinations.filter((d) => d.status !== 'visited');

  if (store.destinations.length === 0) {
    wrap.append(emptyState({ mark: 'compass', title: 'No destinations yet', message: 'Add the places this adventure is meant to visit. Destinations are story places — they never create flights.' }));
  } else {
    wrap.append(destinationGroup(app, 'Planned', planned, 'These are on the itinerary but not yet visited.'));
    wrap.append(destinationGroup(app, 'Visited', visited, 'Marked as reached on a flight.'));
  }

  const placeholder = el('div', { class: 'map-placeholder' });
  placeholder.append(icon('map', 'ic'));
  placeholder.append(el('div', { style: { fontWeight: '700', color: 'var(--navy)' }, text: 'The interactive map arrives in a later milestone.' }));
  placeholder.append(el('div', { text: 'For now, destinations live as the list above.' }));
  wrap.append(el('section', { class: 'section' }, placeholder));

  return wrap;
}

function destinationGroup(app, title, list, hint) {
  const section = el('section', { class: 'section' });
  section.append(sectionHead(`${title} (${list.length})`));
  if (!list.length) {
    section.append(el('p', { class: 'muted', text: hint }));
    return section;
  }
  const rows = el('div', { class: 'dest-list' });
  for (const d of list) rows.append(destRow(app, d));
  section.append(rows);
  return section;
}

function destRow(app, d) {
  const left = el('div', {},
    el('div', { class: 'name', text: d.name }),
    (d.country_code || d.description)
      ? el('div', { class: 'flag', text: [d.country_code, d.description].filter(Boolean).join(' · ') })
      : null,
  );
  const del = el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Delete ${d.name}` });
  del.append(icon('trash'));
  del.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Delete destination', message: `Move “${d.name}” to Trash? You can restore it later.`, confirmLabel: 'Move to Trash', danger: true });
    if (!ok) return;
    await api.destinations.remove(d.id);
    toast('Destination moved to Trash');
    await app.refresh();
  });
  return el('div', { class: 'dest-row' },
    left,
    el('div', { class: 'right' },
      el('span', { class: `pill tier-${d.tier}`, text: TIER_LABEL[d.tier] || d.tier }),
      el('span', { class: `pill ${d.status === 'visited' ? 'visited' : 'planned'}`, text: d.status === 'visited' ? 'Visited' : 'Planned' }),
      editButton(() => openDestinationForm({ destination: d, adventureId: d.adventure_id, onSaved: () => app.refresh() })),
      del,
    ),
  );
}
