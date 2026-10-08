// SimBrief import: fetch the latest OFP, show a preview, and (only on confirm)
// save into the PLANNED fields of the leg. Flown fields are never touched.

import { el } from '../dom.js';
import { api } from '../api.js';
import { openDialog, toast } from './dialog.js';

const LABELS = {
  planned_route: 'Route',
  planned_cruise_alt: 'Cruise',
  planned_block_fuel: 'Block fuel',
  planned_ete_min: 'ETE (min)',
  planned_tas_kt: 'TAS (kt)',
  planned_alternate_icao: 'Alternate',
  planned_reserve_min: 'Reserve (min)',
  simbrief_ofp_ref: 'OFP ref',
};

export function openSimbriefImport(leg, onSaved) {
  const body = el('div', {}, el('p', { class: 'muted', text: 'Fetching your latest SimBrief OFP…' }));
  const handle = openDialog({ title: 'Import latest OFP', body });

  api.simbriefPreview(leg.id)
    .then((res) => renderPreview(res))
    .catch((err) => renderError(err));

  function renderError(err) {
    body.replaceChildren(el('div', { class: 'form-error', text: err?.message || 'SimBrief import failed.' }));
  }

  function renderPreview({ planned, info }) {
    body.replaceChildren();
    if (info && (info.origin || info.destination || info.aircraft)) {
      const line = [
        [info.origin, info.destination].filter(Boolean).join(' → '),
        info.aircraft,
      ].filter(Boolean).join(' · ');
      body.append(el('div', { class: 'eyebrow', text: 'From SimBrief' }), el('p', { style: { marginTop: '2px', fontWeight: '700', color: 'var(--navy)' }, text: line || '—' }));
    }

    const table = el('div', { class: 'pc-fields', style: { marginTop: '12px' } });
    for (const [key, label] of Object.entries(LABELS)) {
      if (planned[key] === undefined) continue;
      table.append(el('div', { class: 'row' }, el('span', { class: 'k', text: label }), el('span', { class: 'v', text: String(planned[key]) })));
    }
    body.append(table);
    body.append(el('p', { class: 'muted', style: { marginTop: '12px' }, text: 'These go into the planned flight plan only. What you flew is left untouched.' }));

    const cancel = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Cancel' });
    cancel.addEventListener('click', () => handle.close());
    const save = el('button', { class: 'btn btn-primary', type: 'button', text: 'Save to planned' });
    save.addEventListener('click', async () => {
      save.disabled = true; save.textContent = 'Saving…';
      try {
        const updated = await api.legs.update(leg.id, planned);
        toast('Planned flight plan updated');
        handle.close();
        if (onSaved) await onSaved(updated);
      } catch (err) {
        save.disabled = false; save.textContent = 'Save to planned';
        body.append(el('div', { class: 'form-error', style: { marginTop: '10px' }, text: err?.message || 'Could not save.' }));
      }
    });
    handle.el.querySelector('.dialog-body').after(el('div', { class: 'dialog-foot' }, cancel, save));
  }
}
