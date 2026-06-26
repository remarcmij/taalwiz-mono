// Regenerates STEVENS_ORDER_WARNINGS.md: runs the compiler, collects its
// headword alphabetical-order warnings, and slices them by likely conversion
// cause. The Stevens .md is generated from a correctly-ordered PDF, so every
// warning marks a conversion artifact to repair. Re-run after editing the source
// — line numbers track the current files.
//
//   pnpm --filter compiler run order-report
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Run the real compile so the warnings (and their line numbers) are exactly the
// compiler's. console.warn -> stderr, console.log -> stdout; read both.
const res = spawnSync('node', ['dist/index.js'], { cwd: root, encoding: 'utf8' });
const lines = `${res.stdout ?? ''}\n${res.stderr ?? ''}`.split('\n');

const warnRe =
  /^(stevens\.([a-z])\.md)\[(\d+)\] warning: headword "([^"]+)" is out of alphabetical order \(after "([^"]+)"\)$/;
const errRe = /Error processing file '([^']+)': \[(\d+)\] (.+)$/;

const fold = (s) =>
  s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
const PREFIXES = ['nge','ng','menge','meny','meng','mem','men','me','penge','peny','peng','pem','pen','pe','ber','ter','per','ke','se','di'];
const isRedup = (w) => {
  const p = w.split('-');
  return p.length > 1 && p.some((x, i) => i > 0 && fold(x) === fold(p[0]));
};
const hasPrefix = (w) => {
  const f = fold(w);
  return PREFIXES.some((p) => f.startsWith(p) && f.length - p.length >= 2);
};
const family = (letter, prev) => {
  if (fold(prev).replace(/-/g, '').length <= 3) return 'fragment';
  if (isRedup(prev)) return 'reduplication';
  if (hasPrefix(prev)) return 'prefix-derivation';
  if (fold(prev)[0] !== letter) return 'cross-letter';
  return 'other';
};

const ORDER = ['fragment', 'prefix-derivation', 'reduplication', 'cross-letter', 'other'];
const DESC = {
  fragment: 'Predecessor is a 1-3 char stray — a word the converter broke apart (`p`, `to`, `a`).',
  'prefix-derivation': 'Predecessor carries a derivational prefix (se/ber/me/nge/ke/peng...) — a derivation split from its root by a spurious blank line.',
  reduplication: 'Predecessor is a reduplication X-X — likely a derivation split from its root.',
  'cross-letter': 'Predecessor starts with a different letter than its file — an intruder from another section.',
  other: 'Genuine-looking local reorder, OCR typo, or unclassified — needs the eye.',
};

const buckets = Object.fromEntries(ORDER.map((k) => [k, []]));
const parseErrors = [];
for (const line of lines) {
  const w = line.match(warnRe);
  if (w) {
    const [, file, letter, ln, flagged, prev] = w;
    buckets[family(letter, prev)].push({ file, ln: +ln, flagged, prev });
    continue;
  }
  const e = line.match(errRe);
  if (e) parseErrors.push({ file: e[1], ln: +e[2], msg: e[3] });
}

const total = ORDER.reduce((n, k) => n + buckets[k].length, 0);
let md = `# Stevens order warnings, sliced by likely cause\n\n`;
md += `${total} headwords out of alphabetical order. The PDF is correctly ordered, so each is a PDF->md conversion artifact to repair (not a re-sort).\n\n`;
if (parseErrors.length) {
  md += `> WARNING: ${parseErrors.length} chapter(s) hit a PARSE error and aborted, so their order warnings below are INCOMPLETE — fix these first:\n`;
  for (const e of parseErrors) md += `> - ${e.file} [${e.ln}]: ${e.msg}\n`;
  md += `\n`;
}
md += `## Counts\n\n`;
for (const k of ORDER) md += `- **${k}**: ${buckets[k].length}\n`;
for (const k of ORDER) {
  md += `\n---\n\n# ${k} (${buckets[k].length})\n\n${DESC[k]}\n\n`;
  for (const b of buckets[k].sort((a, b) => a.file.localeCompare(b.file) || a.ln - b.ln)) {
    md += `- ${b.file}[${b.ln}] **${b.flagged}** after **${b.prev}**\n`;
  }
}

writeFileSync(resolve(root, 'STEVENS_ORDER_WARNINGS.md'), md);
console.log(`Wrote STEVENS_ORDER_WARNINGS.md — ${total} warnings${parseErrors.length ? `, ${parseErrors.length} parse error(s)` : ''}`);
for (const k of ORDER) console.log(`  ${k}: ${buckets[k].length}`);
