import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validate } from '../src/lib/validation.js';
import { ApiError } from '../src/lib/errors.js';

test('adventures: title is required', () => {
  assert.throws(() => validate('adventures', {}), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 400);
    assert.ok(err.details.errors.some((m) => /title is required/i.test(m)));
    return true;
  });
});

test('adventures: status defaults to planning and rejects unknown values', () => {
  const ok = validate('adventures', { title: 'My Trip' });
  assert.equal(ok.title, 'My Trip');
  assert.equal(ok.status, 'planning');

  assert.throws(() => validate('adventures', { title: 'X', status: 'flying' }), /one of/i);
});

test('legs: departure and date are the only required fields', () => {
  assert.throws(() => validate('legs', { adventure_id: 'a1' }), (err) => {
    const joined = err.details.errors.join('\n');
    assert.match(joined, /flight_date is required/i);
    assert.match(joined, /dep_icao is required/i);
    return true;
  });

  // With adventure, date and departure it validates; other fields stay optional.
  const ok = validate('legs', { adventure_id: 'a1', flight_date: '2026-05-01', dep_icao: 'eddf' });
  assert.equal(ok.dep_icao, 'EDDF'); // upper-cased
  assert.equal(ok.status, 'draft'); // default
  assert.equal(ok.arr_icao, undefined); // not supplied, not required
});

test('legs: enums and numbers are checked', () => {
  assert.throws(() => validate('legs', {
    adventure_id: 'a1', flight_date: '2026-05-01', dep_icao: 'EDDF', rules: 'SVFR',
  }), /rules must be one of/i);

  const ok = validate('legs', {
    adventure_id: 'a1', flight_date: '2026-05-01', dep_icao: 'EDDF',
    rules: 'IFR', light: 'Night', distance_nm: 212.5, duration_min: 95,
  });
  assert.equal(ok.rules, 'IFR');
  assert.equal(ok.distance_nm, 212.5);
  assert.equal(ok.duration_min, 95);
});

test('legs: JSON columns are coerced and stored as strings', () => {
  const ok = validate('legs', {
    adventure_id: 'a1', flight_date: '2026-05-01', dep_icao: 'EDDF',
    quick_notes: ['smooth air', '  ', 'nice sunset'],
    pilot_notes: [
      { kind: 'positive', text: 'stable approach' },
      { kind: 'practice', text: 'earlier descent' },
      { kind: 'practice', text: '' }, // dropped
    ],
  });
  assert.deepEqual(JSON.parse(ok.quick_notes), ['smooth air', 'nice sunset']);
  assert.deepEqual(JSON.parse(ok.pilot_notes), [
    { kind: 'positive', text: 'stable approach' },
    { kind: 'practice', text: 'earlier descent' },
  ]);

  assert.throws(() => validate('legs', {
    adventure_id: 'a1', flight_date: '2026-05-01', dep_icao: 'EDDF',
    pilot_notes: [{ kind: 'bad', text: 'x' }],
  }), /kind must be/i);
});

test('destinations: require adventure and name, with tier/status defaults', () => {
  assert.throws(() => validate('destinations', { name: 'Somewhere' }), /adventure_id is required/i);
  const ok = validate('destinations', { adventure_id: 'a1', name: 'Somewhere' });
  assert.equal(ok.tier, 'significant');
  assert.equal(ok.status, 'planned');
});

test('destinations input can never become a leg: leg-only fields are ignored', () => {
  const values = validate('destinations', {
    adventure_id: 'a1',
    name: 'Somewhere',
    dep_icao: 'EDDF', // not part of destinations schema
    flight_date: '2026-05-01',
    status: 'planned',
  });
  assert.equal(values.dep_icao, undefined);
  assert.equal(values.flight_date, undefined);
  assert.ok('name' in values); // it really is a destination
});

test('moments: leg_id and phase required, phase is an enum', () => {
  assert.throws(() => validate('moments', { leg_id: 'l1' }), /phase is required/i);
  assert.throws(() => validate('moments', { leg_id: 'l1', phase: 'cruise' }), /phase must be one of/i);
  const ok = validate('moments', { leg_id: 'l1', phase: 'en-route', favorite: true });
  assert.equal(ok.phase, 'en-route');
  assert.equal(ok.favorite, 1);
});

test('partial update: blank clears an optional field, keeps required ones', () => {
  const patch = validate('legs', { arr_name: '' }, { partial: true });
  assert.equal(patch.arr_name, null);

  assert.throws(() => validate('legs', { dep_icao: '' }, { partial: true }), /cannot be empty/i);

  const only = validate('legs', { title: 'Short hop' }, { partial: true });
  assert.deepEqual(Object.keys(only), ['title']);
});
