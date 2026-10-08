import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryStore } from '../src/lib/memstore.js';
import * as c from '../src/api/controllers.js';

async function trashTypes(store) {
  return (await c.listTrash(store)).map((i) => i.type);
}

test('chapters: delete -> trash -> restore', async () => {
  const store = new MemoryStore();
  const ch = await c.chapters.create(store, { title: 'A chapter' });

  await c.chapters.remove(store, ch.id);
  assert.equal((await c.chapters.list(store)).length, 0);
  assert.ok((await trashTypes(store)).includes('chapters'));

  const restored = await c.restore(store, { type: 'chapters', id: ch.id });
  assert.equal(restored.deleted_at, null);
  assert.equal((await c.chapters.list(store)).length, 1);
});

test('paragraphs: delete -> trash -> restore', async () => {
  const store = new MemoryStore();
  const ch = await c.chapters.create(store, { title: 'Chapter' });
  const p = await c.paragraphs.create(store, { chapter_id: ch.id, title: 'A paragraph' });

  await c.paragraphs.remove(store, p.id);
  assert.equal((await c.paragraphs.list(store, { chapter_id: ch.id })).length, 0);
  assert.ok((await trashTypes(store)).includes('paragraphs'));

  await c.restore(store, { type: 'paragraphs', id: p.id });
  assert.equal((await c.paragraphs.list(store, { chapter_id: ch.id })).length, 1);
});

test('documents: upload -> delete -> trash -> restore; bytes survive until empty-trash', async () => {
  const store = new MemoryStore();
  const ch = await c.chapters.create(store, { title: 'Chapter' });
  const para = await c.paragraphs.create(store, { chapter_id: ch.id, title: 'Paragraph' });
  const leg = await c.legs.create(store, { paragraph_id: para.id, dep_icao: 'EGPK' });

  const doc = await c.createDocument(store, {
    file: { bytes: new Uint8Array([1, 2, 3, 4]), type: 'application/pdf' },
    meta: { leg_id: leg.id, kind: 'ofp', filename: 'ofp.pdf' },
  });
  assert.match(doc.r2_key, /^docs\/[0-9a-f-]+\.pdf$/);
  assert.equal(doc.size_bytes, 4);
  assert.ok(await store.getObject(doc.r2_key));

  await c.documents.remove(store, doc.id);
  assert.equal((await c.documents.list(store, { leg_id: leg.id })).length, 0);
  assert.ok((await trashTypes(store)).includes('documents'));
  assert.ok(await store.getObject(doc.r2_key), 'bytes survive soft delete');

  await c.restore(store, { type: 'documents', id: doc.id });
  assert.equal((await c.documents.list(store, { leg_id: leg.id })).length, 1);

  // Now trash + empty: the object is purged and reported.
  await c.documents.remove(store, doc.id);
  const result = await c.emptyTrash(store);
  assert.equal(result.counts.documents, 1);
  assert.equal(result.removedDocObjects, 1);
  assert.equal(await store.getObject(doc.r2_key), null);
});
