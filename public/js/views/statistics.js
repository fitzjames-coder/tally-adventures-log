// Statistics: computed from flown legs across the whole journey. Planned legs and
// anything not yet flown never count. No landing counts anywhere.

import { el } from '../dom.js';
import { store } from '../state.js';
import { computeStatistics } from '../lib/statistics.js';
import { pageHead, sectionHead } from './common.js';
import { ghostBox } from '../ui/ghost.js';

export function renderStatistics() {
  const stats = computeStatistics(store.legs, store.moments);

  const wrap = el('div', {});
  wrap.append(pageHead('Statistics', 'Flown flights across the journey'));

  if (stats.flightsFlown === 0) {
    wrap.append(ghostBox({
      title: 'No flown flights yet',
      text: 'Mark a leg as flown and its numbers appear here. Planned legs never count.',
    }));
    return wrap;
  }

  const tiles = el('div', { class: 'stat-grid' });
  tiles.append(statTile(stats.flightsFlown, 'Flights flown'));
  tiles.append(statTile(stats.timeInAirText, 'Time in the air'));
  tiles.append(statTile(`${stats.distanceNm}`, 'Nautical miles'));
  tiles.append(statTile(stats.momentsCount, 'Moments'));
  wrap.append(tiles);

  wrap.append(splitSection('Rules', stats.rules, { VFR: 'var(--navy)', IFR: 'var(--amber)', unspecified: 'var(--line)' }, stats.flightsFlown));
  wrap.append(splitSection('Day / Night', stats.light, { Day: 'var(--amber)', Night: 'var(--navy)', unspecified: 'var(--line)' }, stats.flightsFlown));

  const aircraft = el('section', { class: 'section' });
  aircraft.append(sectionHead('Aircraft used'));
  if (stats.aircraft.length) {
    const max = Math.max(...stats.aircraft.map((a) => a.count));
    const list = el('div', { class: 'bar-list' });
    for (const a of stats.aircraft) {
      const row = el('div', { class: 'bar-row' },
        el('span', { class: 'bar-label', text: a.type }),
        el('span', { class: 'muted', text: `${a.count} ${a.count === 1 ? 'flight' : 'flights'} · ${a.distanceNm} NM` }));
      const track = el('div', { class: 'bar-track' }, el('span', { style: { width: `${Math.round((a.count / max) * 100)}%` } }));
      list.append(el('div', {}, row, track));
    }
    aircraft.append(list);
  } else {
    aircraft.append(el('p', { class: 'muted', text: 'No aircraft recorded on flown flights yet.' }));
  }
  wrap.append(aircraft);
  return wrap;
}

function statTile(value, label) {
  return el('div', { class: 'stat-tile' }, el('div', { class: 'n', text: String(value) }), el('div', { class: 'l', text: label }));
}

function splitSection(title, counts, colors, total) {
  const section = el('section', { class: 'section' });
  section.append(sectionHead(title));
  const bar = el('div', { class: 'splitbar' });
  const legend = el('div', { class: 'legendrow' });
  for (const [key, n] of Object.entries(counts)) {
    if (!n) continue;
    const pct = Math.round((n / total) * 100);
    bar.append(el('span', { style: { width: `${pct}%`, background: colors[key] || 'var(--line)' } }));
    legend.append(el('span', { class: 'k' }, el('span', { class: 'sw', style: { background: colors[key] || 'var(--line)' } }), el('span', { text: `${key === 'unspecified' ? 'Not recorded' : key} · ${n}` })));
  }
  section.append(el('div', { class: 'card' }, bar, legend));
  return section;
}
