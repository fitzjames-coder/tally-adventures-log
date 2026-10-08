// Trash: soft-deleted items with Restore, and a single hard-delete action
// (Empty trash) guarded by an in-page confirmation. Covers every table.

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { api } from '../api.js';
import { confirmDialog, toast } from '../ui/dialog.js';
import { pageHead, emptyState, ghostButton } from './common.js';

const TYPE_LABEL = {
  chapters: 'Chapter',
  paragraphs: 'Paragraph',
  legs: 'Flight',
  moments: 'Moment',
  photos: 'Photo',
  documents: 'Document',
  adventures: 'Adventure',
  destinations: 'Destination',
};

export function renderTrash(app) {
  const wrap = el('div', {});
  const host = el('div', {});
  wrap.append(pageHead('Trash', 'Deleted items are kept here until you empty the trash'));
  wrap.append(host);
  load(app, host);
  return wrap;
}

async function load(app, host) {
  host.replaceChildren(el('p', { class: 'muted', text: 'Loading…' }));
  let items;
  try {
    items = await api.trash.list();
  } catch (err) {
    host.replaceChildren(el('p', { class: 'muted', text: err?.message || 'Could not load trash.' }));
    return;
  }

  if (!items.length) {
    host.replaceChildren(emptyState({ mark: 'trash', title: 'Trash is empty', message: 'Items you delete land here and can be restored.' }));
    return;
  }

  const tools = el('div', { class: 'chiprow', style: { marginBottom: '14px' } });
  const empty = el('button', { class: 'btn btn-danger', type: 'button' });
  empty.append(icon('trash'), document.createTextNode(` Empty trash (${items.length})`));
  empty.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Empty trash',
      message: `Permanently delete ${items.length} item${items.length === 1 ? '' : 's'}? This is the only action that erases data and cannot be undone.`,
      confirmLabel: 'Permanently delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.trash.empty();
      toast('Trash emptied');
      await app.refresh();
    } catch (err) {
      toast(err?.message || 'Could not empty trash', { error: true });
    }
  });
  tools.append(empty);

  const list = el('div', { class: 'trash-list' });
  for (const item of items) list.append(trashRow(app, item));
  host.replaceChildren(tools, list);
}

function trashRow(app, item) {
  const restore = ghostButton(' Restore', 'restore', async () => {
    try {
      await api.trash.restore(item.type, item.id);
      toast('Restored');
      await app.refresh();
    } catch (err) {
      toast(err?.message || 'Could not restore', { error: true });
    }
  });
  return el('div', { class: 'trash-row' },
    el('div', {},
      el('div', { class: 't-type', text: TYPE_LABEL[item.type] || item.type }),
      el('div', { class: 't-label', text: item.label }),
      item.deleted_at ? el('div', { class: 'muted', style: { fontSize: '12px' }, text: `Deleted ${String(item.deleted_at).slice(0, 10)}` }) : null),
    el('div', { class: 'right' }, restore));
}
