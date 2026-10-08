import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryStore } from '../src/lib/memstore.js';
import * as c from '../src/api/controllers.js';

async function seedAdventure(store) {
  return c.adventures.create(store, { title: 'Test Adventure' });
}

test('creating a destination never creates a leg', async () => {
  const store = new MemoryStore();
  const adv = await seedAdventure(store);

  const dest = await c.destinations.create(store, {
    adventure_id: adv.id,
    name: 'A planned place',
    tier: 'core',
  });

  assert.equal(dest.status, 'planned');
  const legs = await c.legs.list(store, { adventure_id: adv.id });
  assert.equal(legs.length, 0, 'destinations must not produce any leg');
  const dests = await c.destinations.list(store, { adventure_id: adv.id });
  assert.equal(dests.length, 1);
});

test('delete soft-deletes and lands in trash; restore brings it back', async () => {
  const store = new MemoryStore();
  const adv = await seedAdventure(store);
  const legA = await c.legs.create(store, { adventure_id: adv.id, flight_date: '2026-05-01', dep_icao: 'EDDF' });

  await c.legs.remove(store, legA.id);

  // Gone from the normal list...
  assert.equal((await c.legs.list(store, { adventure_id: adv.id })).length, 0);
  // ...but preserved in storage (NOT erased) and visible in trash.
  const stillThere = await store.get('legs', legA.id, { includeDeleted: true });
  assert.ok(stillThere, 'soft delete must not remove the row');
  assert.ok(stillThere.deleted_at, 'deleted_at should be set');

  const trash = await c.listTrash(store);
  assert.equal(trash.length, 1);
  assert.equal(trash[0].type, 'legs');
  assert.equal(trash[0].id, legA.id);

  // Restore
  const restored = await c.restore(store, { type: 'legs', id: legA.id });
  assert.equal(restored.deleted_at, null);
  assert.equal((await c.legs.list(store, { adventure_id: adv.id })).length, 1);
  assert.equal((await c.listTrash(store)).length, 0);
});

test('restoring something that is not trashed fails clearly', async () => {
  const store = new MemoryStore();
  const adv = await seedAdventure(store);
  await assert.rejects(() => c.restore(store, { type: 'adventures', id: adv.id }), /nothing to restore/i);
  await assert.rejects(() => c.restore(store, { type: 'nope', id: 'x' }), /unknown item type/i);
});

test('the only hard delete is empty-trash', async () => {
  const store = new MemoryStore();
  const adv = await seedAdventure(store);
  const legA = await c.legs.create(store, { adventure_id: adv.id, flight_date: '2026-05-01', dep_icao: 'EDDF' });
  await c.legs.remove(store, legA.id);

  // No controller offers a hard delete for a single record.
  assert.equal(typeof c.legs.remove, 'function');
  assert.equal(c.legs.hardDelete, undefined);
  assert.equal(c.legs.destroy, undefined);

  // Row survives until empty-trash.
  assert.ok(await store.get('legs', legA.id, { includeDeleted: true }));

  const result = await c.emptyTrash(store);
  assert.equal(result.emptied, true);
  assert.equal(result.counts.legs, 1);

  // Now it is truly gone.
  assert.equal(await store.get('legs', legA.id, { includeDeleted: true }), null);
  assert.equal((await c.listTrash(store)).length, 0);
});

test('photos: soft delete keeps R2 objects; empty-trash purges them', async () => {
  const store = new MemoryStore();
  const photo = await c.createPhoto(store, {
    original: { bytes: new Uint8Array([1, 2, 3]), type: 'image/jpeg' },
    web: { bytes: new Uint8Array([4, 5]), type: 'image/webp' },
    thumb: { bytes: new Uint8Array([6]), type: 'image/webp' },
    meta: { original_filename: 'shot.jpg', mime: 'image/jpeg', width: 4000, height: 3000, bytes: 3 },
  });

  assert.match(photo.original_key, /^originals\/[0-9a-f-]+\.jpg$/);
  assert.equal(photo.web_key, `web/${photo.id}.webp`);
  assert.equal(photo.thumb_key, `thumbs/${photo.id}.webp`);
  assert.ok(await store.getObject(photo.original_key));

  await c.removePhoto(store, photo.id);
  // Bytes still present after soft delete.
  assert.ok(await store.getObject(photo.web_key), 'web object must survive soft delete');

  const result = await c.emptyTrash(store);
  assert.equal(result.counts.photos, 1);
  assert.equal(result.removedPhotoObjects, 3);
  assert.equal(await store.getObject(photo.original_key), null);
});

test('export returns every table, including trashed rows', async () => {
  const store = new MemoryStore();
  const adv = await seedAdventure(store);
  const legA = await c.legs.create(store, { adventure_id: adv.id, flight_date: '2026-05-01', dep_icao: 'EDDF' });
  await c.legs.remove(store, legA.id);

  const dump = await c.exportAll(store);
  assert.equal(dump.app, 'TALLY JOURNEY');
  assert.equal(dump.data.adventures.length, 1);
  assert.equal(dump.data.legs.length, 1); // trashed leg still exported
  assert.ok(dump.data.legs[0].deleted_at);
});
