// Journal: the per-flight story. Hero, summary cards, route + timeline, quick
// notes, flight moments with phase filters, journal text and pilot notes.

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { store, currentAdventure, getLeg, getPhoto, momentsForLeg } from '../state.js';
import { api } from '../api.js';
import { formatDuration } from '../lib/statistics.js';
import { openLegForm, openMomentForm, openAdventureForm } from '../ui/forms.js';
import { setCurrent } from '../state.js';
import { photoTile, mediaUrl, pickAndUpload, openPhotoDialog } from '../ui/photo.js';
import { openDialog, confirmDialog, toast } from '../ui/dialog.js';
import { pageHead, sectionHead, editButton, emptyState, primaryButton, ghostButton } from './common.js';

const PHASES = ['pre-departure', 'departure', 'en-route', 'approach', 'arrival'];
const PHASE_LABEL = {
  'pre-departure': 'Pre-departure',
  departure: 'Departure',
  'en-route': 'En route',
  approach: 'Approach',
  arrival: 'Arrival',
};

export function renderJournal(app) {
  const adv = currentAdventure();
  if (!adv) {
    return emptyState({
      mark: 'plane',
      title: 'Welcome to TALLY ADVENTURES Log',
      message: 'Create your first adventure, then log the flights that bring it to life.',
      actionLabel: 'New adventure',
      onAction: () => openAdventureForm({
        onSaved: async (created) => { setCurrent(created.id); await app.reloadAll(); app.navigate('/journal'); },
      }),
    });
  }

  if (store.legs.length === 0) {
    const box = emptyState({
      mark: 'plane',
      title: 'No flights logged yet',
      message: `“${adv.title}” is ready. Log your first flight to start the journal.`,
    });
    box.append(primaryButton(' New flight', 'plus', () => newFlight(app)));
    return box;
  }

  const legId = app.route.param && getLeg(app.route.param) ? app.route.param : store.legs[0].id;
  const leg = getLeg(legId);

  const wrap = el('div', {});
  wrap.append(pageHead(
    adv.title,
    adv.subtitle || null,
    [primaryButton(' New flight', 'plus', () => newFlight(app))],
  ));
  wrap.append(hero(app, leg));
  wrap.append(summaryCards(app, leg));
  wrap.append(routeAndNotes(app, leg));
  wrap.append(momentsSection(app, leg));
  wrap.append(journalAndPilot(app, leg));
  return wrap;
}

function newFlight(app) {
  const adv = currentAdventure();
  openLegForm({ section: 'new', adventureId: adv.id, onSaved: (leg) => { app.navigate(`/journal/${leg.id}`); return app.refresh(); } });
}

function heroOptions(leg) {
  return momentsForLeg(leg.id)
    .filter((m) => m.photo_id && getPhoto(m.photo_id))
    .map((m) => ({ value: m.photo_id, label: m.caption || m.title || getPhoto(m.photo_id)?.original_filename || 'Photo' }));
}

function hero(app, leg) {
  const heroPhoto = getPhoto(leg.hero_photo_id);
  const route = [leg.dep_icao, leg.arr_icao].filter(Boolean).join(' → ') || 'Flight';
  const box = el('section', { class: 'hero' });

  if (heroPhoto) {
    const img = el('img', { class: 'hero-photo', alt: heroPhoto.alt || '', decoding: 'async' });
    img.src = mediaUrl(heroPhoto.web_key || heroPhoto.thumb_key); // hero on screen -> web size
    box.append(img, el('div', { class: 'shade' }));
  }

  const meta = el('div', { class: 'hero-meta' });
  if (leg.flight_date) meta.append(el('span', { text: leg.flight_date }));
  meta.append(el('span', { class: 'chip navy', text: leg.status === 'flown' ? 'Flown' : 'Draft' }));
  if (leg.rules) meta.append(el('span', { class: 'chip', style: { background: 'var(--amber)', color: 'var(--navy)', borderColor: 'var(--amber)' }, text: leg.rules }));
  if (leg.light) meta.append(el('span', { class: 'chip', text: leg.light }));
  if (leg.distance_nm) meta.append(el('span', { text: `${leg.distance_nm} NM` }));
  if (leg.duration_min) meta.append(el('span', { text: formatDuration(leg.duration_min) }));

  const body = el('div', { class: 'hero-body' },
    el('div', { class: 'eyebrow', style: { color: 'var(--amber)' }, text: route }),
    el('h1', { text: leg.title || route }),
    meta,
  );
  box.append(body);

  const edit = editButton(() => openLegForm({ leg, section: 'summary', onSaved: () => app.refresh() }));
  edit.classList.add('hero-edit');
  const heroEdit = editButton(() => openLegForm({ leg, section: 'hero', heroOptions: heroOptions(leg), onSaved: () => app.refresh() }), heroPhoto ? 'Change hero' : 'Set hero');
  heroEdit.classList.add('hero-edit');
  heroEdit.style.right = '92px';
  box.append(edit, heroEdit);
  return box;
}

