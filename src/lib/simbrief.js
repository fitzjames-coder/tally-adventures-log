// Map a SimBrief OFP (xml.fetcher.php?json=1) into TALLY JOURNEY's PLANNED leg
// fields only. Pure and dependency-free so it can be unit-tested against a saved
// fixture with no live network call. It never produces flown-field values.

// Build the SimBrief fetch URL. Numeric input is treated as a pilot id.
export function buildSimbriefUrl(userOrId) {
  const v = String(userOrId).trim();
  const key = /^\d+$/.test(v) ? 'userid' : 'username';
  return `https://www.simbrief.com/api/xml.fetcher.php?${key}=${encodeURIComponent(v)}&json=1`;
}

function pick(obj, ...paths) {
  for (const path of paths) {
    let cur = obj;
    let ok = true;
    for (const key of path.split('.')) {
      if (cur && typeof cur === 'object' && key in cur) cur = cur[key];
      else { ok = false; break; }
    }
    if (ok && cur !== null && cur !== undefined && cur !== '') return cur;
  }
  return undefined;
}

function num(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function icao(v) {
  if (!v) return undefined;
  const s = String(v).trim().toUpperCase();
  return /^[A-Z0-9]{2,8}$/.test(s) ? s : undefined;
}

// Feet -> "FLxxx" (e.g. 8500 -> "FL085"). SimBrief gives altitude in feet.
function flightLevel(feetRaw) {
  const feet = num(feetRaw);
  if (feet === undefined) return undefined;
  return 'FL' + String(Math.round(feet / 100)).padStart(3, '0');
}

function secToMin(v) {
  const n = num(v);
  return n === undefined ? undefined : Math.round(n / 60);
}

function alternateIcao(json) {
  const alt = json.alternate;
  if (Array.isArray(alt)) return icao(alt[0] && alt[0].icao_code);
  if (alt && typeof alt === 'object') return icao(alt.icao_code);
  return undefined;
}

// Average TAS: SimBrief doesn't expose a single cruise TAS reliably, so fall
// back through a few plausible locations, ending at the navlog fixes.
function cruiseTas(json) {
  const direct = num(pick(json, 'general.cruise_tas', 'general.avg_tas', 'aircraft.cruise_tas'));
  if (direct !== undefined) return direct;
  const fixes = json.navlog && Array.isArray(json.navlog.fix) ? json.navlog.fix : [];
  const speeds = fixes.map((f) => num(f && f.true_airspeed)).filter((n) => n !== undefined && n > 0);
  if (!speeds.length) return undefined;
  return Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length);
}

function blockFuel(json) {
  const ramp = pick(json, 'fuel.plan_ramp', 'fuel.block', 'fuel.plan_takeoff');
  if (ramp === undefined) return undefined;
  const units = pick(json, 'params.units', 'aircraft.units');
  return units ? `${ramp} ${units}` : String(ramp);
}

/**
 * @param {object} json  SimBrief OFP JSON
 * @returns {{ planned: object, info: object }}
 *   planned: only the PLANNED leg columns, with undefined values omitted.
 *   info: origin/destination/aircraft for the confirmation preview (not saved).
 */
export function mapSimbriefToPlanned(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('SimBrief returned no usable data.');
  }
  if (json.fetch && json.fetch.status && !/success/i.test(String(json.fetch.status))) {
    throw new Error(`SimBrief: ${json.fetch.status}`);
  }

  const planned = {
    planned_route: pick(json, 'general.route'),
    planned_cruise_alt: flightLevel(pick(json, 'general.initial_altitude', 'general.cruise_altitude')),
    planned_block_fuel: blockFuel(json),
    planned_ete_min: secToMin(pick(json, 'times.est_time_enroute', 'times.sched_time_enroute')),
    planned_tas_kt: cruiseTas(json),
    planned_alternate_icao: alternateIcao(json),
    planned_reserve_min: secToMin(pick(json, 'times.reserve_time', 'fuel.reserve_time')),
    simbrief_ofp_ref: pick(json, 'params.request_id', 'params.ofp_layout'),
  };

  for (const k of Object.keys(planned)) {
    if (planned[k] === undefined) delete planned[k];
  }

  if (Object.keys(planned).length === 0) {
    throw new Error('SimBrief returned no flight-plan fields to import.');
  }

  const info = {
    origin: icao(pick(json, 'origin.icao_code')),
    destination: icao(pick(json, 'destination.icao_code')),
    aircraft: pick(json, 'aircraft.name', 'aircraft.icao_code', 'aircraft.base_type'),
    ofp_ref: planned.simbrief_ofp_ref,
    generated_at: pick(json, 'params.time_generated'),
  };

  return { planned, info };
}
