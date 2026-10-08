// The data model, in one place. Drives validation and persistence so the
// column list, the API contract and the SQL stay in sync.
//
// Field types:
//   string    short single-line text
//   text      long multi-line text
//   enum      one of `values` (optionally with `default`)
//   date      calendar date, YYYY-MM-DD
//   datetime  ISO-8601 instant
//   int       integer
//   number    floating point
//   bool      stored as 0/1
//   icao      aerodrome identifier, 2-8 letters/digits, upper-cased
//   id        reference to another row's id
//   json      arbitrary JSON (stored as a string); use `shape` for structure
//
// `required: true` means the field must be present and non-empty on create.

export const TABLES = {
  adventures: {
    fields: {
      title: { type: 'string', required: true, max: 200 },
      subtitle: { type: 'string', max: 300 },
      description: { type: 'text' },
      status: { type: 'enum', values: ['planning', 'active', 'complete', 'archived'], default: 'planning' },
      start_date: { type: 'date' },
      end_date: { type: 'date' },
      cover_photo_id: { type: 'id' },
    },
  },

  destinations: {
    fields: {
      adventure_id: { type: 'id', required: true },
      name: { type: 'string', required: true, max: 200 },
      country_code: { type: 'string', max: 3 },
      tier: { type: 'enum', values: ['core', 'significant', 'optional'], default: 'significant' },
      sort_order: { type: 'int', default: 0 },
      status: { type: 'enum', values: ['planned', 'visited'], default: 'planned' },
      description: { type: 'text' },
    },
  },

  legs: {
    fields: {
      adventure_id: { type: 'id', required: true },
      number: { type: 'int', min: 0 },
      title: { type: 'string', max: 200 },
      status: { type: 'enum', values: ['draft', 'flown'], default: 'draft' },
      // departure airport and date are the only user-facing required fields.
      flight_date: { type: 'date', required: true },
      dep_icao: { type: 'icao', required: true },
      dep_name: { type: 'string', max: 200 },
      arr_icao: { type: 'icao' },
      arr_name: { type: 'string', max: 200 },
      diverted_to_icao: { type: 'icao' },
      diversion_note: { type: 'text' },
      aircraft_type: { type: 'string', max: 100 },
      registration: { type: 'string', max: 30 },
      callsign: { type: 'string', max: 30 },
      rules: { type: 'enum', values: ['VFR', 'IFR'] },
      light: { type: 'enum', values: ['Day', 'Night'] },
      distance_nm: { type: 'number', min: 0 },
      duration_min: { type: 'int', min: 0 },
      route_text: { type: 'text' },
      quick_notes: { type: 'json', shape: 'string-array' },
      journal: { type: 'text' },
      pilot_notes: { type: 'json', shape: 'pilot-notes' },
      hero_photo_id: { type: 'id' },
    },
  },

  leg_destinations: {
    fields: {
      leg_id: { type: 'id', required: true },
      destination_id: { type: 'id', required: true },
    },
  },

  photos: {
    fields: {
      original_filename: { type: 'string', max: 400 },
      mime: { type: 'string', max: 100 },
      width: { type: 'int', min: 0 },
      height: { type: 'int', min: 0 },
      bytes: { type: 'int', min: 0 },
      sha256: { type: 'string', max: 128 },
      original_key: { type: 'string', max: 300 },
      web_key: { type: 'string', max: 300 },
      thumb_key: { type: 'string', max: 300 },
      alt: { type: 'string', max: 500 },
      caption: { type: 'text' },
      taken_at: { type: 'datetime' },
    },
  },

  moments: {
    fields: {
      leg_id: { type: 'id', required: true },
      photo_id: { type: 'id' },
      phase: { type: 'enum', values: ['pre-departure', 'departure', 'en-route', 'approach', 'arrival'], required: true },
      title: { type: 'string', max: 200 },
      caption: { type: 'text' },
      note: { type: 'text' },
      time_text: { type: 'string', max: 50 },
      place_text: { type: 'string', max: 200 },
      sort_order: { type: 'int', default: 0 },
      favorite: { type: 'bool', default: false },
    },
  },
};

// The five flight phases, in order, used by filters and empty states.
export const PHASES = ['pre-departure', 'departure', 'en-route', 'approach', 'arrival'];

export const TABLE_NAMES = Object.keys(TABLES);

// The user-editable columns of a table (excludes id/created_at/updated_at/deleted_at).
export function columnsOf(table) {
  return Object.keys(TABLES[table].fields);
}

// Columns that hold JSON (stored as text, parsed on the way out).
export function jsonColumnsOf(table) {
  return Object.entries(TABLES[table].fields)
    .filter(([, f]) => f.type === 'json')
    .map(([name]) => name);
}

export function isTable(table) {
  return Object.prototype.hasOwnProperty.call(TABLES, table);
}