function summaryCard(eyebrow, lines, onEdit) {
  const card = el('div', { class: 'summary-card' });
  card.append(el('div', { class: 'eyebrow', text: eyebrow }));
  const real = lines.filter(Boolean);
  if (real.length) {
    card.append(el('div', { class: 'big', text: real[0] }));
    for (const line of real.slice(1)) card.append(el('div', { class: 'small', text: line }));
  } else {
    card.append(el('div', { class: 'small muted', text: 'Not recorded' }));
  }
  const e = editButton(onEdit);
  e.style.marginTop = '10px';
  card.append(e);
  return card;
}

function summaryCards(app, leg) {
  const grid = el('div', { class: 'summary-grid' });
  grid.append(summaryCard('Departure',
    [leg.dep_icao, leg.dep_name],
    () => openLegForm({ leg, section: 'departure', onSaved: () => app.refresh() })));
  grid.append(summaryCard('Arrival',
    leg.diverted_to_icao ? [`Diverted ${leg.diverted_to_icao}`, leg.diversion_note] : [leg.arr_icao, leg.arr_name],
    () => openLegForm({ leg, section: 'arrival', onSaved: () => app.refresh() })));
  grid.append(summaryCard('Aircraft',
    [leg.aircraft_type, [leg.registration, leg.callsign].filter(Boolean).join(' · ')],
    () => openLegForm({ leg, section: 'aircraft', onSaved: () => app.refresh() })));
  grid.append(summaryCard('Conditions',
    [[leg.rules, leg.light].filter(Boolean).join(' · '), leg.distance_nm ? `${leg.distance_nm} NM` : null],
    () => openLegForm({ leg, section: 'conditions', onSaved: () => app.refresh() })));
  return grid;
}

function routeAndNotes(app, leg) {
  const section = el('section', { class: 'section two-col' });

  // Route + timeline
  const routeCard = el('div', { class: 'card' });
  routeCard.append(sectionHead('Route', [editButton(() => openLegForm({ leg, section: 'route', onSaved: () => app.refresh() }))]));
  if (leg.route_text) routeCard.append(el('div', { class: 'journal-text', text: leg.route_text }));
  else routeCard.append(el('p', { class: 'muted', text: 'No route recorded yet.' }));

  const timeline = momentsForLeg(leg.id);
  if (timeline.length) {
    const ol = el('ul', { class: 'timeline' });
    for (const m of timeline) {
      ol.append(el('li', {},
        el('div', { class: 't-phase', text: PHASE_LABEL[m.phase] || m.phase }),
        el('div', { class: 't-title', text: m.title || m.caption || 'Moment' }),
        m.note ? el('div', { class: 't-note', text: m.note }) : null,
      ));
    }
    routeCard.append(el('div', { class: 'eyebrow', style: { marginTop: '16px' }, text: 'Timeline' }), ol);
  }
  section.append(routeCard);

  // Quick notes
  const notes = el('div', { class: 'card' });
  notes.append(sectionHead('Quick notes', [editButton(() => openLegForm({ leg, section: 'quicknotes', onSaved: () => app.refresh() }))]));
  const list = leg.quick_notes || [];
  if (list.length) {
    const ul = el('ul', { class: 'notes-list' });
    for (const n of list) ul.append(el('li', {}, icon('check', 'tick'), el('span', { text: n })));
    notes.append(ul);
  } else {
    notes.append(el('p', { class: 'muted', text: 'Jot the little things — a smooth touchdown, a tailwind, a view.' }));
  }
  section.append(notes);
  return section;
}

function momentsSection(app, leg) {
  const section = el('section', { class: 'section' });
  const state = { phase: 'all' };
  const all = momentsForLeg(leg.id);
  const counts = { all: all.length };
  for (const p of PHASES) counts[p] = all.filter((m) => m.phase === p).length;

  const photoOpts = [...store.photosById.values()].map((p) => ({ value: p.id, label: p.caption || p.original_filename || p.id.slice(0, 8) }));

  const addMoment = ghostButton(' Add moment', 'plus', () => {
    const phase = state.phase !== 'all' ? state.phase : 'en-route';
    openMomentForm({ legId: leg.id, phase, photoOptions: photoOpts, onSaved: () => app.refresh() });
  });
  const addPhoto = primaryButton(' Add photo', 'camera', async () => {
    const phase = state.phase !== 'all' ? state.phase : 'en-route';
    const photo = await pickAndUpload();
    if (photo) openMomentForm({ legId: leg.id, phase, photoOptions: photoOpts.concat({ value: photo.id, label: photo.original_filename || 'New photo' }), moment: { photo_id: photo.id, phase }, onSaved: () => app.refresh() });
  });

  section.append(sectionHead('Flight moments', [addMoment, addPhoto]));

  const filterRow = el('div', { class: 'phase-filter', role: 'group', 'aria-label': 'Filter by phase' });
  const gridHost = el('div', {});

  const phaseBtn = (key, label) => {
    const b = el('button', { class: 'phase-btn', type: 'button', 'aria-pressed': String(state.phase === key) },
      el('span', { text: label }), el('span', { class: 'count', text: String(counts[key]) }));
    b.addEventListener('click', () => { state.phase = key; renderGrid(); [...filterRow.children].forEach((c) => c.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); });
    return b;
  };
  filterRow.append(phaseBtn('all', 'All'));
  for (const p of PHASES) filterRow.append(phaseBtn(p, PHASE_LABEL[p]));

  function renderGrid() {
    const list = state.phase === 'all' ? all : all.filter((m) => m.phase === state.phase);
    gridHost.replaceChildren();
    if (!list.length) {
      gridHost.append(emptyState({
        mark: 'camera',
        small: true,
        title: state.phase === 'all' ? 'No moments yet' : `Nothing from ${PHASE_LABEL[state.phase].toLowerCase()} yet`,
        message: 'Add a photo or a note to capture this part of the flight.',
      }));
      return;
    }
    const grid = el('div', { class: 'photo-grid' });
    for (const m of list) grid.append(momentTile(app, m));
    gridHost.append(grid);
  }

  section.append(filterRow, gridHost);
  renderGrid();
  return section;
}

