// Fetch the bundled fonts into public/fonts so the repository itself stays free
// of binary blobs. Run once after `npm install` (it also runs before `npm run
// dev` and `npm run deploy`). Requires Node 18+ for global fetch.
//
// The airplane-mark icons are committed as SVG (public/icons/*.svg); only the
// B612 TTFs are fetched here. OFL.txt (the font license) is committed.

import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = join(ROOT, 'public', 'fonts');

// Pinned to the B612 family in the Google Fonts repository.
const BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/b612';
const FILES = ['B612-Regular.ttf', 'B612-Bold.ttf'];

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function main() {
  await mkdir(FONT_DIR, { recursive: true });
  for (const name of FILES) {
    const dest = join(FONT_DIR, name);
    if (await exists(dest)) {
      console.log(`✓ ${name} already present`);
      continue;
    }
    const url = `${BASE}/${name}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    console.log(`↓ ${name} (${buf.length} bytes)`);
  }
  console.log('Fonts ready in public/fonts.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
