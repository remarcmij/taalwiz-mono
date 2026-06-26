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
const letterRe =
  /^(stevens\.([a-z])\.md)\[(\d+)\] warning: headword "([^"]+)" does not start with the chapter letter "([a-z])"$/;
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
const wrongLetter = [];
const parseErrors = [];
for (const line of lines) {
  const w = line.match(warnRe);
  if (w) {
    const [, file, letter, ln, flagged, prev] = w;
    buckets[family(letter, prev)].push({ file, ln: +ln, flagged, prev });
    continue;
  }
  const lt = line.match(letterRe);
  if (lt) {
    wrongLetter.push({ file: lt[1], ln: +lt[3], flagged: lt[4], letter: lt[5] });
    continue;
  }
  const e = line.match(errRe);
  if (e) parseErrors.push({ file: e[1], ln: +e[2], msg: e[3] });
}

const total = ORDER.reduce((n, k) => n + buckets[k].length, 0);
let md = `# Stevens headword warnings, sliced by likely cause\n\n`;
md += `${total} out-of-order + ${wrongLetter.length} wrong-letter. The PDF is correctly ordered and every headword starts with its chapter letter, so each warning is a PDF->md conversion artifact to repair (not a re-sort).\n\n`;
if (parseErrors.length) {
  md += `> WARNING: ${parseErrors.length} chapter(s) hit a PARSE error and aborted, so their order warnings below are INCOMPLETE — fix these first:\n`;
  for (const e of parseErrors) md += `> - ${e.file} [${e.ln}]: ${e.msg}\n`;
  md += `\n`;
}
// Sub-split wrong-letter by repair shape: a headword that itself starts with a
// derivational prefix is a split-off derivation (merge under its root); anything
// else is a true intruder or a mangled entry (fix the conversion).
const wlSplit = wrongLetter.filter((b) => hasPrefix(b.flagged));
const wlIntruder = wrongLetter.filter((b) => !hasPrefix(b.flagged));

md += `## Counts\n\n`;
md += `- **wrong-letter**: ${wrongLetter.length} — split-derivation ${wlSplit.length}, intruder/mangled ${wlIntruder.length}\n`;
for (const k of ORDER) md += `- **${k}**: ${buckets[k].length}\n`;

const wlSection = (title, list, note) => {
  md += `\n---\n\n# wrong-letter / ${title} (${list.length})\n\n${note}\n\n`;
  for (const b of list.sort((a, b) => a.file.localeCompare(b.file) || a.ln - b.ln)) {
    md += `- ${b.file}[${b.ln}] **${b.flagged}** (expected "${b.letter}…")\n`;
  }
};
wlSection(
  'split-derivation',
  wlSplit,
  'Headword starts with a derivational prefix (se/ber/me/ke/peng...) but sits in the wrong chapter — a derivation split from its root. Fix: merge under its root (clears the warning).',
);
wlSection(
  'intruder/mangled',
  wlIntruder,
  'Headword does not start with its chapter letter and is NOT an obvious derivation — a true intruder from another section or a mangled entry (e.g. `__2__ to` -> `**2 to**` -> bogus `to`). Fix: the conversion.',
);

for (const k of ORDER) {
  md += `\n---\n\n# ${k} (${buckets[k].length})\n\n${DESC[k]}\n\n`;
  for (const b of buckets[k].sort((a, b) => a.file.localeCompare(b.file) || a.ln - b.ln)) {
    md += `- ${b.file}[${b.ln}] **${b.flagged}** after **${b.prev}**\n`;
  }
}

writeFileSync(resolve(root, 'STEVENS_ORDER_WARNINGS.md'), md);
console.log(`Wrote STEVENS_ORDER_WARNINGS.md — ${total} order + ${wrongLetter.length} wrong-letter${parseErrors.length ? `, ${parseErrors.length} parse error(s)` : ''}`);
console.log(`  wrong-letter: ${wrongLetter.length} (split-derivation ${wlSplit.length}, intruder/mangled ${wlIntruder.length})`);
for (const k of ORDER) console.log(`  ${k}: ${buckets[k].length}`);
