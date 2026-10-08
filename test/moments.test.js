import { test } from 'node:test';
import assert from 'node:assert/strict';

import { alongTheWayEmpty } from '../public/js/lib/moments.js';

test('along-the-way: flown leg with no timed moments says "No moments yet."', () => {
  const copy = alongTheWayEmpty({ status: 'flown' }, false);
  assert.equal(copy.title, 'No moments yet.');
  assert.match(copy.text, /line up here/i);
});

test('along-the-way: planned/draft leg says "Not flown yet."', () => {
  const copy = alongTheWayEmpty({ status: 'draft' }, false);
  assert.equal(copy.title, 'Not flown yet.');
  assert.match(copy.text, /fills in after the flight/i);
});

test('along-the-way: a flown leg that does have timed moments is not treated as empty-flown', () => {
  // When timed moments exist the view renders the timeline; if this helper is
  // ever reached for such a leg it should not claim "No moments yet".
  const copy = alongTheWayEmpty({ status: 'flown' }, true);
  assert.equal(copy.title, 'Not flown yet.');
});
