// The breadcrumb and the 1·Book → 2·Chapter → 3·Paragraph → 4·Sentence stepper
// shown on every book page.

import { el } from '../dom.js';
import { navigate } from '../router.js';

const STEPS = [
  { n: '1', label: 'Book', level: 'book' },
  { n: '2', label: 'Chapter', level: 'chapter' },
  { n: '3', label: 'Paragraph', level: 'paragraph' },
  { n: '4', label: 'Sentence', level: 'sentence' },
];

const ORDER = ['book', 'chapter', 'paragraph', 'sentence'];

/**
 * @param active current level
 * @param ctx { chapterId, paragraphId }
 */
export function stepper(active, ctx = {}) {
  const activeIdx = ORDER.indexOf(active);
  const row = el('div', { class: 'stepper', role: 'navigation', 'aria-label': 'Book levels' });
  STEPS.forEach((s, i) => {
    if (i > 0) row.append(el('span', { class: 'step-arrow', text: '→' }));
    const target = s.level === 'book' ? '/book'
      : s.level === 'chapter' && ctx.chapterId ? `/chapter/${ctx.chapterId}`
      : (s.level === 'paragraph' || s.level === 'sentence') && ctx.paragraphId ? `/paragraph/${ctx.paragraphId}`
      : null;
    const isActive = s.level === active || (active === 'sentence' && s.level === 'paragraph');
    const btn = el('button', {
      class: 'step' + (isActive ? ' active' : '') + (!target && !isActive ? ' ghost' : ''),
      type: 'button',
      disabled: !target,
    }, el('span', { class: 'n', text: s.n + ' ·' }), el('span', { text: s.label }));
    if (target) btn.addEventListener('click', () => navigate(target));
    row.append(btn);
  });
  return row;
}

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