function momentTile(app, moment) {
  const photo = getPhoto(moment.photo_id);
  if (photo) {
    return photoTile(photo, { moment, onClick: () => openMomentDetail(app, moment) });
  }
  // Text-only moment: a small card tile.
  const tile = el('button', { class: 'photo-tile', type: 'button', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' } },
    el('div', {},
      el('div', { class: 'eyebrow', text: PHASE_LABEL[moment.phase] || moment.phase }),
      el('div', { style: { fontWeight: '700', color: 'var(--navy)', marginTop: '4px' }, text: moment.title || moment.caption || 'Note' }),
    ));
  tile.addEventListener('click', () => openMomentDetail(app, moment));
  return tile;
}

function openMomentDetail(app, moment) {
  const photo = getPhoto(moment.photo_id);
  const body = el('div', {});
  if (photo) {
    const img = el('img', { alt: photo.alt || '', decoding: 'async' });
    img.src = mediaUrl(photo.web_key || photo.thumb_key);
    body.append(el('div', { class: 'photo-view' }, img));
  }
  const meta = el('div', { class: 'photo-meta' });
  meta.append(el('div', { class: 'eyebrow', text: PHASE_LABEL[moment.phase] || moment.phase }));
  if (moment.title) meta.append(el('div', { class: 'cap', text: moment.title }));
  const line = [moment.time_text, moment.place_text].filter(Boolean).join(' · ');
  if (line) meta.append(el('div', { class: 'muted', text: line }));
  if (moment.caption) meta.append(el('div', { class: 'note', text: moment.caption }));
  if (moment.note) meta.append(el('div', { class: 'note', text: moment.note }));
  body.append(meta);

  const actions = [];
  if (photo) {
    const orig = ghostButton(' View original', 'download', () => window.open(mediaUrl(photo.original_key), '_blank', 'noopener'));
    actions.push(orig);
  }
  const del = el('button', { class: 'btn btn-danger', type: 'button' });
  del.append(icon('trash'), document.createTextNode(' Delete'));
  del.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Delete moment', message: 'This moves the moment to Trash. You can restore it later.', confirmLabel: 'Move to Trash', danger: true });
    if (!ok) return;
    await api.moments.remove(moment.id);
    toast('Moment moved to Trash');
    handle.close();
    await app.refresh();
  });
  const edit = ghostButton(' Edit', 'edit', () => {
    handle.close();
    const photoOpts = [...store.photosById.values()].map((p) => ({ value: p.id, label: p.caption || p.original_filename || p.id.slice(0, 8) }));
    openMomentForm({ moment, legId: moment.leg_id, photoOptions: photoOpts, onSaved: () => app.refresh() });
  });
  const close = el('button', { class: 'btn btn-primary', type: 'button', text: 'Close' });
  actions.push(del, edit, close);
  const handle = openDialog({ title: 'Moment', body, wide: !!photo, actions });
  close.addEventListener('click', () => handle.close());
}

function journalAndPilot(app, leg) {
  const section = el('section', { class: 'section two-col' });

  const journal = el('div', { class: 'card' });
  journal.append(sectionHead('Journal', [editButton(() => openLegForm({ leg, section: 'journal', onSaved: () => app.refresh() }))]));
  if (leg.journal) journal.append(el('div', { class: 'journal-text', text: leg.journal }));
  else journal.append(el('p', { class: 'muted', text: 'Tell the story of this flight.' }));
  section.append(journal);

  const pilot = el('div', { class: 'card' });
  pilot.append(sectionHead('Pilot notes', [editButton(() => openLegForm({ leg, section: 'pilotnotes', onSaved: () => app.refresh() }))]));
  const notes = leg.pilot_notes || [];
  if (notes.length) {
    const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
    for (const n of notes) {
      list.append(el('div', { class: `pilot-note ${n.kind === 'practice' ? 'practice' : 'positive'}` },
        el('div', {}, el('div', { class: 'k', text: n.kind === 'practice' ? 'To practise' : 'Went well' }), el('div', { text: n.text }))));
    }
    pilot.append(list);
  } else {
    pilot.append(el('p', { class: 'muted', text: 'Note what went well and what to practise next time.' }));
  }
  section.append(pilot);
  return section;
}
