// Document upload (OFP / Navigraph / other PDFs kept with a leg).

import { el } from '../dom.js';
import { api } from '../api.js';
import { openDialog, toast } from './dialog.js';

export function pickFile(accept = 'application/pdf,image/*') {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept });
    input.style.display = 'none';
    document.body.append(input);
    const done = (f) => { input.remove(); resolve(f); };
    input.addEventListener('change', () => done(input.files && input.files[0] ? input.files[0] : null));
    input.addEventListener('cancel', () => done(null));
    input.click();
  });
}

export async function uploadDocument(legId, kind) {
  const file = await pickFile();
  if (!file) return null;
  toast('Uploading document…');
  try {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('leg_id', legId);
    fd.append('kind', kind || 'other');
    fd.append('filename', file.name);
    fd.append('size_bytes', String(file.size));
    const doc = await api.documents.upload(fd);
    toast('Document added');
    return doc;
  } catch (err) {
    toast(err?.message || 'Upload failed', { error: true });
    return null;
  }
}

export function openAddDocument(legId, onSaved) {
  const body = el('div', {}, el('p', { class: 'muted', text: 'Pick the kind of PDF, then choose the file. It is kept with this leg as the real record.' }));
  const make = (kind, label) => {
    const b = el('button', { class: 'btn btn-ghost', type: 'button', text: label });
    b.addEventListener('click', async () => {
      handle.close();
      const doc = await uploadDocument(legId, kind);
      if (doc && onSaved) await onSaved(doc);
    });
    return b;
  };
  body.append(el('div', { class: 'chiprow', style: { marginTop: '12px' } },
    make('ofp', 'SimBrief OFP'), make('navigraph', 'Navigraph charts'), make('other', 'Other PDF')));
  const close = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Cancel' });
  const handle = openDialog({ title: 'Add OFP or chart PDF', body, actions: [close] });
  close.addEventListener('click', () => handle.close());
}
