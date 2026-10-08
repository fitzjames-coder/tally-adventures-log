// Map: a schematic of the whole journey (no real map tiles in this milestone),
// plus the chapters in flying order.

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { chaptersOrdered, legsForChapter, flownProgress } from '../state.js';
import { legSchematic, ghostSchematic, ghostBox } from '../ui/ghost.js';
import { pageHead } from './common.js';
import { statusPill } from './book.js';
import { navigate } from '../router.js';

export function renderMap() {
  const chapters = chaptersOrdered();
  const allLegs = [];
  for (const ch of chapters) allLegs.push(...legsForChapter(ch.id));

  const wrap = el('div', {});
  wrap.append(pageHead('Map', 'The journey as a schematic'));

  if (!allLegs.length) {
    wrap.append(ghostBox({
      title: 'No route to draw yet',
      text: 'As you add legs, the journey appears here as a schematic path. The interactive map arrives in a later milestone.',
      visual: ghostSchematic(false),
    }));
    return wrap;
  }

  const card = el('div', { class: 'card' });
  const schem = el('div', { class: 'schematic' });
  schem.append(el('span', { class: 'scn-note', text: 'Schematic · not for navigation' }));
  schem.append(legSchematic(allLegs) || ghostSchematic(false));
  card.append(schem);
  card.append(el('div', { class: 'legend' },
    el('span', {}, el('span', { class: 'ln' }), 'Flown'),
    el('span', {}, el('span', { class: 'ln plan' }), 'Planned')));
  wrap.append(card);

  wrap.append(el('div', { class: 'map-placeholder', style: { marginTop: '18px' } },
    icon('map', 'ic'),
    el('div', { style: { fontWeight: '700', color: 'var(--navy)' }, text: 'The interactive map arrives in a later milestone.' }),
    el('div', { text: 'For now, the chapters below carry the places.' })));

  const list = el('div', { class: 'dest-list', style: { marginTop: '18px' } });
  chapters.forEach((ch, i) => {
    const prog = flownProgress(legsForChapter(ch.id));
    const row = el('div', { class: 'dest-row' },
      el('div', {}, el('div', { class: 'name', text: `${String(i + 1).padStart(2, '0')} · ${ch.title}` }), ch.subtitle ? el('div', { class: 'flag', text: ch.subtitle }) : null),
      el('div', { class: 'right' }, el('span', { class: 'muted', text: `${prog.flown}/${prog.total} legs` }), statusPill(ch.status)));
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => navigate(`/chapter/${ch.id}`));
    list.append(row);
  });
  wrap.append(list);
  return wrap;
}
