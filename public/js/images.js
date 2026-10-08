// Resize on the device before upload. The original File is never modified; we
// derive a web copy (longest edge 1600px, WebP) and a thumbnail (480px, WebP)
// with a canvas, and hash the original for integrity.

const WEB_EDGE = 1600;
const THUMB_EDGE = 480;

export async function processImage(file) {
  const source = await loadBitmap(file);
  const width = source.width;
  const height = source.height;

  const web = await encodeWebp(source, WEB_EDGE, 0.82);
  const thumb = await encodeWebp(source, THUMB_EDGE, 0.8);
  const sha256 = await sha256Hex(file);

  if (source.close) source.close();

  return {
    original: file,
    web,
    thumb,
    width,
    height,
    bytes: file.size,
    sha256,
    mime: file.type || 'image/jpeg',
    filename: file.name || 'photo',
  };
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> decode (e.g. some HEIC cases) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; }));
    return { width: img.naturalWidth, height: img.naturalHeight, _img: img };
  } finally {
    // Revoke after the draw has happened; defer to next tick.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

async function encodeWebp(source, maxEdge, quality) {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source._img || source, 0, 0, w, h);

  if (canvas.convertToBlob) return canvas.convertToBlob({ type: 'image/webp', quality });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
}

async function sha256Hex(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
