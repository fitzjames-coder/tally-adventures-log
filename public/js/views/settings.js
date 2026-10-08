// Settings: app name, SimBrief account, data export (CSV + JSON), Trash link.

import { el } from '../dom.js';
import { store } from '../state.js';
import { api } from '../api.js';
import { toast } from '../ui/dialog.js';
import { pageHead, sectionHead, primaryButton, ghostButton } from './common.js';

export function renderSettings(app) {
  const wrap = el('div', {});
  wrap.append(pageHead('Settings'));

  // App
  const appCard = el('div', { class: 'card section' });
  appCard.append(sectionHead('App'));
  appCard.append(el('div', { class: 'eyebrow', text: 'Name' }), el('div', { style: { fontFamily: 'var(--serif)', fontSize: '20px', color: 'var(--navy)' }, text: 'TALLY JOURNEY' }));
  appCard.append(el('p', { class: 'muted', style: { marginTop: '8px' }, text: 'A private flight journal. No sign-in, by design.' }));
  wrap.append(appCard);

  // SimBrief
  const sbCard = el('div', { class: 'card section' });
  sbCard.append(sectionHead('SimBrief'));
  sbCard.append(el('p', { class: 'muted', text: 'Save your SimBrief username or Pilot ID so you can import the latest OFP into a leg’s planned flight plan. No password is stored.' }));
  const input = el('input', { type: 'text', value: store.settings.simbrief_username || '', placeholder: 'SimBrief username or Pilot ID', style: { maxWidth: '320px' } });
  const field = el('div', { class: 'field', style: { marginTop: '10px' } }, el('label', { for: 'sbuser', text: 'Username / Pilot ID' }), input);
  input.id = 'sbuser';
  const save = primaryButton(' Save', 'check', async () => {
    save.disabled = true;
    try {
      const next = await api.settings.save({ simbrief_username: input.value.trim() });
      store.settings = next;
      toast('SimBrief account saved');
    } catch (err) {
      toast(err?.message || 'Could not save', { error: true });
    } finally { save.disabled = false; }
  });
  sbCard.append(field, el('div', { class: 'chiprow', style: { marginTop: '10px' } }, save));
  wrap.append(sbCard);

  // Data
  const dataCard = el('div', { class: 'card section' });
  dataCard.append(sectionHead('Your data'));
  dataCard.append(el('p', { class: 'muted', text: 'Export everything — chapters, paragraphs, legs (flown and planned), moments, photos and documents. CSV gives one file per table in a zip; JSON gives a single document. Trashed rows are included.' }));
  const csvBtn = primaryButton(' Download CSV', 'download', () => downloadUrl('/api/export/csv', csvBtn));
  const jsonBtn = ghostButton(' Export JSON', 'download', () => doJsonExport(jsonBtn));
  const trashLink = ghostButton(' Open Trash', 'trash', () => app.navigate('/trash'));
  dataCard.append(el('div', { class: 'chiprow', style: { marginTop: '12px' } }, csvBtn, jsonBtn, trashLink));
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

function downloadUrl(url) {
  const a = el('a', { href: url });
  document.body.append(a);
  a.click();
  a.remove();
  toast('Preparing download…');
}

async function doJsonExport(btn) {
  btn.disabled = true;
  try {
    const data = await api.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: 'tally-journey-export.json' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('JSON exported');
  } catch (err) {
    toast(err?.message || 'Export failed', { error: true });
  } finally { btn.disabled = false; }
}
