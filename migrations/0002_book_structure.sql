-- TALLY JOURNEY - book structure (milestone 2).
-- ADDITIVE ONLY: new tables and new columns. No DROP, no RENAME.
-- The legacy `adventures` table stays in the database but leaves the UI.
-- Do NOT apply this to the live database automatically; it is applied after
-- review. The app ships empty: no seed rows of any kind.

-- Chapter = a big destination. Ordered by flying order (sort_order).
CREATE TABLE chapters (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  subtitle       TEXT,
  summary        TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  career_tag     TEXT,                              -- optional free-text label
  cover_photo_id TEXT,
  status         TEXT NOT NULL DEFAULT 'planned',   -- planned | in-progress | complete
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT
);

-- Paragraph = a big chunk of flying inside a chapter.
CREATE TABLE paragraphs (
  id            TEXT PRIMARY KEY,
  chapter_id    TEXT NOT NULL,
  title         TEXT NOT NULL,
  summary       TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  hero_photo_id TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);

-- Documents = OFP / Navigraph / other PDFs kept with a leg. Bytes in R2 docs/.
CREATE TABLE documents (
  id           TEXT PRIMARY KEY,
  leg_id       TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'other',       -- ofp | navigraph | other
  filename     TEXT,
  content_type TEXT,
  size_bytes   INTEGER,
  r2_key       TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

-- Key/value app settings (e.g. SimBrief username / pilot id). No sign-in.
CREATE TABLE app_settings (
  id         TEXT PRIMARY KEY,
  key        TEXT NOT NULL,
  value      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

-- New columns on legs: paragraph link + planned flight-plan fields.
ALTER TABLE legs ADD COLUMN paragraph_id          TEXT;
ALTER TABLE legs ADD COLUMN planned_route         TEXT;
ALTER TABLE legs ADD COLUMN planned_cruise_alt    TEXT;
ALTER TABLE legs ADD COLUMN planned_block_fuel    TEXT;
ALTER TABLE legs ADD COLUMN planned_ete_min       INTEGER;
ALTER TABLE legs ADD COLUMN planned_tas_kt        INTEGER;
ALTER TABLE legs ADD COLUMN planned_alternate_icao TEXT;
ALTER TABLE legs ADD COLUMN planned_reserve_min   INTEGER;
ALTER TABLE legs ADD COLUMN simbrief_ofp_ref      TEXT;

CREATE INDEX idx_paragraphs_chapter   ON paragraphs (chapter_id);
CREATE INDEX idx_legs_paragraph       ON legs (paragraph_id);
CREATE INDEX idx_documents_leg        ON documents (leg_id);
CREATE INDEX idx_app_settings_key     ON app_settings (key);

CREATE INDEX idx_chapters_deleted     ON chapters (deleted_at);
CREATE INDEX idx_paragraphs_deleted   ON paragraphs (deleted_at);
CREATE INDEX idx_documents_deleted    ON documents (deleted_at);
