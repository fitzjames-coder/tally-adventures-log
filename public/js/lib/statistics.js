// Flight statistics, computed from legs only. Planned destinations and draft
// legs never count here. Pure ES module: imported by the Statistics view in the
// browser and exercised directly under `node --test`.

function isLive(row) {
  return row && (row.deleted_at === null || row.deleted_at === undefined);
}

function isFlown(leg) {
  return isLive(leg) && leg.status === 'flown';
}

/** Format minutes as "Hh Mm" (e.g. 754 -> "12h 34m", 0 -> "0m"). */
export function formatDuration(totalMinutes) {
  const m = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h === 0) return `${mins}m`;
  return `${h}h ${mins}m`;
}

/**
 * @param {Array} legs     all live legs (any status)
 * @param {Array} moments  all live moments (optional)
 * @returns statistics computed from flown legs only
 */
export function computeStatistics(legs = [], moments = []) {
  const flown = legs.filter(isFlown);
  const flownIds = new Set(flown.map((l) => l.id));

  let timeInAirMin = 0;
  let distanceNm = 0;
  const rules = { VFR: 0, IFR: 0, unspecified: 0 };
  const light = { Day: 0, Night: 0, unspecified: 0 };
  const byAircraft = new Map();

  for (const leg of flown) {
    timeInAirMin += Number(leg.duration_min) || 0;
    distanceNm += Number(leg.distance_nm) || 0;

    if (leg.rules === 'VFR' || leg.rules === 'IFR') rules[leg.rules] += 1;
    else rules.unspecified += 1;

    if (leg.light === 'Day' || leg.light === 'Night') light[leg.light] += 1;
    else light.unspecified += 1;

    const type = (leg.aircraft_type || '').trim();
    if (type) {
      const entry = byAircraft.get(type) || { type, count: 0, distanceNm: 0, timeInAirMin: 0 };
      entry.count += 1;
      entry.distanceNm += Number(leg.distance_nm) || 0;
      entry.timeInAirMin += Number(leg.duration_min) || 0;
      byAircraft.set(type, entry);
    }
  }

  const momentsCount = moments.filter(
    (m) => isLive(m) && flownIds.has(m.leg_id)
  ).length;

  const aircraft = [...byAircraft.values()].sort(
    (a, b) => b.count - a.count || a.type.localeCompare(b.type)
  );

  return {
    flightsFlown: flown.length,
    timeInAirMin,
    timeInAirText: formatDuration(timeInAirMin),
    distanceNm: Math.round(distanceNm * 10) / 10,
    momentsCount,
    rules,
    light,
    aircraft,
  };
}
