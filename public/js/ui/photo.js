// Photo tiles (lazy thumbnails), the photo dialog (web size on open, original
// only on an explicit tap), and the device-side upload flow.

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { lazyImg } from '../lazy.js';
import { api } from '../api.js';
import { processImage } from '../images.js';
import { openDialog, toast } from './dialog.js';
import { openForm } from './forms.js';

export const mediaUrl = (key) => (key ? `/media/${key}` : '');

export function photoTile(photo, { moment, onClick } = {}) {
  const label = moment?.caption || photo.caption || photo.original_filename || 'Photo';
  const tile = el('button', { class: 'photo-tile', type: 'button', 'aria-label': label });
  if (photo.thumb_key) {
    tile.append(lazyImg(mediaUrl(photo.thumb_key), { alt: photo.alt || moment?.caption || '' }));
  } else {
    tile.append(el('div', { class: 'skeleton', style: { position: 'absolute', inset: '0' } }));
  }
  if (moment?.favorite) tile.append(icon('star', 'fav'));
  const cap = moment?.caption || photo.caption;
  if (cap) tile.append(el('div', { class: 'ph-cap', text: cap }));
  tile.addEventListener('click', () => (onClick ? onClick() : openPhotoDialog(photo, { moment })));
  return tile;
}

export function openPhotoDialog(photo, { moment, onChanged } = {}) {
  const img = el('img', { alt: photo.alt || moment?.caption || '', decoding: 'async' });
  img.src = mediaUrl(photo.web_key || photo.thumb_key); // web size, loaded because it's open now
  const view = el('div', { class: 'photo-view' }, img);

  const meta = el('div', { class: 'photo-meta' });
  const cap = moment?.caption || photo.caption;
  if (cap) meta.append(el('div', { class: 'cap', text: cap }));
  if (moment?.note) meta.append(el('div', { class: 'note', text: moment.note }));
  if (photo.taken_at) meta.append(el('div', { class: 'muted', style: { marginTop: '6px', fontSize: '12px' }, text: `Taken ${photo.taken_at}` }));

  const body = el('div', {}, view, meta);

  const viewOriginal = el('button', { class: 'btn btn-ghost', type: 'button' });
  viewOriginal.append(icon('download'), document.createTextNode(' View original'));
  viewOriginal.addEventListener('click', () => window.open(mediaUrl(photo.original_key), '_blank', 'noopener'));

  const edit = el('button', { class: 'btn btn-ghost', type: 'button' });
  edit.append(icon('edit'), document.createTextNode(' Edit photo'));
  edit.addEventListener('click', () => openPhotoMetaForm(photo, onChanged));

  const close = el('button', { class: 'btn btn-primary', type: 'button', text: 'Close' });
  const handle = openDialog({ title: 'Photo', body, wide: true, actions: [viewOriginal, edit, close] });
  close.addEventListener('click', () => handle.close());
  return handle;
}

export function openPhotoMetaForm(photo, onChanged) {
  openForm({
    title: 'Edit photo',
    fields: [
      { kind: 'text', name: 'caption', label: 'Caption', full: true, value: photo.caption },
      { kind: 'text', name: 'alt', label: 'Alt text', full: true, value: photo.alt, hint: 'Describe the photo for screen readers' },
      { kind: 'date', name: 'taken_at', label: 'Taken on', value: (photo.taken_at || '').slice(0, 10) },
    ],
    onSubmit: async (values) => {
      const saved = await api.photos.update(photo.id, values);
      toast('Photo updated');
      if (onChanged) await onChanged(saved);
    },
  });
}

// --------------------------------------------------------------- upload flow

export function pickImage() {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept: 'image/*' });
    input.style.display = 'none';
    document.body.append(input);
    const cleanup = (file) => { input.remove(); resolve(file); };
    input.addEventListener('change', () => cleanup(input.files && input.files[0] ? input.files[0] : null));
    input.addEventListener('cancel', () => cleanup(null));
    input.click();
  });
}

export async function uploadImage(file) {
  const p = await processImage(file);
  const fd = new FormData();
  fd.append('original', p.original, p.filename);
  fd.append('web', p.web, 'web.webp');
  fd.append('thumb', p.thumb, 'thumb.webp');
  fd.append('original_filename', p.filename);
  fd.append('mime', p.mime);
  fd.append('width', String(p.width));
  fd.append('height', String(p.height));
  fd.append('bytes', String(p.bytes));
  fd.append('sha256', p.sha256);
  return api.photos.upload(fd);
}

export async function pickAndUpload() {
  const file = await pickImage();
  if (!file) return null;
  toast('Processing photo on your device…');
  try {
    const photo = await uploadImage(file);
    toast('Photo uploaded');
    return photo;
  } catch (err) {
    toast(err?.message || 'Upload failed', { error: true });
    return null;
  }
}
