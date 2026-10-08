import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeStatistics, formatDuration } from '../public/js/lib/statistics.js';

const leg = (over) => ({
  id: over.id,
  status: 'flown',
  deleted_at: null,
  duration_min: 0,
  distance_nm: 0,
  rules: null,
  light: null,
  aircraft_type: null,
  ...over,
});

test('formatDuration renders hours and minutes', () => {
  assert.equal(formatDuration(0), '0m');
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(60), '1h 0m');
  assert.equal(formatDuration(754), '12h 34m');
});

test('only flown legs count; drafts and trashed legs are ignored', () => {
  const legs = [
    leg({ id: 'f1', status: 'flown', duration_min: 60, distance_nm: 100, rules: 'VFR', light: 'Day', aircraft_type: 'C172' }),
    leg({ id: 'f2', status: 'flown', duration_min: 90, distance_nm: 150, rules: 'IFR', light: 'Night', aircraft_type: 'C172' }),
    leg({ id: 'd1', status: 'draft', duration_min: 999, distance_nm: 999, rules: 'VFR', light: 'Day', aircraft_type: 'C172' }),
    leg({ id: 'x1', status: 'flown', duration_min: 500, distance_nm: 500, deleted_at: '2026-01-01T00:00:00Z' }),
  ];
  const stats = computeStatistics(legs, []);

  assert.equal(stats.flightsFlown, 2);
  assert.equal(stats.timeInAirMin, 150);
  assert.equal(stats.timeInAirText, '2h 30m');
  assert.equal(stats.distanceNm, 250);
  assert.deepEqual(stats.rules, { VFR: 1, IFR: 1, unspecified: 0 });
  assert.deepEqual(stats.light, { Day: 1, Night: 1, unspecified: 0 });
});

test('aircraft usage aggregates flown legs only', () => {
  const legs = [
    leg({ id: 'f1', status: 'flown', aircraft_type: 'TBM 930', duration_min: 60, distance_nm: 200 }),
    leg({ id: 'f2', status: 'flown', aircraft_type: 'TBM 930', duration_min: 30, distance_nm: 100 }),
    leg({ id: 'f3', status: 'flown', aircraft_type: 'C172', duration_min: 45, distance_nm: 50 }),
    leg({ id: 'd1', status: 'draft', aircraft_type: 'A320', duration_min: 999 }),
  ];
  const stats = computeStatistics(legs, []);
  assert.equal(stats.aircraft.length, 2);
  assert.deepEqual(stats.aircraft[0], { type: 'TBM 930', count: 2, distanceNm: 300, timeInAirMin: 90 });
  assert.equal(stats.aircraft[1].type, 'C172');
  assert.ok(!stats.aircraft.some((a) => a.type === 'A320'));
});

test('moments count only those on flown, live legs', () => {
  const legs = [
    leg({ id: 'f1', status: 'flown' }),
    leg({ id: 'd1', status: 'draft' }),
  ];
  const moments = [
    { id: 'm1', leg_id: 'f1', deleted_at: null },
    { id: 'm2', leg_id: 'f1', deleted_at: null },
    { id: 'm3', leg_id: 'd1', deleted_at: null }, // draft leg -> excluded
    { id: 'm4', leg_id: 'f1', deleted_at: '2026-01-01T00:00:00Z' }, // trashed -> excluded
  ];
  const stats = computeStatistics(legs, moments);
  assert.equal(stats.momentsCount, 2);
});

test('no legs flown yields an all-zero, install-ready summary', () => {
  const stats = computeStatistics([], []);
  assert.equal(stats.flightsFlown, 0);
  assert.equal(stats.timeInAirMin, 0);
  assert.equal(stats.distanceNm, 0);
  assert.equal(stats.momentsCount, 0);
  assert.deepEqual(stats.aircraft, []);
});
