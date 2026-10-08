// Accessible modal dialogs, an in-page confirmation (never browser confirm()),
// and a lightweight toast.

import { el } from '../dom.js';
import { icon } from '../icons.js';

let active = null;

export function openDialog({ title, body, actions = [], wide = false, onClose } = {}) {
  closeDialog();

  const dialog = el('div', {
    class: 'dialog' + (wide ? ' wide' : ''),
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title || 'Dialog',
  });

  const closeBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close' });
  closeBtn.append(icon('close'));
  closeBtn.addEventListener('click', () => doClose());

  const head = el('div', { class: 'dialog-head' }, el('h2', { text: title || '' }), closeBtn);
  const bodyWrap = el('div', { class: 'dialog-body' });
  if (body) bodyWrap.append(body);
  const foot = actions.length ? el('div', { class: 'dialog-foot' }, ...actions) : null;

  dialog.append(head, bodyWrap, foot);

  const scrim = el('div', { class: 'dialog-scrim' }, dialog);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) doClose(); });

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); doClose(); }
    else if (e.key === 'Tab') trapTab(e, dialog);
  }

  function doClose() {
    if (active?.scrim !== scrim) return;
    scrim.remove();
    document.removeEventListener('keydown', onKey);
    active = null;
    if (onClose) onClose();
  }

  document.body.append(scrim);
  document.addEventListener('keydown', onKey);
  active = { scrim, close: doClose };

  requestAnimationFrame(() => {
    const first = dialog.querySelector('input, select, textarea, button:not(.icon-btn)');
    (first || closeBtn).focus();
  });

  return { close: doClose, el: dialog, body: bodyWrap };
}

export function closeDialog() {
  if (active) active.close();
}

function trapTab(e, container) {
  const focusables = [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((n) => n.offsetParent !== null || n === document.activeElement);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => { if (done) return; done = true; resolve(value); handle.close(); };

    const body = el('div', {},
      danger ? el('div', { class: 'danger-box', text: message }) : el('p', { text: message })
    );
    const cancel = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Cancel' });
    cancel.addEventListener('click', () => finish(false));
    const ok = el('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), type: 'button', text: confirmLabel });
    ok.addEventListener('click', () => finish(true));

    const handle = openDialog({ title, body, actions: [cancel, ok], onClose: () => finish(false) });
  });
}

let toastTimer = null;
export function toast(message, { error = false, ms = 2800 } = {}) {
  const prev = document.querySelector('.toast');
  if (prev) prev.remove();
  const t = el('div', { class: 'toast' + (error ? ' err' : ''), role: 'status', text: message });
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}
