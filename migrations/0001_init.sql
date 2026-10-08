-- TALLY ADVENTURES Log - initial schema (milestone 1)
-- Every row carries id, created_at, updated_at, deleted_at.
-- Soft delete: deleted_at IS NULL means live; a timestamp means trashed.
-- The app ships empty: no seed rows of any kind.

-- Adventures: a themed trip made up of planned destinations and flown legs.
CREATE TABLE adventures (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  subtitle       TEXT,
  description    TEXT,
  status         TEXT NOT NULL DEFAULT 'planning',
  start_date     TEXT,
  end_date       TEXT,
  cover_photo_id TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT
);

-- Destinations: planned story places. These never create flights and never
-- count in statistics.
CREATE TABLE destinations (
  id           TEXT PRIMARY KEY,
  adventure_id TEXT NOT NULL,
  name         TEXT NOT NULL,
  country_code TEXT,
  tier         TEXT NOT NULL DEFAULT 'significant', -- core | significant | optional
  sort_order   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'planned',      -- planned | visited
  description  TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

-- Legs: actual flights flown. Only legs with status 'flown' count in statistics.
CREATE TABLE legs (
  id                TEXT PRIMARY KEY,
  adventure_id      TEXT NOT NULL,
  number            INTEGER,
  title             TEXT,
  status            TEXT NOT NULL DEFAULT 'draft',   -- draft | flown
  flight_date       TEXT NOT NULL,
  dep_icao          TEXT NOT NULL,
  dep_name          TEXT,
  arr_icao          TEXT,
  arr_name          TEXT,
  diverted_to_icao  TEXT,
  diversion_note    TEXT,
  aircraft_type     TEXT,
  registration      TEXT,
  callsign          TEXT,
  rules             TEXT,                            -- VFR | IFR
  light             TEXT,                            -- Day | Night
  distance_nm       REAL,
  duration_min      INTEGER,
  route_text        TEXT,
  quick_notes       TEXT,                            -- JSON array of strings
  journal           TEXT,
  pilot_notes       TEXT,                            -- JSON array of {kind, text}
  hero_photo_id     TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  deleted_at        TEXT
);

-- Which destinations a given leg visited (many-to-many).
CREATE TABLE leg_destinations (
  id             TEXT PRIMARY KEY,
  leg_id         TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT
);

-- Photos: metadata only. Bytes live in R2 under the three keys below.
CREATE TABLE photos (
  id                TEXT PRIMARY KEY,
  original_filename TEXT,
  mime              TEXT,
  width             INTEGER,
  height            INTEGER,
  bytes             INTEGER,
  sha256            TEXT,
  original_key      TEXT,
  web_key           TEXT,
  thumb_key         TEXT,
  alt               TEXT,
  caption           TEXT,
  taken_at          TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  deleted_at        TEXT
);

-- Moments: a beat in a flight, optionally illustrated by a photo.
CREATE TABLE moments (
  id          TEXT PRIMARY KEY,
  leg_id      TEXT NOT NULL,
  photo_id    TEXT,
  phase       TEXT NOT NULL,   -- pre-departure | departure | en-route | approach | arrival
  title       TEXT,
  caption     TEXT,
  note        TEXT,
  time_text   TEXT,
  place_text  TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  favorite    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE INDEX idx_destinations_adventure ON destinations (adventure_id);
CREATE INDEX idx_legs_adventure         ON legs (adventure_id);
CREATE INDEX idx_moments_leg            ON moments (leg_id);
CREATE INDEX idx_leg_destinations_leg   ON leg_destinations (leg_id);
CREATE INDEX idx_leg_destinations_dest  ON leg_destinations (destination_id);

CREATE INDEX idx_adventures_deleted   ON adventures (deleted_at);
CREATE INDEX idx_destinations_deleted ON destinations (deleted_at);
CREATE INDEX idx_legs_deleted         ON legs (deleted_at);
CREATE INDEX idx_moments_deleted      ON moments (deleted_at);
CREATE INDEX idx_photos_deleted       ON photos (deleted_at);
