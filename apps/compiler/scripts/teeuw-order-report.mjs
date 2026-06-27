// Regenerates TEEUW_ORDER_WARNINGS.md: compiles each Teeuw chapter with headword
// validation flipped ON (it is OFF by design in parser-registry.ts — Teeuw's
// printed editorial quirks are accepted), collects the compiler's order/letter
// warnings, and slices them by likely cause. Re-run after editing the source —
// line numbers track the current files.
//
// Reframe vs the Stevens report: there is no machine-readable PDF ground truth
// for Teeuw. Jim hand-coded it from an OCR scan IN PRINT ORDER, so a warning is
// EITHER (a) a quirk present in the printed Teeuw too (leave it) OR (b) a
// transcription error he made (fix it). Every flag therefore needs the
// "does the print show it this way?" check — this report is a triage queue,
// not a repair list.
//
//   pnpm --filter compiler run teeuw-order-report            # default source dir
//   pnpm --filter compiler run teeuw-order-report <dir>      # explicit source dir
//   TEEUW_DIR=/path pnpm --filter compiler run teeuw-order-report
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Source dir: prefer the canonical git-tracked copy in the sibling
// taalwiz-content repo; override with a CLI arg or TEEUW_DIR; fall back to this
// repo's local copy.
const teeuwDir = [
  process.argv[2],
  process.env.TEEUW_DIR,
  resolve(root, '../../../taalwiz-content/dict/teeuw'),
  resolve(root, 'dict/teeuw'),
].filter(Boolean).find((d) => existsSync(d));
if (!teeuwDir) {
  console.error('No Teeuw source dir found. Pass a path or set TEEUW_DIR.');
  process.exit(1);
}

// dist reads the source .md fresh at runtime, so editing source needs no rebuild.
// Build only when dist is missing (first run / after clean, or when the
// compiler's own .ts changed — rebuild with `pnpm --filter compiler build`).
if (!existsSync(resolve(root, 'dist/compiler/Compiler.js'))) {
  console.log('dist/ missing — building compiler once...');
  const b = spawnSync('npx', ['tsc'], { cwd: root, stdio: 'inherit' });
  if (b.status !== 0) process.exit(b.status ?? 1);
}

// Flip headword validation ON for Teeuw. The registry deliberately leaves it off
// (Teeuw's print quirks are not bugs); mutate the in-memory entry BEFORE importing
// the Compiler so both share the same module instance. This is report-only — it
// never touches the source registry.
const { parserRegistry } = await import(
  pathToFileURL(resolve(root, 'dist/compiler/parser-registry.js')).href
);
for (const e of parserRegistry) if (e.prefix === 'teeuw') e.validateHeadwords = true;

const { Compiler } = await import(
  pathToFileURL(resolve(root, 'dist/compiler/Compiler.js')).href
);

// Compile each chapter in-process so warnings (and line numbers) are exactly the
// compiler's. Capture console.warn/error; JSON goes to a throwaway temp dir.
// Match core chapters and per-letter `+` supplements (teeuw.a+.md).
const files = readdirSync(teeuwDir)
  .filter((f) => /^teeuw\.[a-z]\+?\.md$/.test(f))
  .sort();
const tmpOut = mkdtempSync(join(os.tmpdir(), 'teeuw-order-'));
const captured = [];
const real = { warn: console.warn, error: console.error, log: console.log };
console.warn = (m) => captured.push(String(m));
console.error = (m) => captured.push(String(m));
console.log = () => {};
for (const f of files) {
  await new Compiler(join(teeuwDir, f), join(tmpOut, f.replace(/\.md$/, '.json'))).run();
}
Object.assign(console, real);
const lines = captured;

// Filenames carry an optional `+` supplement marker (teeuw.a+.md).
const warnRe =
  /^(teeuw\.([a-z])\+?\.md)\[(\d+)\] warning: headword "([^"]+)" is out of alphabetical order \(after "([^"]+)"\)$/;
const letterRe =
  /^(teeuw\.([a-z])\+?\.md)\[(\d+)\] warning: headword "([^"]+)" does not start with the chapter letter "([a-z])"$/;
const errRe = /Error processing file '([^']+)': \[(\d+)\] (.+)$/;

const fold = (s) => s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
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

// Read a flagged line from the source to see whether its first `**...**` span
// holds more than one word. The base is truncated to the first word, which is
// what trips the order check, so these are pulled into their own slice.
const srcCache = {};
const srcLines = (file) =>
  (srcCache[file] ??= readFileSync(join(teeuwDir, file), 'utf8').split('\n'));
const firstBoldSpan = (file, ln) => {
  const m = (srcLines(file)[ln - 1] ?? '').trim().match(/^\^?\s*\*\*([^*]+)\*\*/);
  return m ? m[1].replace(/\+/g, ' ').trim() : '';
};
// Within the multi-word slice, the few worth fixing are a root plus a split-off
// derivation in one span (2nd word is a prefixed form of the 1st); the rest are
// genuine phrases to leave. Heuristic only — verify against the print.
const isSplitDerivation = (span) => {
  const [w1, w2] = span.split(/\s+/);
  if (!w2) return false;
  const r = fold(w1);
  const d = fold(w2);
  return PREFIXES.some((p) => d.startsWith(p) && d.slice(p.length).includes(r.slice(0, 3)));
};

