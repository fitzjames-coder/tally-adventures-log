// Edit forms as in-page dialogs: keyboard accessible, Save and Cancel, nothing
// required beyond what the schema demands. All field widgets expose read().

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { api } from '../api.js';
import { openDialog } from './dialog.js';

let formSeq = 0;

// --------------------------------------------------------------- field widgets

function buildField(desc) {
  switch (desc.kind) {
    case 'select': return selectField(desc);
    case 'string-list': return stringListField(desc);
    case 'pilot-list': return pilotListField(desc);
    case 'textarea':
    case 'number':
    case 'date':
    case 'text':
    default: return inputField(desc);
  }
}

function labelFor(desc, id) {
  return el('label', { for: id }, desc.label, desc.required ? el('span', { class: 'req', text: ' *' }) : null);
}

function fieldWrap(desc, ...kids) {
  return el('div', { class: 'field' + (desc.full ? ' col-2' : '') }, ...kids);
}

function inputField(desc) {
  const id = `fld_${++formSeq}`;
  let input;
  if (desc.kind === 'textarea') {
    input = el('textarea', { id, name: desc.name, rows: desc.rows || 5, placeholder: desc.placeholder || '' });
  } else {
    const type = desc.kind === 'number' ? 'number' : desc.kind === 'date' ? 'date' : 'text';
    input = el('input', { id, name: desc.name, type, placeholder: desc.placeholder || '' });
    if (desc.kind === 'number' && desc.step) input.step = desc.step;
    if (desc.kind === 'number' && desc.min !== undefined) input.min = desc.min;
    if (desc.maxlength) input.maxLength = desc.maxlength;
  }
  if (desc.value !== undefined && desc.value !== null) input.value = desc.value;
  if (desc.required) input.required = true;
  const wrap = fieldWrap(desc, labelFor(desc, id), input, desc.hint ? el('span', { class: 'hint', text: desc.hint }) : null);
  return { wrap, read: () => input.value.trim() };
}

function selectField(desc) {
  const id = `fld_${++formSeq}`;
  const select = el('select', { id, name: desc.name });
  for (const opt of desc.options) select.append(el('option', { value: opt.value, text: opt.label }));
  select.value = desc.value ?? desc.options[0]?.value ?? '';
  const wrap = fieldWrap(desc, labelFor(desc, id), select, desc.hint ? el('span', { class: 'hint', text: desc.hint }) : null);
  return { wrap, read: () => select.value };
}

function stringListField(desc) {
  const rows = el('div', { class: 'repeater' });
  const addRow = (value = '') => {
    const input = el('input', { type: 'text', value, placeholder: desc.placeholder || 'Add a note' });
    const remove = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove note' });
    remove.append(icon('close'));
    remove.addEventListener('click', () => row.remove());
    const row = el('div', { class: 'rep-row' }, input, remove);
    rows.append(row);
    return input;
  };
  (desc.value && desc.value.length ? desc.value : ['']).forEach((v) => addRow(v));
  const add = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' });
  add.append(icon('plus'), document.createTextNode(' Add note'));
  add.addEventListener('click', () => addRow().focus());
  const wrap = fieldWrap(desc, labelFor(desc, `rep_${++formSeq}`), rows, add);
  return {
    wrap,
    read: () => [...rows.querySelectorAll('input')].map((i) => i.value.trim()).filter(Boolean),
  };
}

function pilotListField(desc) {
  const rows = el('div', { class: 'repeater' });
  const addRow = (entry = { kind: 'positive', text: '' }) => {
    const kind = el('select', {}, el('option', { value: 'positive', text: 'Went well' }), el('option', { value: 'practice', text: 'To practise' }));
    kind.value = entry.kind || 'positive';
    kind.style.flex = '0 0 130px';
    const text = el('input', { type: 'text', value: entry.text || '', placeholder: 'What happened' });
    const remove = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove note' });
    remove.append(icon('close'));
    remove.addEventListener('click', () => row.remove());
    const row = el('div', { class: 'rep-row' }, kind, text, remove);
    rows.append(row);
    return text;
  };
  (desc.value && desc.value.length ? desc.value : [{ kind: 'positive', text: '' }]).forEach((v) => addRow(v));
  const add = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' });
  add.append(icon('plus'), document.createTextNode(' Add note'));
  add.addEventListener('click', () => addRow().focus());
  const wrap = fieldWrap(desc, labelFor(desc, `rep_${++formSeq}`), rows, add);
  return {
    wrap,
    read: () => [...rows.querySelectorAll('.rep-row')].map((r) => ({
      kind: r.querySelector('select').value,
      text: r.querySelector('input').value.trim(),
    })).filter((e) => e.text),
  };
}

// --------------------------------------------------------------- form runner

