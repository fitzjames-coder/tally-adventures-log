# TALLY ADVENTURES Log

A cloud PWA flight journal for Microsoft Flight Simulator trips. One Cloudflare
Worker serves the static app shell plus a JSON API, backed by a D1 database and
an R2 photo bucket. No sign-in, by design.

This is **milestone 1 — the foundation**: the data model, the API, and the full
app shell (Journal, Map, Photos, Statistics, Settings, Trash). The app ships
**empty** — every title, tagline, route and photo comes from the database.

## Stack

- Plain HTML, CSS and JavaScript ES modules. No framework, no CSS library.
- Cloudflare Worker with static assets (Wrangler). Only dev dependency: `wrangler`.
  No runtime packages.
- D1 (SQLite) via schema migrations in `./migrations`.
- R2 for photo bytes (originals + web + thumbnail).

## Project layout

```
public/            static app shell (served by the Worker's ASSETS binding)
  index.html
  css/styles.css   design system (navy / amber / cream tokens)
  js/              ES modules: views, UI, API client, image resizing
  js/lib/          statistics.js (shared with the test suite)
  css/fonts.css    @font-face for B612 (fetched into fonts/ by `npm run setup`)
  fonts/OFL.txt    SIL Open Font License for B612
  icons/           airplane-mark icons (SVG)
  manifest.webmanifest, sw.js
scripts/
  setup-assets.mjs fetches the B612 TTFs into public/fonts
src/
  worker.js        routing for /api and /media, static fallback
  api/controllers.js   store-agnostic business logic
  lib/             schema, validation, serialization, D1 + in-memory stores
migrations/        D1 schema (0001_init.sql)
test/              node --test suites
wrangler.jsonc
```

## Run locally

Requires Node 18+.

```sh
npm install                 # installs wrangler (dev dependency only)
npm run setup               # fetches the B612 fonts into public/fonts

# Apply the schema to the local D1 database once:
npx wrangler d1 migrations apply tally-adventures-log-db --local

# Start the dev server (Worker + static assets + local D1 + local R2):
npm run dev                 # runs setup automatically, then wrangler dev
```

> `npm run dev` runs the asset setup first (via the `predev` hook). Fonts are
> fetched rather than committed so the repository stays free of binary blobs;
> the airplane-mark icons are committed as SVG.

Then open the printed URL (default http://127.0.0.1:8787). The app starts empty;
create your first adventure from the sidebar, then log a flight.

> This project only binds to the existing D1 database and R2 bucket. It never
> creates Cloudflare resources and does not deploy.

## Tests

```sh
npm test            # node --test
```

Covers API input validation, flown-only statistics (drafts and planned
destinations never count), trash restore, and the rule that the only hard delete
is "Empty trash".

## Principles baked in

- **Delete never erases.** Deleting sets `deleted_at` and moves the item to
  Trash with Restore. Only "Empty trash" (with an in-page confirmation) hard
  deletes.
- **Photos load lazily.** Thumbnails load on scroll; the web size loads when a
  photo is opened or is a hero on screen; the original only on an explicit tap.
- **Resize on the device.** The original file is kept untouched; a web copy
  (1600px WebP) and thumbnail (480px WebP) are made in the browser and all three
  are uploaded. R2 keys use random photo UUIDs, never filenames.
- **No sign-in. No landing counts.**

## API

`/api` returns JSON and validates every input:

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/api/adventures` · `/destinations` · `/legs` · `/moments` | list / create |
| GET/PATCH/DELETE | `.../:id` | read / update / soft-delete |
| POST | `/api/legs/:id/moments/reorder` | reorder moments in a leg |
| POST | `/api/photos` | multipart upload (original, web, thumb) |
| PATCH/DELETE | `/api/photos/:id` | edit metadata / soft-delete |
| GET | `/api/trash` | list trashed items |
| POST | `/api/trash/restore` · `/api/trash/empty` | restore / hard-delete all |
| GET | `/api/export` | every record as one JSON file |
| GET | `/media/<key>` | photo bytes with long-cache headers |