const ORDER = ['fragment', 'prefix-derivation', 'reduplication', 'cross-letter', 'other'];
const DESC = {
  fragment: 'Predecessor is a 1-3 char stray — a word broken apart in transcription (`p`, `to`, `a`).',
  'prefix-derivation': 'Predecessor carries a derivational prefix (se/ber/me/nge/ke/peng...) — a derivation split from its root by a spurious blank line (rejoin it), OR a legit standalone headword that is simply mis-sorted in print (leave it).',
  reduplication: 'Predecessor is a reduplication X-X — likely a derivation split from its root.',
  'cross-letter': 'Predecessor starts with a different letter than its file — an intruder from another section, or a mis-transcribed headword.',
  other: 'Genuine-looking local reorder, OCR/transcription typo, or a faithfully-reproduced print quirk — needs the eye on the printed page.',
};

const buckets = Object.fromEntries(ORDER.map((k) => [k, []]));
const multiWord = [];
const wrongLetter = [];
const parseErrors = [];
for (const line of lines) {
  const w = line.match(warnRe);
  if (w) {
    const [, file, letter, ln, flagged, prev] = w;
    const span = firstBoldSpan(file, +ln);
    if (span.includes(' ')) {
      multiWord.push({ file, ln: +ln, span, prev });
    } else {
      buckets[family(letter, prev)].push({ file, ln: +ln, flagged, prev });
    }
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
let md = `# Teeuw headword warnings, sliced by likely cause\n\n`;
md += `Source: \`${teeuwDir}\`\n\n`;
md += `Headword validation is OFF for Teeuw in \`parser-registry.ts\` by design (its printed editorial quirks are accepted, not bugs). This report flips it on in-process for QA only.\n\n`;
md += `**There is no PDF ground truth for Teeuw.** Jim hand-coded it from an OCR scan IN PRINT ORDER, so each warning below is EITHER a quirk present in the printed Teeuw too (leave it) OR a transcription error (fix it). Verify every flag against the printed page — this is a triage queue, not a repair list.\n\n`;
md += `${total + multiWord.length} out-of-order (${multiWord.length} multi-word headword spans split out below) + ${wrongLetter.length} wrong-letter.\n\n`;
if (parseErrors.length) {
  md += `> WARNING: ${parseErrors.length} chapter(s) hit a PARSE error and aborted, so their order warnings below are INCOMPLETE — fix these first:\n`;
  for (const e of parseErrors) md += `> - ${e.file} [${e.ln}]: ${e.msg}\n`;
  md += `\n`;
}
// Sub-split wrong-letter by repair shape: a headword that itself starts with a
// derivational prefix is a split-off derivation (rejoin under its root); anything
// else is a true intruder or a mangled/mis-transcribed entry.
const wlSplit = wrongLetter.filter((b) => hasPrefix(b.flagged));
const wlIntruder = wrongLetter.filter((b) => !hasPrefix(b.flagged));

// Multi-word slice: split the few likely root+derivation spans (a source fix)
// from the genuine phrases (correct source — leave them).
const mwDeriv = multiWord.filter((b) => isSplitDerivation(b.span));
const mwPhrase = multiWord.filter((b) => !isSplitDerivation(b.span));

md += `## Counts\n\n`;
md += `- **wrong-letter**: ${wrongLetter.length} — split-derivation ${wlSplit.length}, intruder/mangled ${wlIntruder.length}\n`;
md += `- **multi-word headword spans**: ${multiWord.length} — likely root+derivation ${mwDeriv.length}, genuine phrase ${mwPhrase.length}\n`;
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
  'Headword starts with a derivational prefix (se/ber/me/ke/peng...) but sits in the wrong chapter — a derivation split from its root by a blank line. Fix: rejoin under its root (clears the warning). Confirm vs print.',
);
wlSection(
  'intruder/mangled',
  wlIntruder,
  'Headword does not start with its chapter letter and is NOT an obvious derivation — a true intruder from another section or a mis-transcribed headword (e.g. tepas -> repas). Fix: against the print.',
);

const mwSort = (a, b) => a.file.localeCompare(b.file) || a.ln - b.ln;
md += `\n---\n\n# multi-word headword spans (${multiWord.length})\n\n`;
md += `The flagged line's first \`**...**\` span holds more than one word, so the base is truncated to its first word, which trips the order check. Most are genuine multi-word phrases (correct source — leave them); a few are a root plus a split-off derivation in one span.\n\n`;
md += `## likely root+derivation — check in source (${mwDeriv.length})\n\n`;
md += `Heuristic: the 2nd word is a prefixed form of the 1st (verify against the print).\n\n`;
for (const b of mwDeriv.sort(mwSort)) md += `- ${b.file}[${b.ln}] **${b.span}**\n`;
md += `\n## likely genuine phrase — leave (${mwPhrase.length})\n\n`;
for (const b of mwPhrase.sort(mwSort)) md += `- ${b.file}[${b.ln}] **${b.span}** (after **${b.prev}**)\n`;

for (const k of ORDER) {
  md += `\n---\n\n# ${k} (${buckets[k].length})\n\n${DESC[k]}\n\n`;
  for (const b of buckets[k].sort((a, b) => a.file.localeCompare(b.file) || a.ln - b.ln)) {
    md += `- ${b.file}[${b.ln}] **${b.flagged}** after **${b.prev}**\n`;
  }
}

writeFileSync(resolve(root, 'TEEUW_ORDER_WARNINGS.md'), md);
console.log(`Source: ${teeuwDir}`);
console.log(`Wrote TEEUW_ORDER_WARNINGS.md — ${total + multiWord.length} order + ${wrongLetter.length} wrong-letter${parseErrors.length ? `, ${parseErrors.length} parse error(s)` : ''}`);
console.log(`  wrong-letter: ${wrongLetter.length} (split-derivation ${wlSplit.length}, intruder/mangled ${wlIntruder.length})`);
console.log(`  multi-word spans: ${multiWord.length} (root+derivation ${mwDeriv.length}, phrase ${mwPhrase.length})`);
for (const k of ORDER) console.log(`  ${k}: ${buckets[k].length}`);