export function openForm({ title, fields, submitLabel = 'Save', wide = false, onSubmit }) {
  const id = `form_${++formSeq}`;
  const errorBox = el('div', { class: 'form-error' });
  errorBox.style.display = 'none';
  const grid = el('div', { class: 'form-grid' });
  const built = fields.map((f) => {
    const b = buildField(f);
    grid.append(b.wrap);
    return { desc: f, read: b.read };
  });
  const form = el('form', { id }, errorBox, grid);

  const cancel = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Cancel' });
  const save = el('button', { class: 'btn btn-primary', type: 'submit', text: submitLabel });
  save.setAttribute('form', id);
  cancel.addEventListener('click', () => handle.close());

  const showError = (err) => {
    const msgs = err?.details?.errors || [err?.message || 'Something went wrong'];
    errorBox.textContent = msgs.join(' · ');
    errorBox.style.display = 'block';
    errorBox.scrollIntoView({ block: 'nearest' });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    save.disabled = true;
    save.textContent = 'Saving…';
    const values = {};
    for (const b of built) values[b.desc.name] = b.read();
    try {
      await onSubmit(values);
      handle.close();
    } catch (err) {
      showError(err);
      save.disabled = false;
      save.textContent = submitLabel;
    }
  });

  const handle = openDialog({ title, body: form, actions: [cancel, save], wide });
  return handle;
}

// --------------------------------------------------------------- option helpers

const enumOptions = (values, { required } = {}) =>
  (required ? [] : [{ value: '', label: '—' }]).concat(values.map((v) => ({ value: v, label: v })));

// --------------------------------------------------------------- entity forms

export function openAdventureForm({ adventure = null, onSaved } = {}) {
  const a = adventure || {};
  openForm({
    title: adventure ? 'Edit adventure' : 'New adventure',
    submitLabel: adventure ? 'Save' : 'Create adventure',
    fields: [
      { kind: 'text', name: 'title', label: 'Title', required: true, full: true, value: a.title },
      { kind: 'text', name: 'subtitle', label: 'Tagline', full: true, value: a.subtitle, placeholder: 'A short tagline' },
      { kind: 'textarea', name: 'description', label: 'Description', full: true, value: a.description },
      { kind: 'select', name: 'status', label: 'Status', value: a.status || 'planning', options: enumOptions(['planning', 'active', 'complete', 'archived'], { required: true }) },
      { kind: 'date', name: 'start_date', label: 'Start date', value: a.start_date },
      { kind: 'date', name: 'end_date', label: 'End date', value: a.end_date },
    ],
    onSubmit: async (values) => {
      const saved = adventure
        ? await api.adventures.update(adventure.id, values)
        : await api.adventures.create(values);
      if (onSaved) await onSaved(saved);
    },
  });
}

const LEG_SECTION_TITLES = {
  new: 'New flight',
  summary: 'Flight summary',
  departure: 'Departure',
  arrival: 'Arrival',
  aircraft: 'Aircraft',
  conditions: 'Conditions',
  route: 'Route',
  quicknotes: 'Quick notes',
  journal: 'Journal',
  pilotnotes: 'Pilot notes',
  hero: 'Hero photo',
};

function legFields(section, leg, heroOptions) {
  const l = leg || {};
  switch (section) {
    case 'new':
      return [
        { kind: 'date', name: 'flight_date', label: 'Date', required: true, value: l.flight_date },
        { kind: 'text', name: 'dep_icao', label: 'Departure (ICAO)', required: true, value: l.dep_icao, placeholder: '4-letter ICAO' },
        { kind: 'text', name: 'dep_name', label: 'Departure name', value: l.dep_name },
        { kind: 'text', name: 'arr_icao', label: 'Arrival (ICAO)', value: l.arr_icao },
        { kind: 'text', name: 'title', label: 'Title', full: true, value: l.title, placeholder: 'Optional title for this flight' },
      ];
    case 'summary':
      return [
        { kind: 'text', name: 'title', label: 'Title', full: true, value: l.title },
        { kind: 'number', name: 'number', label: 'Leg number', value: l.number, min: 0 },
        { kind: 'select', name: 'status', label: 'Status', value: l.status || 'draft', options: enumOptions(['draft', 'flown'], { required: true }) },
        { kind: 'date', name: 'flight_date', label: 'Date', required: true, value: l.flight_date },
        { kind: 'select', name: 'rules', label: 'Rules', value: l.rules, options: enumOptions(['VFR', 'IFR']) },
        { kind: 'select', name: 'light', label: 'Light', value: l.light, options: enumOptions(['Day', 'Night']) },
        { kind: 'number', name: 'distance_nm', label: 'Distance (NM)', value: l.distance_nm, min: 0, step: '0.1' },
        { kind: 'number', name: 'duration_min', label: 'Duration (min)', value: l.duration_min, min: 0 },
      ];
    case 'departure':
      return [
        { kind: 'text', name: 'dep_icao', label: 'Departure (ICAO)', required: true, value: l.dep_icao },
        { kind: 'text', name: 'dep_name', label: 'Departure name', value: l.dep_name },
      ];
    case 'arrival':
      return [
        { kind: 'text', name: 'arr_icao', label: 'Arrival (ICAO)', value: l.arr_icao },
        { kind: 'text', name: 'arr_name', label: 'Arrival name', value: l.arr_name },
        { kind: 'text', name: 'diverted_to_icao', label: 'Diverted to (ICAO)', value: l.diverted_to_icao },
        { kind: 'textarea', name: 'diversion_note', label: 'Diversion note', full: true, value: l.diversion_note, rows: 3 },
      ];
    case 'aircraft':
      return [
        { kind: 'text', name: 'aircraft_type', label: 'Type', value: l.aircraft_type, placeholder: 'Make and model' },
        { kind: 'text', name: 'registration', label: 'Registration', value: l.registration },
        { kind: 'text', name: 'callsign', label: 'Callsign', value: l.callsign },
      ];
    case 'conditions':
      return [
        { kind: 'select', name: 'rules', label: 'Rules', value: l.rules, options: enumOptions(['VFR', 'IFR']) },
        { kind: 'select', name: 'light', label: 'Light', value: l.light, options: enumOptions(['Day', 'Night']) },
      ];
    case 'route':
      return [{ kind: 'textarea', name: 'route_text', label: 'Route', full: true, rows: 4, value: l.route_text, placeholder: 'Waypoints and airways' }];
    case 'quicknotes':
      return [{ kind: 'string-list', name: 'quick_notes', label: 'Quick notes', full: true, value: l.quick_notes || [] }];
    case 'journal':
      return [{ kind: 'textarea', name: 'journal', label: 'Journal', full: true, rows: 12, value: l.journal }];
    case 'pilotnotes':
      return [{ kind: 'pilot-list', name: 'pilot_notes', label: 'Pilot notes', full: true, value: l.pilot_notes || [] }];
    case 'hero':
      return [{ kind: 'select', name: 'hero_photo_id', label: 'Hero photo', full: true, value: l.hero_photo_id, options: [{ value: '', label: '— none —' }].concat(heroOptions || []) }];
    default:
      return [];
  }
}

