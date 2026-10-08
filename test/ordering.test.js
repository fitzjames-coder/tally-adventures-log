import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryStore } from '../src/lib/memstore.js';
import * as c from '../src/api/controllers.js';

test('chapters list in flying order (sort_order), not insertion order', async () => {
  const store = new MemoryStore();
  await c.chapters.create(store, { title: 'Third', sort_order: 2 });
  await c.chapters.create(store, { title: 'First', sort_order: 0 });
  await c.chapters.create(store, { title: 'Second', sort_order: 1 });

  const titles = (await c.chapters.list(store)).map((ch) => ch.title);
  assert.deepEqual(titles, ['First', 'Second', 'Third']);
});

test('paragraphs list by sort_order within their chapter', async () => {
  const store = new MemoryStore();
  const chapter = await c.chapters.create(store, { title: 'Chapter' });
  const other = await c.chapters.create(store, { title: 'Other chapter' });
  await c.paragraphs.create(store, { chapter_id: chapter.id, title: 'P3', sort_order: 2 });
  await c.paragraphs.create(store, { chapter_id: chapter.id, title: 'P1', sort_order: 0 });
  await c.paragraphs.create(store, { chapter_id: chapter.id, title: 'P2', sort_order: 1 });
  await c.paragraphs.create(store, { chapter_id: other.id, title: 'Elsewhere', sort_order: 0 });

  const titles = (await c.paragraphs.list(store, { chapter_id: chapter.id })).map((p) => p.title);
  assert.deepEqual(titles, ['P1', 'P2', 'P3']);
});

test('legs (sentences) list by leg number within a paragraph', async () => {
  const store = new MemoryStore();
  const chapter = await c.chapters.create(store, { title: 'Chapter' });
  const para = await c.paragraphs.create(store, { chapter_id: chapter.id, title: 'Paragraph' });

  await c.legs.create(store, { paragraph_id: para.id, dep_icao: 'AAAA', number: 3 });
  await c.legs.create(store, { paragraph_id: para.id, dep_icao: 'BBBB', number: 1 });
  await c.legs.create(store, { paragraph_id: para.id, dep_icao: 'CCCC', number: 2 });

  const numbers = (await c.legs.list(store, { paragraph_id: para.id })).map((l) => l.number);
  assert.deepEqual(numbers, [1, 2, 3]);
});

test('a planned leg needs no date and never counts as flown', async () => {
  const store = new MemoryStore();
  const chapter = await c.chapters.create(store, { title: 'Chapter' });
  const para = await c.paragraphs.create(store, { chapter_id: chapter.id, title: 'Paragraph' });

  const leg = await c.legs.create(store, { paragraph_id: para.id, dep_icao: 'EGPK', arr_icao: 'EKVG', status: 'draft' });
  assert.equal(leg.flight_date, '');       // no date for a planned leg
  assert.equal(leg.adventure_id, '');      // legacy link stays empty
  assert.equal(leg.status, 'draft');
});
