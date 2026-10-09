// Journey home: cover with the journey's shape, then the destinations in flying order.

import { el } from '../dom.js';
import { store, chaptersOrdered, legsForChapter, flownProgress, isFlown } from '../state.js';
import { formatDuration } from '../lib/statistics.js';
import { openChapterForm } from '../ui/forms.js';
import { crumbs } from '../ui/stepper.js';
import { legSchematic, ghostSchematic, ghostBox } from '../ui/ghost.js';
import { pageHead, emptyState, primaryButton } from './common.js';
import { navigate } from '../router.js';

const STATUS = {
  planned: { cls: 'st-planned', label: 'Planned' },
  'in-progress': { cls: 'st-progress', label: 'In progress' },
  complete: { cls: 'st-complete', label: '✓ Flown' },
};

export function statusPill(status) {
  const s = STATUS[status] || STATUS.planned;
  return el('span', { class: `status-pill ${s.cls}`, text: s.label });
}

function allLegsInFlyingOrder() {
  const out = [];
  for (const ch of chaptersOrdered()) out.push(...legsForChapter(ch.id));
  return out;
}

export function renderBook(app) {
  const wrap = el('div', {});
  wrap.append(crumbs([]));

  const chapters = chaptersOrdered();
  const allLegs = allLegsInFlyingOrder();
  const flown = allLegs.filter(isFlown);
  const airMin = flown.reduce((s, l) => s + (Number(l.duration_min) || 0), 0);

  // Cover / hero
  const hero = el('section', { class: 'book-hero' });
  const left = el('div', {},
    el('div', { class: 'eyebrow', text: 'The journey · opens here' }),
    el('div', { class: 'lede', text: 'Every flight has a story. The destinations give it a reason — the flights write it. This is the whole journey, in flying order.' }),
  );
  const stats = el('div', { class: 'book-stats' });
  stats.append(bookStat(chapters.length, 'Destinations'));
  stats.append(bookStat(`${flown.length} / ${allLegs.length}`, 'Legs flown'));
  stats.append(bookStat(formatDuration(airMin), 'In the air'));
  left.append(stats);
  const schem = el('div', { class: 'book-schematic' });
  schem.append(allLegs.length ? legSchematic(allLegs, { onNavy: true }) || ghostSchematic(true) : ghostSchematic(true));
  hero.append(left, schem);
  wrap.append(hero);

  // Table of contents
  const toc = el('div', { class: 'toc-head' },
    el('div', {},
      el('div', { class: 'eyebrow', text: 'Table of contents · in flying order' }),
      el('h2', { text: 'Destinations' }),
    ),
    el('div', { class: 'chiprow' },
      el('span', { class: 'hint', text: 'Career tags are optional labels, not the order.' }),
      primaryButton(' New destination', 'plus', () => openChapterForm({ nextOrder: chapters.length, onSaved: () => app.refresh() })),
    ),
  );
  wrap.append(toc);

  if (!chapters.length) {
    wrap.append(ghostBox({
      title: 'No destinations yet',
      text: 'A destination is a big part of the journey. Add your first to begin — the table of contents fills in flying order.',
      visual: ghostSchematic(false),
    }));
    return wrap;
  }

  const grid = el('div', { class: 'chapter-grid' });
  chapters.forEach((ch, i) => grid.append(chapterCard(app, ch, i)));
  wrap.append(grid);
  return wrap;
}

function bookStat(n, l) {
  return el('div', { class: 'book-stat' }, el('div', { class: 'n', text: String(n) }), el('div', { class: 'l', text: l }));
}

function chapterCard(app, ch, index) {
  const legs = legsForChapter(ch.id);
  const prog = flownProgress(legs);
  const nm = legs.filter(isFlown).reduce((s, l) => s + (Number(l.distance_nm) || 0), 0);

  const card = el('button', { class: 'chapter-card', type: 'button' });
  card.append(el('div', { class: 'top' },
    el('div', { class: 'num', text: String(index + 1).padStart(2, '0') }),
    statusPill(ch.status),
  ));
  if (ch.subtitle) card.append(el('div', { class: 'eyebrow', text: ch.subtitle }));
  card.append(el('h3', { text: ch.title }));
  const bar = el('div', { class: 'progress' + (ch.status === 'in-progress' ? ' amber' : '') },
    el('span', { style: { width: `${Math.round(prog.ratio * 100)}%` } }));
  card.append(bar);
  const count = `${prog.flown} of ${prog.total} ${prog.total === 1 ? 'leg' : 'legs'}` + (nm > 0 ? ` · ${Math.round(nm)} NM` : '');
  card.append(el('div', { class: 'legs-count', text: count }));
  if (ch.career_tag) card.append(el('div', { class: 'foot' }, el('span', { class: 'career-chip', text: ch.career_tag })));
  card.addEventListener('click', () => navigate(`/chapter/${ch.id}`));
  return card;
}
