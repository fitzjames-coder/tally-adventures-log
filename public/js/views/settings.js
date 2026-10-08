// Settings: app name, data export, and a link to Trash.

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { currentAdventure } from '../state.js';
import { api } from '../api.js';
import { openAdventureForm } from '../ui/forms.js';
import { toast } from '../ui/dialog.js';
import { pageHead, sectionHead, editButton, primaryButton, ghostButton } from './common.js';

export function renderSettings(app) {
  const adv = currentAdventure();
  const wrap = el('div', {});
  wrap.append(pageHead('Settings'));

  // App
  const appCard = el('div', { class: 'card section' });
  appCard.append(sectionHead('App'));
  appCard.append(el('div', { class: 'eyebrow', text: 'Name' }), el('div', { style: { fontFamily: 'var(--serif)', fontSize: '20px', color: 'var(--navy)' }, text: 'TALLY JOURNEY' }));
  appCard.append(el('p', { class: 'muted', style: { marginTop: '8px' }, text: 'A private flight journal. No sign-in, by design.' }));
  wrap.append(appCard);

  // Current adventure
  const advCard = el('div', { class: 'card section' });
  advCard.append(sectionHead('Current adventure', adv ? [editButton(() => openAdventureForm({ adventure: adv, onSaved: () => app.reloadAll() }))] : []));
  if (adv) {
    advCard.append(el('div', { style: { fontWeight: '700', color: 'var(--navy)' }, text: adv.title }));
    if (adv.subtitle) advCard.append(el('div', { class: 'muted', text: adv.subtitle }));
  } else {
    advCard.append(el('p', { class: 'muted', text: 'No adventure yet. Create one from the sidebar.' }));
  }
  wrap.append(advCard);

  // Data
  const dataCard = el('div', { class: 'card section' });
  dataCard.append(sectionHead('Your data'));
  dataCard.append(el('p', { class: 'muted', text: 'Export every record — adventures, flights, destinations, moments and photo metadata — as one JSON file.' }));
  const exportBtn = primaryButton(' Export all data', 'download', () => doExport(exportBtn));
  const trashLink = ghostButton(' Open Trash', 'trash', () => app.navigate('/trash'));
  dataCard.append(el('div', { class: 'chiprow', style: { marginTop: '12px' } }, exportBtn, trashLink));
  wrap.append(dataCard);

  // Storage
  const storeCard = el('div', { class: 'card section' });
  storeCard.append(sectionHead('Device storage'));
  const status = el('p', { class: 'muted', text: 'Checking persistent storage…' });
  storeCard.append(status);
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then((persisted) => {
      status.textContent = persisted
        ? 'Persistent storage is granted: the app shell and viewed photos stay cached offline.'
        : 'Persistent storage is not granted yet. Install the app or revisit to keep the offline cache.';
    });
  } else {
    status.textContent = 'This browser does not report storage persistence.';
  }
  wrap.append(storeCard);

  return wrap;
}

async function doExport(btn) {
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Preparing…';
  try {
    const data = await api.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: 'tally-adventures-log-export.json' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Export downloaded');
  } catch (err) {
    toast(err?.message || 'Export failed', { error: true });
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}
