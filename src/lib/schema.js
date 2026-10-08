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
      // Legacy link (PR #1). Kept additive; legs now hang off paragraphs.
      adventure_id: { type: 'id', default: '' },
      // Book structure (PR #2): a leg (sentence) belongs to a paragraph.
      paragraph_id: { type: 'id' },
      number: { type: 'int', min: 0 },
      title: { type: 'string', max: 200 },
      status: { type: 'enum', values: ['draft', 'flown'], default: 'draft' },
      // Departure is the only hard-required leg field; a planned leg may have
      // no date yet (shown as "Planned"). flight_date defaults to '' so the
      // NOT NULL column from 0001 stays satisfied.
      flight_date: { type: 'date', default: '' },
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
      // Planned flight plan (kept separate from what was flown). Populated by
      // hand or by the SimBrief import; the import never touches flown fields.
      planned_route: { type: 'text' },
      planned_cruise_alt: { type: 'string', max: 20 },
      planned_block_fuel: { type: 'string', max: 40 },
      planned_ete_min: { type: 'int', min: 0 },
      planned_tas_kt: { type: 'int', min: 0 },
      planned_alternate_icao: { type: 'icao' },
      planned_reserve_min: { type: 'int', min: 0 },
      simbrief_ofp_ref: { type: 'string', max: 120 },
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

  // --- Book structure (PR #2) ---

  // Chapter = a big destination. Ordered by flying order (sort_order).
  chapters: {
    fields: {
      title: { type: 'string', required: true, max: 200 },
      subtitle: { type: 'string', max: 300 },
      summary: { type: 'text' },
      sort_order: { type: 'int', default: 0 },
      career_tag: { type: 'string', max: 120 },
      cover_photo_id: { type: 'id' },
      status: { type: 'enum', values: ['planned', 'in-progress', 'complete'], default: 'planned' },
    },
  },

  // Paragraph = a big chunk of flying inside a chapter.
  paragraphs: {
    fields: {
      chapter_id: { type: 'id', required: true },
      title: { type: 'string', required: true, max: 200 },
      summary: { type: 'text' },
      sort_order: { type: 'int', default: 0 },
      hero_photo_id: { type: 'id' },
    },
  },

  // Documents = OFP / Navigraph / other PDFs kept with a leg. Bytes live in R2
  // under docs/<uuid>.
  documents: {
    fields: {
      leg_id: { type: 'id', required: true },
      kind: { type: 'enum', values: ['ofp', 'navigraph', 'other'], default: 'other' },
      filename: { type: 'string', max: 400 },
      content_type: { type: 'string', max: 100 },
      size_bytes: { type: 'int', min: 0 },
      r2_key: { type: 'string', max: 300 },
    },
  },

  // Small key/value store for app settings (e.g. the SimBrief username / pilot
  // id). No sign-in; this is a single shared config.
  app_settings: {
    fields: {
      key: { type: 'string', required: true, max: 100 },
      value: { type: 'text' },
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
