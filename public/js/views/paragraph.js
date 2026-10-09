// Stage page: hero, leg tabs, four cards, route + timeline (Flown/Planned),
// planned flight plan, documents, flight moments, journal/quick/pilot notes.
// Planned and flown are kept separate everywhere; ghost states fill the gaps.

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { api } from '../api.js';
import {
  getParagraph, getChapter, chaptersOrdered, paragraphsForChapter,
  legsForParagraph, getLeg, getPhoto, momentsForLeg, documentsForLeg, isFlown,
} from '../state.js';
import { formatDuration } from '../lib/statistics.js';
import { alongTheWayEmpty } from '../lib/moments.js';
import { lazyImg } from '../lazy.js';
import { mediaUrl, photoTile, openPhotoDialog } from '../ui/photo.js';
import { openLegForm, openMomentForm } from '../ui/forms.js';
import { openAddDocument } from '../ui/docs.js';
import { openSimbriefImport } from '../ui/simbrief.js';
import { pickAndUpload } from '../ui/photo.js';
import { crumbs } from '../ui/stepper.js';
import { legSchematic, ghostTimeline, ghostBox, ghostPhaseBox } from '../ui/ghost.js';
import { emptyState, editButton, primaryButton, ghostButton, sectionHead } from './common.js';
import { confirmDialog, toast, openDialog } from '../ui/dialog.js';
import { navigate } from '../router.js';

const PHASES = ['pre-departure', 'departure', 'en-route', 'approach', 'arrival'];
const PHASE_LABEL = { 'pre-departure': 'Pre-departure', departure: 'Departure', 'en-route': 'En route', approach: 'Approach', arrival: 'Arrival' };

function fmtEte(min) {
  const m = Number(min);
  if (!Number.isFinite(m) || m <= 0) return '—';
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}
function pad2(n) { return String(n).padStart(2, '0'); }

export function renderParagraph(app) {
  const paragraph = getParagraph(app.route.param);
  if (!paragraph) return emptyState({ mark: 'book', title: 'Stage not found', message: 'It may have been moved to Trash.' });
  const chapter = getChapter(paragraph.chapter_id);
  const chapterIdx = chapter ? chaptersOrdered().findIndex((c) => c.id === chapter.id) : -1;
  const paraIdx = chapter ? paragraphsForChapter(chapter.id).findIndex((p) => p.id === paragraph.id) : 0;

  const legs = legsForParagraph(paragraph.id);
  const selId = (app.route.parts[2] === 'leg' && app.route.parts[3] && getLeg(app.route.parts[3])) ? app.route.parts[3] : (legs[0] && legs[0].id);
  const leg = getLeg(selId);

  const wrap = el('div', {});
  wrap.append(crumbs([
    chapter ? { label: chapter.title, to: `/chapter/${chapter.id}` } : null,
    { label: paragraph.title },
    leg ? { label: `Leg ${leg.number ?? ''}`.trim() } : null,
  ].filter(Boolean)));

  wrap.append(hero(paragraph, chapter, chapterIdx, paraIdx, legs, leg));
  wrap.append(legTabs(app, paragraph, legs, leg));

  if (!leg) {
    wrap.append(ghostBox({
      title: 'No legs yet',
      text: 'Legs are the flights of this stage. Add the first and the page below fills in — departure, route, documents and moments.',
      visual: ghostTimeline(),
    }));
    return wrap;
  }

  wrap.append(summaryCards(app, leg));
  wrap.append(routeTimeline(app, paragraph, legs, leg));
  wrap.append(plannedBox(app, leg));
  wrap.append(documentsSection(app, leg));
  wrap.append(momentsSection(app, leg));
  wrap.append(notesSection(app, leg));
  return wrap;
}

// --------------------------------------------------------------- hero

