// Thumbnails load only when they scroll into view: IntersectionObserver plus
// the native loading="lazy" hint. Nothing is pre-downloaded.

import { el } from './dom.js';

const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadNow(entry.target);
          io.unobserve(entry.target);
        }
      }
    }, { rootMargin: '250px 0px' })
  : null;

function loadNow(img) {
  const src = img.dataset.src;
  if (!src || img.src) return;
  img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
  img.addEventListener('error', () => img.classList.add('loaded'), { once: true });
  img.src = src;
}

/** An <img> whose real src is attached only once it nears the viewport. */
export function lazyImg(src, { alt = '', className = '' } = {}) {
  const img = el('img', { alt, loading: 'lazy', className, decoding: 'async' });
  img.dataset.src = src;
  if (io) io.observe(img);
  else loadNow(img); // no observer support: load immediately
  return img;
}
