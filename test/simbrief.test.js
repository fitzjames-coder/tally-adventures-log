import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { mapSimbriefToPlanned, buildSimbriefUrl } from '../src/lib/simbrief.js';

const here = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(join(here, 'fixtures', 'simbrief-sample.json'), 'utf8'));

test('SimBrief maps into PLANNED fields only (from a saved fixture, no network)', () => {
  const { planned, info } = mapSimbriefToPlanned(sample);

  assert.equal(planned.planned_route, 'GIRVA UL612 BLACA DCT RATSU DCT EMBOK DCT GUNPA');
  assert.equal(planned.planned_cruise_alt, 'FL280');       // 28000 ft -> FL280
  assert.equal(planned.planned_block_fuel, '4200 kgs');    // plan_ramp + units
  assert.equal(planned.planned_ete_min, 150);              // 9000 s -> 150 min
  assert.equal(planned.planned_tas_kt, 285);
  assert.equal(planned.planned_alternate_icao, 'BGBW');
  assert.equal(planned.planned_reserve_min, 45);           // 2700 s -> 45 min
  assert.equal(planned.simbrief_ofp_ref, '987654321');

  // Nothing that is a flown field may appear.
  for (const key of Object.keys(planned)) {
    assert.ok(key.startsWith('planned_') || key === 'simbrief_ofp_ref', `unexpected field ${key}`);
  }
  assert.ok(!('dep_icao' in planned));
  assert.ok(!('flight_date' in planned));
  assert.ok(!('aircraft_type' in planned));

  // Preview info (not saved).
  assert.equal(info.origin, 'EGPK');
  assert.equal(info.destination, 'BIKF');
  assert.equal(info.aircraft, 'Airbus A320');
});

test('SimBrief URL uses username vs userid correctly', () => {
  assert.equal(buildSimbriefUrl('fitzjames'), 'https://www.simbrief.com/api/xml.fetcher.php?username=fitzjames&json=1');
  assert.equal(buildSimbriefUrl('123456'), 'https://www.simbrief.com/api/xml.fetcher.php?userid=123456&json=1');
});

test('SimBrief falls back to navlog TAS and clear-errors on empty data', () => {
  const noDirect = JSON.parse(JSON.stringify(sample));
  delete noDirect.general.cruise_tas;
  const { planned } = mapSimbriefToPlanned(noDirect);
  assert.equal(planned.planned_tas_kt, 285); // avg of 280 and 290

  assert.throws(() => mapSimbriefToPlanned({}), /no flight-plan fields|no usable data/i);
  assert.throws(() => mapSimbriefToPlanned({ fetch: { status: 'Error: user not found' } }), /SimBrief/i);
});
