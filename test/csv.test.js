import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryStore } from '../src/lib/memstore.js';
import * as c from '../src/api/controllers.js';
import { makeZip } from '../src/lib/zip.js';

// The CSV files are written out under their user-facing names. The underlying
// tables stay chapters/paragraphs; only the exported file names differ.
const EXPECTED_CSV_NAMES = ['destinations.csv', 'stages.csv', 'legs.csv', 'moments.csv', 'photos.csv', 'documents.csv'];

function parseCsv(text) {
  // Simple splitter sufficient for the shapes we assert on.
  const lines = text.replace(/\r\n/g, '\n').trimEnd().split('\n');
  return { header: lines[0].split(','), rows: lines.slice(1) };
}

async function seed(store) {
  const ch = await c.chapters.create(store, { title: 'Chapter one', sort_order: 0 });
  const para = await c.paragraphs.create(store, { chapter_id: ch.id, title: 'Paragraph one' });
  const flown = await c.legs.create(store, { paragraph_id: para.id, dep_icao: 'EGPK', arr_icao: 'EKVG', status: 'flown', flight_date: '2026-05-01', number: 1 });
  const planned = await c.legs.create(store, { paragraph_id: para.id, dep_icao: 'BIRK', arr_icao: 'BGKK', status: 'draft', number: 3, planned_tas_kt: 156 });
  await c.moments.create(store, { leg_id: flown.id, phase: 'en-route', title: 'Mid-point' });
  const photo = await c.createPhoto(store, {
    original: { bytes: new Uint8Array([1]), type: 'image/jpeg' },
    web: { bytes: new Uint8Array([2]), type: 'image/webp' },
    thumb: { bytes: new Uint8Array([3]), type: 'image/webp' },
    meta: { original_filename: 'shot.jpg', mime: 'image/jpeg' },
  });
  await c.createDocument(store, {
    file: { bytes: new Uint8Array([9, 9, 9]), type: 'application/pdf' },
    meta: { leg_id: flown.id, kind: 'ofp', filename: 'ofp.pdf' },
  });
  return { chapter: ch, paragraph: para, planned, photo };
}

test('CSV export covers every table, with keys and planned fields', async () => {
  const store = new MemoryStore();
  await seed(store);

  const files = await c.exportCsvFiles(store);
  const names = files.map((f) => f.name).sort();
  assert.deepEqual(names, [...EXPECTED_CSV_NAMES].sort());

  const byName = Object.fromEntries(files.map((f) => [f.name, f.content]));

  // photos CSV keeps the R2 keys
  const photosHead = parseCsv(byName['photos.csv']).header;
  for (const col of ['id', 'original_key', 'web_key', 'thumb_key', 'deleted_at']) {
    assert.ok(photosHead.includes(col), `photos.csv missing ${col}`);
  }
  // documents CSV keeps the r2_key
  assert.ok(parseCsv(byName['documents.csv']).header.includes('r2_key'));
  // legs CSV keeps planned fields (flown + planned kept together)
  const legsHead = parseCsv(byName['legs.csv']).header;
  for (const col of ['planned_route', 'planned_tas_kt', 'flight_date']) {
    assert.ok(legsHead.includes(col), `legs.csv missing ${col}`);
  }
  assert.equal(parseCsv(byName['legs.csv']).rows.length, 2); // flown + planned
});

test('CSV export uses journey file names and renamed id headers', async () => {
  const store = new MemoryStore();
  const { chapter, paragraph } = await seed(store);

  const files = await c.exportCsvFiles(store);
  const byName = Object.fromEntries(files.map((f) => [f.name, f.content]));

  // chapters -> destinations.csv, paragraphs -> stages.csv; legs.csv unchanged.
  assert.ok(byName['destinations.csv'], 'destinations.csv present');
  assert.ok(byName['stages.csv'], 'stages.csv present');
  assert.ok(byName['legs.csv'], 'legs.csv present');
  assert.ok(!byName['chapters.csv'], 'no chapters.csv');
  assert.ok(!byName['paragraphs.csv'], 'no paragraphs.csv');

  // stages.csv (paragraphs): chapter_id header becomes destination_id.
  const stages = parseCsv(byName['stages.csv']);
  assert.ok(stages.header.includes('destination_id'), 'stages.csv has destination_id header');
  assert.ok(!stages.header.includes('chapter_id'), 'stages.csv has no chapter_id header');

  // legs.csv: paragraph_id header becomes stage_id.
  const legs = parseCsv(byName['legs.csv']);
  assert.ok(legs.header.includes('stage_id'), 'legs.csv has stage_id header');
  assert.ok(!legs.header.includes('paragraph_id'), 'legs.csv has no paragraph_id header');

  // The rename is header-only: the data under it is unchanged.
  const destIdx = stages.header.indexOf('destination_id');
  assert.equal(stages.rows[0].split(',')[destIdx], chapter.id, 'destination_id column still holds the chapter id value');
  const stageIdx = legs.header.indexOf('stage_id');
  assert.equal(legs.rows[0].split(',')[stageIdx], paragraph.id, 'stage_id column still holds the paragraph id value');
});

test('CSV export includes trashed rows with deleted_at set', async () => {
  const store = new MemoryStore();
  const { planned } = await seed(store);
  await c.legs.remove(store, planned.id); // trash one leg

  const files = await c.exportCsvFiles(store);
  const legs = parseCsv(files.find((f) => f.name === 'legs.csv').content);
  assert.equal(legs.rows.length, 2, 'trashed leg still exported');
  const deletedIdx = legs.header.indexOf('deleted_at');
  const withDeleted = legs.rows.filter((r) => r.split(',')[deletedIdx]);
  assert.equal(withDeleted.length, 1, 'exactly one row has deleted_at set');
});

test('CSV files pack into a valid (readable) zip', async () => {
  const store = new MemoryStore();
  await seed(store);
  const files = await c.exportCsvFiles(store);
  const zip = makeZip(files.map((f) => ({ name: f.name, content: f.content })));
  assert.ok(zip instanceof Uint8Array && zip.length > 0);
  // Local file header + End-of-central-directory signatures present.
  assert.equal(zip[0], 0x50); assert.equal(zip[1], 0x4b); // "PK"
  const tail = zip.slice(zip.length - 22);
  assert.equal(tail[0], 0x50); assert.equal(tail[1], 0x4b);
  assert.equal(tail[2], 0x05); assert.equal(tail[3], 0x06); // EOCD
});
