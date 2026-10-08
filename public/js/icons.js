// Line icons (stroke = currentColor) so colour follows the element's colour.
import { svgEl } from './dom.js';

const P = {
  journal: '<path d="M4 5a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z"/><path d="M8 7h6M8 11h6M8 15h4"/>',
  map: '<path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  photos: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m21 17-5-5-6 6"/>',
  statistics: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 16.4 5l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
  plane: '<path d="M21 14.5 13.5 12V5.5a1.5 1.5 0 0 0-3 0V12L3 14.5V16l7.5-2v4L8 19.5V21l4-1 4 1v-1.5L13.5 18v-4L21 16z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/>',
  star: '<path d="m12 3 2.9 5.9 6.1.9-4.4 4.3 1 6.1L12 17.8 6.4 20.3l1-6.1L3 9.8l6.1-.9z"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m21 17-5-5-6 6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/>',
};

export function icon(name, cls = 'ic') {
  const body = P[name] || P.compass;
  const svg = svgEl(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
  );
  if (cls) svg.setAttribute('class', cls);
  return svg;
}
