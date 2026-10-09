// Guard against the old "book / chapter / paragraph / sentence" analogy leaking
// back into anything a user can read. The level words were renamed to
// journey / destination / stage / leg; the internal table, column, route and
// function names deliberately keep the old words, so this test checks only
// user-visible text — the contents of string literals (and HTML text / JSON
// values) — not identifiers, routes, CSS classes, comments or code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Singular or plural, any case, as a whole word.
const BANNED = /\b(book|chapter|paragraph|sentence)s?\b/i;

// A string is user-visible prose only if it holds whitespace (a phrase). Bare
// single tokens are routes ('#/book'), CSS classes ('chapter-card'), object
// keys / enum values ('book'), etc. — internal and allowed to keep the words.
function isProse(s) {
  return /\s/.test(s) && s.trim().length > 0;
}

// Walk a .js source and return the text content of every string literal.
// A real character scan (not a regex) so that comments, apostrophes inside
// comments, regex literals and `${...}` template expressions never confuse it.
function stringsInJs(src) {
  const out = [];
  const n = src.length;
  let i = 0;
  let prev = ''; // last significant (non-space) code character
  while (i < n) {
    const ch = src[i];
    // line comment
    if (ch === '/' && src[i + 1] === '/') { i += 2; while (i < n && src[i] !== '\n') i++; continue; }
    // block comment
    if (ch === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    // regex literal (only where a regex can start — not after a value)
    if (ch === '/' && !/[\w)\]]/.test(prev)) {
      i++; let inClass = false;
      while (i < n) {
        const c = src[i];
        if (c === '\\') { i += 2; continue; }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) { i++; break; }
        else if (c === '\n') break;
        i++;
      }
      prev = '/';
      continue;
    }
    // string / template literal
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch; i++; let buf = '';
      while (i < n) {
        const c = src[i];
        if (c === '\\') { buf += (src[i + 1] || ''); i += 2; continue; }
        if (c === quote) { i++; break; }
        if (quote === '`' && c === '$' && src[i + 1] === '{') {
          // Skip the embedded expression (it is code, not text).
          i += 2; let depth = 1;
          while (i < n && depth > 0) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            i++;
          }
          // The expression is code; drop it and join the surrounding text. We
          // add no whitespace, so a route like `/chapter/${id}` stays a single
          // token (skipped), while real prose keeps its own spaces.
          continue;
        }
        buf += c; i++;
      }
      out.push(buf);
      prev = quote;
      continue;
    }
    if (!/\s/.test(ch)) prev = ch;
    i++;
  }
  return out;
}

// Text nodes and quoted attribute values from an HTML document.
function stringsInHtml(src) {
  const out = [];
  for (const m of src.matchAll(/>([^<]+)</g)) out.push(m[1]);
  for (const m of src.matchAll(/="([^"]*)"/g)) out.push(m[1]);
  for (const m of src.matchAll(/='([^']*)'/g)) out.push(m[1]);
  return out;
}

// Every string value in a JSON document (e.g. the web manifest).
function stringsInJson(src) {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(JSON.parse(src));
  return out;
}

function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

function userVisibleStrings(file) {
  const src = readFileSync(file, 'utf8');
  switch (extname(file)) {
    case '.js': return stringsInJs(src);
    case '.html': return stringsInHtml(src);
    case '.webmanifest': return stringsInJson(src);
    default: return [];
  }
}

test('no user-visible "book / chapter / paragraph / sentence" wording in public/', () => {
  const scanned = ['.js', '.html', '.webmanifest'];
  const files = listFiles(PUBLIC).filter((f) => scanned.includes(extname(f)));
  assert.ok(files.length >= 10, `expected to scan the public/ sources, found ${files.length}`);

  const violations = [];
  for (const file of files) {
    for (const s of userVisibleStrings(file)) {
      if (isProse(s) && BANNED.test(s)) {
        violations.push(`${file.slice(PUBLIC.length + 1)}: ${JSON.stringify(s.trim())}`);
      }
    }
  }

  assert.deepEqual(violations, [], `user-visible level words found:\n${violations.join('\n')}`);
});