function hero(paragraph, chapter, chapterIdx, paraIdx, legs, leg) {
  const flown = legs.filter(isFlown);
  const nm = flown.reduce((s, l) => s + (Number(l.distance_nm) || 0), 0);
  const mins = flown.reduce((s, l) => s + (Number(l.duration_min) || 0), 0);
  const heroPhoto = getPhoto((leg && leg.hero_photo_id) || paragraph.hero_photo_id);

  const box = el('section', { class: 'phero' });
  if (heroPhoto) {
    const img = el('img', { class: 'phero-photo', alt: heroPhoto.alt || '', decoding: 'async' });
    img.src = mediaUrl(heroPhoto.web_key || heroPhoto.thumb_key);
    box.append(img);
  }
  box.append(el('img', { class: 'plane', src: '/brand/plane-top.png', alt: '' }));
  box.append(el('div', { class: 'shade' }));

  const first = legs[0];
  const last = legs[legs.length - 1];
  const route = first ? `${first.dep_name || first.dep_icao || '—'} → ${(last && (last.arr_name || last.arr_icao || last.dep_icao)) || '—'}` : '';
  const sub = [route, paragraph.summary].filter(Boolean).join(' · ');

  const chips = el('div', { class: 'chips' });
  if (nm > 0) chips.append(el('span', { class: 'chip', text: `${Math.round(nm)} NM` }));
  if (mins > 0) chips.append(el('span', { class: 'chip', text: formatDuration(mins) }));
  chips.append(el('span', { class: 'chip', text: `${flown.length} of ${legs.length} legs flown` }));
  const firstFlown = flown[0] || leg;
  if (firstFlown && firstFlown.rules) chips.append(el('span', { class: 'chip', text: [firstFlown.rules, firstFlown.light].filter(Boolean).join(' · ') }));
  if (firstFlown && firstFlown.aircraft_type) chips.append(el('span', { class: 'chip', text: firstFlown.aircraft_type }));

  box.append(el('div', { class: 'phero-body' },
    el('span', { class: 'eyebrow-pill', text: `${chapter ? chapter.title + ' · ' : ''}Stage ${pad2(paraIdx + 1)}` }),
    el('h1', { text: paragraph.title }),
    sub ? el('div', { class: 'sub', text: sub }) : null,
    chips,
  ));
  return box;
}

// --------------------------------------------------------------- leg tabs

function legTabs(app, paragraph, legs, selected) {
  const section = el('section', { class: 'section' });
  section.append(sectionHead('Legs in this stage', [
    el('span', { class: 'hint muted', text: 'Tap a leg. Everything below switches to it.' }),
    primaryButton(' Add leg', 'plus', () => openLegForm({ section: 'new', paragraphId: paragraph.id, nextNumber: legs.length + 1, onSaved: (l) => { navigate(`/paragraph/${paragraph.id}/leg/${l.id}`); return app.refresh(); } })),
  ]));
  const tabs = el('div', { class: 'leg-tabs' });
  for (const l of legs) {
    const active = selected && l.id === selected.id;
    const planned = l.status !== 'flown';
    const tab = el('button', { class: 'leg-tab' + (active ? ' active' : '') + (planned ? ' planned' : ''), type: 'button' },
      el('div', { class: 'lt-top', text: `Leg ${pad2(l.number ?? 0)} · ${l.status === 'flown' ? '✓' : 'Planned'}` }),
      el('div', { class: 'lt-route', text: `${l.dep_icao || '—'} → ${l.arr_icao || '—'}${l.distance_nm ? ' · ' + Math.round(l.distance_nm) + ' NM' : ''}` }),
    );
    tab.addEventListener('click', () => navigate(`/paragraph/${paragraph.id}/leg/${l.id}`));
    tabs.append(tab);
  }
  section.append(tabs);
  return section;
}

// --------------------------------------------------------------- summary cards

