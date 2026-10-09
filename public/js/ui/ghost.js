// Ghost empty states and the "schematic (not for navigation)" route drawing.
// No real map tiles and no geographic coordinates — legs are laid out along a
// gentle schematic path, exactly as the approved stills show.

import { el, svgEl } from '../dom.js';

const NS = 'http://www.w3.org/2000/svg';

// Place N labelled points along a gentle wave inside a 600x240 viewBox.
function layout(labels) {
  const n = labels.length;
  const W = 600, H = 240, padX = 60, padY = 50;
  return labels.map((label, i) => {
    const x = n <= 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1);
    const y = H / 2 + Math.sin(i * 0.9 + 0.6) * (H / 2 - padY) * 0.7;
    return { x, y, label };
  });
}

function line(x1, y1, x2, y2, { dashed, color, width = 3, highlight }) {
  const l = document.createElementNS(NS, 'line');
  l.setAttribute('x1', x1); l.setAttribute('y1', y1);
  l.setAttribute('x2', x2); l.setAttribute('y2', y2);
  l.setAttribute('stroke', color);
  l.setAttribute('stroke-width', highlight ? width + 1.5 : width);
  l.setAttribute('stroke-linecap', 'round');
  if (dashed) l.setAttribute('stroke-dasharray', '2 7');
  if (highlight) l.setAttribute('opacity', '1'); else if (dashed) l.setAttribute('opacity', '0.8');
  return l;
}

function dot(x, y, { color, r = 5, fill }) {
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r);
  c.setAttribute('stroke', color); c.setAttribute('stroke-width', '2');
  c.setAttribute('fill', fill || '#F5E8D8');
  return c;
}

function labelText(x, y, text, color) {
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', x); t.setAttribute('y', y - 10);
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('font-size', '12');
  t.setAttribute('font-weight', '700');
  t.setAttribute('fill', color);
  t.textContent = text;
  return t;
}

/**
 * @param legs ordered legs; each uses dep_icao/arr_icao/status.
 * @param opts { highlightLegId, onNavy }
 * Returns an <svg> element, or null if there is nothing to draw.
 */
export function legSchematic(legs, opts = {}) {
  const onNavy = !!opts.onNavy;
  const inkMuted = onNavy ? 'rgba(245,232,216,0.5)' : '#526581';
  const nodeStroke = onNavy ? '#F5E8D8' : '#163973';
  const nodeFill = onNavy ? '#163973' : '#F5E8D8';
  const AMBER = '#F09A1F';
  const PLAN = onNavy ? 'rgba(245,232,216,0.55)' : '#163973';

  // Build the ordered chain of airports: dep of first, then each arr (fallback dep).
  const chain = [];
  const steps = [];
  legs.forEach((leg, i) => {
    const dep = leg.dep_icao || '—';
    const arr = leg.arr_icao || leg.dep_icao || '—';
    if (i === 0) chain.push(dep);
    chain.push(arr);
    steps.push({ from: chain.length - 2, to: chain.length - 1, leg });
  });
  if (chain.length < 2) return null;

  const pts = layout(chain);
  const svg = svgEl('<svg viewBox="0 0 600 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg>');

  for (const s of steps) {
    const a = pts[s.from], b = pts[s.to];
    const flown = s.leg.status === 'flown';
    const highlight = opts.highlightLegId && s.leg.id === opts.highlightLegId;
    svg.appendChild(line(a.x, a.y, b.x, b.y, {
      dashed: !flown,
      color: flown ? AMBER : PLAN,
      highlight,
    }));
  }
  pts.forEach((p) => {
    svg.appendChild(dot(p.x, p.y, { color: nodeStroke, fill: nodeFill }));
    svg.appendChild(labelText(p.x, p.y, p.label, onNavy ? '#e7dccb' : '#163973'));
  });
  return svg;
}

// A faint placeholder route for the empty journey / empty stage.
export function ghostSchematic(onNavy = false) {
  const stroke = onNavy ? 'rgba(245,232,216,0.4)' : '#c9b595';
  const svg = svgEl('<svg viewBox="0 0 600 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg>');
  const labels = ['', '', '', '', ''];
  const pts = layout(labels);
  for (let i = 0; i < pts.length - 1; i++) {
    svg.appendChild(line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, { dashed: true, color: stroke, width: 2 }));
  }
  pts.forEach((p) => svg.appendChild(dot(p.x, p.y, { color: stroke, r: 4, fill: onNavy ? '#163973' : '#F5E8D8' })));
  return svg;
}

// A dashed ghost timeline (for "along the way" before a flight).
export function ghostTimeline() {
  const svg = svgEl('<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg>');
  const x = 14;
  const axis = document.createElementNS(NS, 'line');
  axis.setAttribute('x1', x); axis.setAttribute('y1', 12); axis.setAttribute('x2', x); axis.setAttribute('y2', 138);
  axis.setAttribute('stroke', '#c9b595'); axis.setAttribute('stroke-width', '2'); axis.setAttribute('stroke-dasharray', '2 6');
  svg.appendChild(axis);
  for (let i = 0; i < 4; i++) {
    const y = 24 + i * 34;
    svg.appendChild(dot(x, y, { color: '#c9b595', r: 5, fill: '#F8EEE2' }));
    const bar = document.createElementNS(NS, 'rect');
    bar.setAttribute('x', x + 16); bar.setAttribute('y', y - 7); bar.setAttribute('rx', 4);
    bar.setAttribute('width', 170 - i * 20); bar.setAttribute('height', 10); bar.setAttribute('fill', '#ead9c1');
    svg.appendChild(bar);
  }
  return svg;
}

export function ghostBox({ title, text, visual }) {
  const box = el('div', { class: 'ghost-box' });
  box.append(el('div', { class: 'gb-title', text: title }));
  if (text) box.append(el('div', { class: 'gb-text', text }));
  if (visual) {
    const wrap = el('div', { class: 'ghost-visual' });
    wrap.append(visual);
    box.append(wrap);
  }
  return box;
}

// A ghost phase photo box (dashed, striped, with a caption).
export function ghostPhaseBox(label, caption = 'No photos yet') {
  return el('div', { class: 'ghost-ph ghost-stripe' },
    el('span', { class: 'glabel', text: label }),
    el('span', { class: 'gcap', text: caption }),
  );
}
