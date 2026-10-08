// Small building blocks shared by the views.

import { el } from '../dom.js';
import { icon } from '../icons.js';

export function pageHead(title, sub, actions = []) {
  return el('div', { class: 'page-head' },
    el('div', {}, el('h1', { text: title }), sub ? el('div', { class: 'sub', text: sub }) : null),
    actions.length ? el('div', { class: 'chiprow' }, ...actions) : null,
  );
}

export function sectionHead(title, actions = []) {
  return el('div', { class: 'section-head' },
    el('h2', { text: title }),
    actions.length ? el('div', { class: 'chiprow' }, ...actions) : null,
  );
}

export function editButton(onClick, label = 'Edit') {
  const b = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' });
  b.append(icon('edit'), document.createTextNode(` ${label}`));
  b.addEventListener('click', onClick);
  return b;
}

export function primaryButton(label, iconName, onClick) {
  const b = el('button', { class: 'btn btn-primary', type: 'button' });
  if (iconName) b.append(icon(iconName));
  b.append(document.createTextNode(label));
  b.addEventListener('click', onClick);
  return b;
}

export function ghostButton(label, iconName, onClick) {
  const b = el('button', { class: 'btn btn-ghost', type: 'button' });
  if (iconName) b.append(icon(iconName));
  b.append(document.createTextNode(label));
  b.addEventListener('click', onClick);
  return b;
}

export function emptyState({ mark = 'compass', title, message, actionLabel, onAction, small = false }) {
  const box = el('div', { class: 'empty' + (small ? ' small' : '') });
  box.append(icon(mark, 'em-mark'));
  box.append(el('h3', { text: title }));
  if (message) box.append(el('p', { text: message }));
  if (actionLabel && onAction) box.append(primaryButton(` ${actionLabel}`, 'plus', onAction));
  return box;
}