function cardPhoto(leg, phaseList) {
  const m = momentsForLeg(leg.id).find((x) => phaseList.includes(x.phase) && getPhoto(x.photo_id));
  const photo = m && getPhoto(m.photo_id);
  const slot = el('div', { class: 'pc-photo' });
  if (photo && photo.thumb_key) {
    const img = lazyImg(mediaUrl(photo.thumb_key), { alt: '' });
    slot.append(img);
    slot.style.cursor = 'pointer';
    slot.addEventListener('click', () => openPhotoDialog(photo, { moment: m }));
  } else {
    slot.append(el('span', { class: 'pc-ghost', text: leg.status === 'flown' ? 'No photo' : 'No photo yet' }));
  }
  return slot;
}

function fieldRows(rows) {
  const box = el('div', { class: 'pc-fields' });
  for (const [k, v] of rows) box.append(el('div', { class: 'row' }, el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v || '—' })));
  return box;
}

function summaryCards(app, leg) {
  const flownDate = leg.status === 'flown' && leg.flight_date ? leg.flight_date : 'Planned';
  const grid = el('section', { class: 'section pcards' });

  // Departure
  const dep = el('div', { class: 'pcard' },
    el('div', { class: 'pc-head' }, el('div', { class: 'eyebrow', text: 'Departure' }), el('div', { class: 'pc-no', text: '01' })),
    cardPhoto(leg, ['pre-departure', 'departure']),
    el('div', { class: 'pc-title', text: leg.dep_name ? `${leg.dep_name} · ${leg.dep_icao}` : (leg.dep_icao || '—') }),
    fieldRows([['Date', flownDate]]),
    editButton(() => openLegForm({ leg, section: 'departure', onSaved: () => app.refresh() })),
  );

  // Arrival
  const arrTitle = leg.diverted_to_icao ? `Diverted · ${leg.diverted_to_icao}` : (leg.arr_name ? `${leg.arr_name} · ${leg.arr_icao}` : (leg.arr_icao || '—'));
  const arr = el('div', { class: 'pcard' },
    el('div', { class: 'pc-head' }, el('div', { class: 'eyebrow', text: 'Arrival' }), el('div', { class: 'pc-no', text: '02' })),
    cardPhoto(leg, ['approach', 'arrival']),
    el('div', { class: 'pc-title', text: arrTitle }),
    fieldRows([['Date', flownDate]]),
    editButton(() => openLegForm({ leg, section: 'arrival', onSaved: () => app.refresh() })),
  );

  // Aircraft
  const aircraftBox = el('div', { class: 'pc-photo', style: { background: 'var(--navy)' } }, icon('plane', 'ic'));
  aircraftBox.querySelector('.ic').style.color = 'var(--cream)';
  aircraftBox.querySelector('.ic').style.width = '46px';
  aircraftBox.querySelector('.ic').style.height = '46px';
  const air = el('div', { class: 'pcard' },
    el('div', { class: 'pc-head' }, el('div', { class: 'eyebrow', text: 'Aircraft' }), el('div', { class: 'pc-no', text: '03' })),
    aircraftBox,
    el('div', { class: 'pc-title', text: leg.aircraft_type || '—' }),
    fieldRows([['Tail', leg.registration], ['Callsign', leg.callsign], ['Hours this leg', leg.duration_min ? formatDuration(leg.duration_min) + (leg.status === 'flown' ? '' : ' est.') : '—']]),
    editButton(() => openLegForm({ leg, section: 'aircraft', onSaved: () => app.refresh() })),
  );

  // Conditions
  const cond = el('div', { class: 'pcard' },
    el('div', { class: 'pc-head' }, el('div', { class: 'eyebrow', text: 'Conditions' }), el('div', { class: 'pc-no', text: '04' })),
    el('div', { class: 'pc-big', style: { marginTop: '8px' }, text: [leg.rules, leg.light].filter(Boolean).join(' · ') || (leg.status === 'flown' ? '—' : 'Forecast only') }),
    fieldRows([['Distance', leg.distance_nm ? `${Math.round(leg.distance_nm)} NM` : '—'], ['Rules', leg.rules || '—'], ['Light', leg.light || '—']]),
    editButton(() => openLegForm({ leg, section: 'conditions', onSaved: () => app.refresh() })),
  );

  grid.append(dep, arr, air, cond);
  return grid;
}

