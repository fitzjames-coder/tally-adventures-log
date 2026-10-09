// The breadcrumb shown on every journey page.

import { el } from '../dom.js';

/** Breadcrumb row. parts: array of { label, to } | { label } (last = current). */
export function crumbs(parts) {
  const row = el('div', { class: 'crumbs' });
  row.append(el('span', { class: 'here', text: 'TALLY JOURNEY' }));
  parts.forEach((p) => {
    row.append(el('span', { class: 'sep', text: '/' }));
    if (p.to) {
      const a = el('a', { href: `#${p.to}`, text: p.label });
      row.append(a);
    } else {
      row.append(el('span', { class: 'here', text: p.label }));
    }
  });
  return row;
}
