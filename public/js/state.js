// Client-side data store for the current adventure. Thin: the Worker is the
// source of truth; this just holds what the current screens need.

import { api } from './api.js';

const LS_KEY = 'tally.currentAdventure';

export const store = {
  loaded: false,
  adventures: [],
  currentId: null,
  legs: [],
  destinations: [],
  moments: [],            // moments for the current adventure's legs
  legsById: new Map(),
  photosById: new Map(),  // photos are global, keyed for lookups
};

export async function loadAll() {
  store.adventures = await api.adventures.list();
  const saved = localStorage.getItem(LS_KEY);
  if (!store.currentId || !store.adventures.some((a) => a.id === store.currentId)) {
    store.currentId = store.adventures.some((a) => a.id === saved)
      ? saved
      : (store.adventures[0]?.id || null);
  }
  await loadCurrent();
  store.loaded = true;
}

export async function loadCurrent() {
  if (!store.currentId) {
    Object.assign(store, { legs: [], destinations: [], moments: [], legsById: new Map(), photosById: new Map() });
    return;
  }
  const [legs, destinations, allMoments, allPhotos] = await Promise.all([
    api.legs.list({ adventure_id: store.currentId }),
    api.destinations.list({ adventure_id: store.currentId }),
    api.moments.list(),
    api.photos.list(),
  ]);
  store.legs = legs;
  store.destinations = destinations;
  store.legsById = new Map(legs.map((l) => [l.id, l]));
  const legIds = new Set(legs.map((l) => l.id));
  store.moments = allMoments
    .filter((m) => legIds.has(m.leg_id))
    .sort((a, b) => (a.sort_order - b.sort_order) || String(a.created_at).localeCompare(b.created_at));
  store.photosById = new Map(allPhotos.map((p) => [p.id, p]));
}

export function setCurrent(id) {
  store.currentId = id;
  if (id) localStorage.setItem(LS_KEY, id);
  else localStorage.removeItem(LS_KEY);
}

export function currentAdventure() {
  return store.adventures.find((a) => a.id === store.currentId) || null;
}

export function getLeg(id) {
  return store.legsById.get(id) || null;
}

export function getPhoto(id) {
  return id ? (store.photosById.get(id) || null) : null;
}

export function momentsForLeg(legId) {
  return store.moments.filter((m) => m.leg_id === legId);
}