// --------------------------------------------------------------- route + timeline

function routeTimeline(app, paragraph, legs, leg) {
  const section = el('section', { class: 'section' });
  const state = { mode: leg.status === 'flown' ? 'flown' : 'planned' };
  const left = el('div', { class: 'card' });
  const right = el('div', { class: 'card' });
  const box = el('div', { class: 'routebox' }, left, right);

  const toggle = el('div', { class: 'fp-toggle' });
  const mk = (m, label) => {
    const b = el('button', { type: 'button', 'aria-pressed': String(state.mode === m), text: label });
    b.addEventListener('click', () => { state.mode = m; [...toggle.children].forEach((c) => c.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); renderRight(); });
    return b;
  };
  toggle.append(mk('flown', 'Flown'), mk('planned', 'Planned'));

  left.append(el('div', { class: 'section-head' },
    el('div', {}, el('div', { class: 'eyebrow', text: 'Route · timeline' }), el('h2', { text: 'The way we went' })),
    toggle));
  const schem = el('div', { class: 'schematic' });
  schem.append(el('span', { class: 'scn-note', text: 'Schematic · not for navigation' }));
  const svg = legSchematic(legs, { highlightLegId: leg.id });
  schem.append(svg || ghostTimeline());
  left.append(schem);
  left.append(el('div', { class: 'legend' },
    el('span', {}, el('span', { class: 'ln' }), 'Flown'),
    el('span', {}, el('span', { class: 'ln plan' }), 'Planned'),
    el('span', { text: `Highlighted: Leg ${leg.number ?? ''}`.trim() }),
  ));

  function renderRight() {
    right.replaceChildren();
    right.append(el('div', { class: 'eyebrow', text: `Along the way · Leg ${pad2(leg.number ?? 0)}` }));
    const moments = momentsForLeg(leg.id);
    const timed = moments.filter((m) => m.time_text || m.title);
    if (state.mode === 'flown' && leg.status === 'flown' && timed.length) {
      const ul = el('ul', { class: 'along' });
      for (const m of timed) {
        ul.append(el('li', {},
          el('div', { class: 'tm', text: m.time_text || '' }),
          el('div', {}, el('div', { class: 'tt', text: m.title || PHASE_LABEL[m.phase] || 'Moment' }), m.note ? el('div', { class: 'tn', text: m.note }) : null),
        ));
      }
      right.append(ul);
    } else {
      const copy = alongTheWayEmpty(leg, timed.length > 0);
      right.append(ghostBox({ title: copy.title, text: copy.text, visual: ghostTimeline() }));
    }
  }
  renderRight();
  section.append(box);
  return section;
}

// --------------------------------------------------------------- planned flight plan