export function openLegForm({ leg = null, section = 'summary', adventureId, heroOptions = [], onSaved } = {}) {
  const creating = section === 'new';
  openForm({
    title: LEG_SECTION_TITLES[section] || 'Edit flight',
    submitLabel: creating ? 'Add flight' : 'Save',
    fields: legFields(section, leg, heroOptions),
    onSubmit: async (values) => {
      let saved;
      if (creating) {
        saved = await api.legs.create({ ...values, adventure_id: adventureId });
      } else {
        saved = await api.legs.update(leg.id, values);
      }
      if (onSaved) await onSaved(saved);
    },
  });
}

export function openDestinationForm({ destination = null, adventureId, onSaved } = {}) {
  const d = destination || {};
  openForm({
    title: destination ? 'Edit destination' : 'New destination',
    submitLabel: destination ? 'Save' : 'Add destination',
    fields: [
      { kind: 'text', name: 'name', label: 'Name', required: true, full: true, value: d.name },
      { kind: 'text', name: 'country_code', label: 'Country code', value: d.country_code, placeholder: '2-letter code', maxlength: 3 },
      { kind: 'select', name: 'tier', label: 'Tier', value: d.tier || 'significant', options: enumOptions(['core', 'significant', 'optional'], { required: true }) },
      { kind: 'select', name: 'status', label: 'Status', value: d.status || 'planned', options: enumOptions(['planned', 'visited'], { required: true }) },
      { kind: 'number', name: 'sort_order', label: 'Order', value: d.sort_order ?? 0, min: 0 },
      { kind: 'textarea', name: 'description', label: 'Notes', full: true, value: d.description },
    ],
    onSubmit: async (values) => {
      const saved = destination
        ? await api.destinations.update(destination.id, values)
        : await api.destinations.create({ ...values, adventure_id: adventureId });
      if (onSaved) await onSaved(saved);
    },
  });
}

export function openMomentForm({ moment = null, legId, phase = 'en-route', photoOptions = [], onSaved } = {}) {
  const m = moment || {};
  openForm({
    title: moment ? 'Edit moment' : 'New moment',
    submitLabel: moment ? 'Save' : 'Add moment',
    fields: [
      { kind: 'select', name: 'phase', label: 'Phase', required: true, value: m.phase || phase, options: enumOptions(['pre-departure', 'departure', 'en-route', 'approach', 'arrival'], { required: true }) },
      { kind: 'text', name: 'title', label: 'Title', full: true, value: m.title },
      { kind: 'text', name: 'time_text', label: 'Time', value: m.time_text, placeholder: 'HH:MMZ' },
      { kind: 'text', name: 'place_text', label: 'Place', value: m.place_text },
      { kind: 'textarea', name: 'caption', label: 'Caption', full: true, rows: 2, value: m.caption },
      { kind: 'textarea', name: 'note', label: 'Note', full: true, rows: 3, value: m.note },
      { kind: 'select', name: 'favorite', label: 'Favourite', value: m.favorite ? 'true' : 'false', options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }] },
      { kind: 'select', name: 'photo_id', label: 'Photo', full: true, value: m.photo_id || '', options: [{ value: '', label: '— no photo —' }].concat(photoOptions) },
    ],
    onSubmit: async (values) => {
      const saved = moment
        ? await api.moments.update(moment.id, values)
        : await api.moments.create({ ...values, leg_id: legId });
      if (onSaved) await onSaved(saved);
    },
  });
}
