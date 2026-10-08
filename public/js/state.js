// Client data store for the book (TALLY JOURNEY). The Worker is the source of
// truth; this holds what the current screens need, keyed for quick lookups.

import { api } from './api.js';

export const store = {
  loaded: false,
  chapters: [],
  paragraphs: [],
  legs: [],
  moments: [],
  documents: [],
  chaptersById: new Map(),
  paragraphsById: new Map(),
  legsById: new Map(),
  photosById: new Map(),
  settings: { simbrief_username: '' },
};

export async function loadAll() {
  const [chapters, paragraphs, legs, moments, photos, documents, settings] = await Promise.all([
    api.chapters.list(),
    api.paragraphs.list(),
    api.legs.list(),
    api.moments.list(),
    api.photos.list(),
    api.documents.list(),
    api.settings.get().catch(() => ({ simbrief_username: '' })),
  ]);

  store.chapters = chapters;
  store.paragraphs = paragraphs;
  store.legs = legs;
  store.moments = moments;
  store.documents = documents;
  store.settings = settings || { simbrief_username: '' };

  store.chaptersById = new Map(chapters.map((c) => [c.id, c]));
  store.paragraphsById = new Map(paragraphs.map((p) => [p.id, p]));
  store.legsById = new Map(legs.map((l) => [l.id, l]));
  store.photosById = new Map(photos.map((p) => [p.id, p]));
  store.loaded = true;
}

// --- lookups ---

export const getChapter = (id) => store.chaptersById.get(id) || null;
export const getParagraph = (id) => store.paragraphsById.get(id) || null;
export const getLeg = (id) => store.legsById.get(id) || null;
export const getPhoto = (id) => (id ? store.photosById.get(id) || null : null);

const byOrder = (a, b) => (a.sort_order - b.sort_order) || String(a.created_at).localeCompare(b.created_at);
const byNumber = (a, b) => ((a.number ?? 1e9) - (b.number ?? 1e9)) || String(a.created_at).localeCompare(b.created_at);

export function chaptersOrdered() {
  return [...store.chapters].sort(byOrder);
}

export function paragraphsForChapter(chapterId) {
  return store.paragraphs.filter((p) => p.chapter_id === chapterId).sort(byOrder);
}

export function legsForParagraph(paragraphId) {
  return store.legs.filter((l) => l.paragraph_id === paragraphId).sort(byNumber);
}

export function legsForChapter(chapterId) {
  const paraIds = new Set(paragraphsForChapter(chapterId).map((p) => p.id));
  return store.legs.filter((l) => paraIds.has(l.paragraph_id)).sort(byNumber);
}

export function momentsForLeg(legId) {
  return store.moments
    .filter((m) => m.leg_id === legId)
    .sort((a, b) => (a.sort_order - b.sort_order) || String(a.created_at).localeCompare(b.created_at));
}

export function documentsForLeg(legId) {
  return store.documents.filter((d) => d.leg_id === legId);
}

export const isFlown = (leg) => leg && leg.status === 'flown';

// Progress: flown legs / total legs (for chapter & paragraph bars).
export function flownProgress(legs) {
  const total = legs.length;
  const flown = legs.filter(isFlown).length;
  return { flown, total, ratio: total ? flown / total : 0 };
}