function plannedBox(app, leg) {
  const has = leg.planned_route || leg.planned_cruise_alt || leg.planned_block_fuel || leg.planned_ete_min || leg.planned_tas_kt || leg.planned_alternate_icao || leg.planned_reserve_min;
  const section = el('section', { class: 'section' });
  const box = el('div', { class: 'planbox' });

  const actions = el('div', { class: 'chiprow' },
    ghostButton(' Import latest OFP', 'download', () => openSimbriefImport(leg, () => app.refresh())),
    editButton(() => openLegForm({ leg, section: 'planned', onSaved: () => app.refresh() }), 'Edit plan'),
  );

  box.append(el('div', { class: 'pb-head' },
    el('div', {},
      el('div', { class: 'eyebrow', text: `Planned flight plan · Leg ${pad2(leg.number ?? 0)}` }),
      el('h3', { text: has ? 'SimBrief / Navigraph route' : (leg.status === 'flown' ? 'Flight plan used' : 'No flight plan yet') }),
    ),
    leg.simbrief_ofp_ref ? el('span', { class: 'from-pill', text: 'From OFP · pre-flight' }) : null,
  ));

  if (has) {
    if (leg.planned_route) box.append(el('div', { class: 'routebar', text: leg.planned_route }));
    box.append(el('div', { class: 'plan-fields' },
      pf(leg.planned_cruise_alt, 'Cruise'),
      pf(leg.planned_block_fuel, 'Block fuel'),
      pf(fmtEte(leg.planned_ete_min), 'ETE'),
      pf(leg.planned_tas_kt ? `${leg.planned_tas_kt} kt` : '', 'TAS'),
      pf(leg.planned_alternate_icao, 'Alternate'),
      pf(leg.planned_reserve_min ? `${leg.planned_reserve_min} min` : '', 'Reserve'),
    ));
  } else if (leg.status === 'flown') {
    box.append(el('p', { class: 'muted', text: 'Flown. The plan used is kept in Documents below, so the page shows what actually happened.' }));
  } else {
    box.append(el('p', { class: 'muted', text: 'Import your SimBrief OFP, or enter the plan by hand. It stays separate from what you fly.' }));
  }
  box.append(el('div', { style: { marginTop: '14px' } }, actions));
  section.append(box);
  return section;
}
function pf(value, label) {
  return el('div', { class: 'pf' }, el('div', { class: 'v', text: value || '—' }), el('div', { class: 'l', text: label }));
}

// --------------------------------------------------------------- documents

function fmtSize(bytes) {
  const b = Number(bytes) || 0;
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} KB`;
  return `${b} B`;
}

function documentsSection(app, leg) {
  const section = el('section', { class: 'section' });
  section.append(sectionHead('Documents · OFP and Navigraph charts', [el('span', { class: 'hint muted', text: 'Kept with the leg as the real record.' })]));
  const docs = documentsForLeg(leg.id);
  const grid = el('div', { class: 'docs' });

  for (const d of docs) {
    const ico = el('span', { class: `doc-ico ${d.kind}`, text: d.kind === 'navigraph' ? 'NAV' : d.kind === 'ofp' ? 'OFP' : 'PDF' });
    const open = el('a', { class: 'd-open', href: mediaUrl(d.r2_key), target: '_blank', rel: 'noopener', style: { display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', flex: '1', minWidth: '0' } },
      ico,
      el('div', { style: { minWidth: '0' } },
        el('div', { class: 'd-name', text: d.filename || 'Document' }),
        el('div', { class: 'd-meta', text: `${d.kind.toUpperCase()} · ${fmtSize(d.size_bytes)}` })));
    const del = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Delete document', style: { flex: 'none' } });
    del.append(icon('trash'));
    del.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Delete document', message: `Move “${d.filename || 'document'}” to Trash?`, confirmLabel: 'Move to Trash', danger: true });
      if (!ok) return;
      await api.documents.remove(d.id);
      toast('Document moved to Trash');
      await app.refresh();
    });
    grid.append(el('div', { class: 'doc-card' }, open, el('div', { class: 'd-actions' }, del)));
  }

  const add = el('button', { class: 'doc-add', type: 'button', text: '+ Add OFP or chart PDF' });
  add.addEventListener('click', () => openAddDocument(leg.id, () => app.refresh()));
  grid.append(add);
  section.append(grid);
  return section;
}

// --------------------------------------------------------------- moments

function momentsSection(app, leg) {
  const section = el('section', { class: 'section' });
  const all = momentsForLeg(leg.id);
  const state = { phase: 'all' };
  const photoOpts = [...app.photoOptions()];

  section.append(sectionHead('Collected along the way · Flight moments', [
    ghostButton(' Add moment', 'plus', () => openMomentForm({ legId: leg.id, phase: state.phase !== 'all' ? state.phase : 'en-route', photoOptions: photoOpts, onSaved: () => app.refresh() })),
    primaryButton(' Add photo', 'camera', async () => {
      const phase = state.phase !== 'all' ? state.phase : 'en-route';
      const photo = await pickAndUpload();
      if (photo) openMomentForm({ legId: leg.id, phase, moment: { photo_id: photo.id, phase }, photoOptions: photoOpts.concat({ value: photo.id, label: photo.original_filename || 'New photo' }), onSaved: () => app.refresh() });
    }),
  ]));

  const filter = el('div', { class: 'phase-filter', role: 'group', 'aria-label': 'Filter by phase' });
  const host = el('div', {});
  const counts = { all: all.length };
  for (const p of PHASES) counts[p] = all.filter((m) => m.phase === p).length;
  const mkBtn = (key, label) => {
    const b = el('button', { class: 'phase-btn', type: 'button', 'aria-pressed': String(state.phase === key) },
      el('span', { text: label }), el('span', { class: 'count', text: String(counts[key]) }));
    b.addEventListener('click', () => { state.phase = key; [...filter.children].forEach((c) => c.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); render(); });
    return b;
  };
  filter.append(mkBtn('all', 'All'));
  for (const p of PHASES) filter.append(mkBtn(p, PHASE_LABEL[p]));

  function phaseColumn(phase) {
    const ms = all.filter((m) => m.phase === phase);
    const withPhoto = ms.filter((m) => getPhoto(m.photo_id));
    const col = el('div', { class: 'phase-col' });
    if (withPhoto.length) {
      const first = withPhoto[0];
      const photo = getPhoto(first.photo_id);
      const heroPh = el('div', { class: 'hero-ph' },
        lazyImg(mediaUrl(photo.thumb_key), { alt: photo.alt || '' }),
        el('span', { class: 'phase-label', text: PHASE_LABEL[phase] }));
      heroPh.addEventListener('click', () => openMomentDetail(app, first));
      col.append(heroPh);
      const strip = el('div', { class: 'strip' });
      for (const m of withPhoto.slice(1, 4)) {
        const ph = getPhoto(m.photo_id);
        const th = el('div', { class: 'th' }, lazyImg(mediaUrl(ph.thumb_key), { alt: '' }));
        th.addEventListener('click', () => openMomentDetail(app, m));
        strip.append(th);
      }
      if (strip.children.length) col.append(strip);
      col.append(el('div', { class: 'm-title', text: first.title || PHASE_LABEL[phase] }));
      if (first.note || first.caption) col.append(el('div', { class: 'm-note', text: first.note || first.caption }));
    } else {
      const ghost = ghostPhaseBox(PHASE_LABEL[phase], ms.length ? `${ms.length} note${ms.length === 1 ? '' : 's'}` : 'No photos yet');
      ghost.style.cursor = 'pointer';
      ghost.addEventListener('click', () => (ms.length ? openMomentDetail(app, ms[0]) : openMomentForm({ legId: leg.id, phase, photoOptions: photoOpts, onSaved: () => app.refresh() })));
      col.append(ghost);
    }
    return col;
  }

  function render() {
    host.replaceChildren();
    if (state.phase === 'all') {
      const cols = el('div', { class: 'phase-cols' });
      for (const p of PHASES) cols.append(phaseColumn(p));
      host.append(cols);
    } else {
      const ms = all.filter((m) => m.phase === state.phase);
      if (!ms.length) {
        host.append(ghostBox({ title: `Nothing from ${PHASE_LABEL[state.phase].toLowerCase()} yet`, text: 'Add a photo or a note to capture this part of the flight.', visual: ghostPhaseBox(PHASE_LABEL[state.phase]) }));
        return;
      }
      const grid = el('div', { class: 'photo-grid' });
      for (const m of ms) {
        const photo = getPhoto(m.photo_id);
        if (photo) grid.append(photoTile(photo, { moment: m, onClick: () => openMomentDetail(app, m) }));
        else {
          const t = el('button', { class: 'photo-tile', type: 'button', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' } },
            el('div', {}, el('div', { class: 'eyebrow', text: PHASE_LABEL[m.phase] }), el('div', { style: { fontWeight: '700', color: 'var(--navy)', marginTop: '4px' }, text: m.title || 'Note' })));
          t.addEventListener('click', () => openMomentDetail(app, m));
          grid.append(t);
        }
      }
      host.append(grid);
    }
  }

  section.append(filter, host);
  render();
  return section;
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
  if (photo) actions.push(ghostButton(' View original', 'download', () => window.open(mediaUrl(photo.original_key), '_blank', 'noopener')));
  const del = el('button', { class: 'btn btn-danger', type: 'button' });
  del.append(icon('trash'), document.createTextNode(' Delete'));
  del.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Delete moment', message: 'Move this moment to Trash? You can restore it later.', confirmLabel: 'Move to Trash', danger: true });
    if (!ok) return;
    await api.moments.remove(moment.id);
    toast('Moment moved to Trash');
    handle.close();
    await app.refresh();
  });
  const edit = ghostButton(' Edit', 'edit', () => { handle.close(); openMomentForm({ moment, legId: moment.leg_id, photoOptions: app.photoOptions(), onSaved: () => app.refresh() }); });
  const close = el('button', { class: 'btn btn-primary', type: 'button', text: 'Close' });
  actions.push(del, edit, close);
  const handle = openDialog({ title: 'Moment', body, wide: !!photo, actions });
  close.addEventListener('click', () => handle.close());
}

// --------------------------------------------------------------- journal / notes

function notesSection(app, leg) {
  const section = el('section', { class: 'section two-col' });

  const journal = el('div', { class: 'card' });
  journal.append(el('div', { class: 'section-head' },
    el('div', {}, el('div', { class: 'eyebrow', text: 'Between departure & arrival' }), el('h2', { text: 'Journal' })),
    editButton(() => openLegForm({ leg, section: 'journal', onSaved: () => app.refresh() }))));
  if (leg.journal) journal.append(el('div', { class: 'journal-text', text: leg.journal }));
  else journal.append(ghostBox({ title: leg.status === 'flown' ? 'Tell the story of this flight.' : 'A blank page until the flight is done.', text: '' }));

  const right = el('div', {});
  const quick = el('div', { class: 'card', style: { marginBottom: '18px' } });
  quick.append(el('div', { class: 'section-head' },
    el('div', {}, el('div', { class: 'eyebrow', text: 'Notes from the cockpit' }), el('h2', { text: 'Quick notes' })),
    editButton(() => openLegForm({ leg, section: 'quicknotes', onSaved: () => app.refresh() }))));
  const qn = leg.quick_notes || [];
  if (qn.length) {
    const ul = el('ul', { class: 'notes-list' });
    for (const n of qn) ul.append(el('li', {}, icon('check', 'tick'), el('span', { text: n })));
    quick.append(ul);
  } else quick.append(el('p', { class: 'muted', text: 'None yet.' }));

  const pilot = el('div', { class: 'card' });
  pilot.append(el('div', { class: 'section-head' },
    el('div', {}, el('div', { class: 'eyebrow', text: 'A little better each flight' }), el('h2', { text: 'Pilot notes' })),
    editButton(() => openLegForm({ leg, section: 'pilotnotes', onSaved: () => app.refresh() }))));
  const pn = leg.pilot_notes || [];
  if (pn.length) {
    const list = el('div', {});
    for (const n of pn) {
      const positive = n.kind !== 'practice';
      list.append(el('div', { class: `pilot-row ${positive ? 'positive' : 'practice'}` },
        icon(positive ? 'check' : 'warn', 'pr-ic'), el('span', { text: n.text })));
    }
    pilot.append(list);
  } else pilot.append(el('p', { class: 'muted', text: 'None yet.' }));

  right.append(quick, pilot);
  section.append(journal, right);
  return section;
}
