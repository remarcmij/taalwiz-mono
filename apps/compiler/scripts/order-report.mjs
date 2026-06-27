// Regenerates STEVENS_ORDER_WARNINGS.md: compiles each Stevens chapter, collects
// the compiler's headword warnings (alphabetical order + leading letter), and
// slices them by likely conversion cause. The Stevens .md is generated from a
// correctly-ordered PDF, so every warning marks a conversion artifact to repair.
// Re-run after editing the source — line numbers track the current files.
//
//   pnpm --filter compiler run order-report            # default source dir
//   pnpm --filter compiler run order-report <dir>      # explicit source dir
//   STEVENS_DIR=/path pnpm --filter compiler run order-report
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Source dir: prefer the canonical git-tracked copy in the sibling
// taalwiz-content repo; override with a CLI arg or STEVENS_DIR; fall back to this
// repo's local copy.
const stevensDir = [
  process.argv[2],
  process.env.STEVENS_DIR,
  resolve(root, '../../../taalwiz-content/dict/stevens'),
  resolve(root, 'dict/stevens'),
].filter(Boolean).find((d) => existsSync(d));
if (!stevensDir) {
  console.error('No Stevens source dir found. Pass a path or set STEVENS_DIR.');
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

// Headword validation is OFF in the registry for a normal compile (it's a QA aid
// that would otherwise spew accepted-quirk warnings). Flip it on for Stevens
// in-process BEFORE importing the Compiler so both share the module instance.
const { parserRegistry } = await import(
  pathToFileURL(resolve(root, 'dist/compiler/parser-registry.js')).href
);
for (const e of parserRegistry) if (e.prefix === 'stevens') e.validateHeadwords = true;

const { Compiler } = await import(
  pathToFileURL(resolve(root, 'dist/compiler/Compiler.js')).href
);

// Compile each chapter in-process so warnings (and line numbers) are exactly the
// compiler's. Capture console.warn/error; JSON goes to a throwaway temp dir.
const files = readdirSync(stevensDir)
  .filter((f) => /^stevens\.[a-z]\.md$/.test(f))
  .sort();
const tmpOut = mkdtempSync(join(os.tmpdir(), 'stevens-order-'));
const captured = [];
const real = { warn: console.warn, error: console.error, log: console.log };
console.warn = (m) => captured.push(String(m));
console.error = (m) => captured.push(String(m));
console.log = () => {};
for (const f of files) {
  await new Compiler(join(stevensDir, f), join(tmpOut, f.replace(/\.md$/, '.json'))).run();
}
Object.assign(console, real);
const lines = captured;

const warnRe =
  /^(stevens\.([a-z])\.md)\[(\d+)\] warning: headword "([^"]+)" is out of alphabetical order \(after "([^"]+)"\)$/;
const letterRe =
  /^(stevens\.([a-z])\.md)\[(\d+)\] warning: headword "([^"]+)" does not start with the chapter letter "([a-z])"$/;
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
// holds more than one word (`persona non grata`, `à décharge`). The base is
// truncated to the first word, which is what trips the order check, so these are
// pulled into their own slice instead of cluttering `other`.
const srcCache = {};
const srcLines = (file) =>
  (srcCache[file] ??= readFileSync(join(stevensDir, file), 'utf8').split('\n'));
const firstBoldSpan = (file, ln) => {
  const m = (srcLines(file)[ln - 1] ?? '').trim().match(/^\*\*([^*]+)\*\*/);
  return m ? m[1].replace(/\+/g, ' ').trim() : '';
};
// Within the multi-word slice, the few worth fixing are a root plus a split-off
// derivation in one span (2nd word is a prefixed form of the 1st); the rest are
// genuine phrases to leave. Heuristic only — verify against the PDF.
const isSplitDerivation = (span) => {
  const [w1, w2] = span.split(/\s+/);
  if (!w2) return false;
  const r = fold(w1);
  const d = fold(w2);
  return PREFIXES.some((p) => d.startsWith(p) && d.slice(p.length).includes(r.slice(0, 3)));
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
let md = `# Stevens headword warnings, sliced by likely cause\n\n`;
md += `Source: \`${stevensDir}\`\n\n`;
md += `${total + multiWord.length} out-of-order (${multiWord.length} multi-word headword spans split out below) + ${wrongLetter.length} wrong-letter. The PDF is correctly ordered and every headword starts with its chapter letter, so each warning is a PDF->md conversion artifact to repair (not a re-sort).\n\n`;
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
  'Headword starts with a derivational prefix (se/ber/me/ke/peng...) but sits in the wrong chapter — a derivation split from its root. Fix: merge under its root (clears the warning).',
);
wlSection(
  'intruder/mangled',
  wlIntruder,
  'Headword does not start with its chapter letter and is NOT an obvious derivation — a true intruder from another section or a mangled entry (e.g. `__2__ to` -> `**2 to**` -> bogus `to`). Fix: the conversion.',
);

const mwSort = (a, b) => a.file.localeCompare(b.file) || a.ln - b.ln;
md += `\n---\n\n# multi-word headword spans (${multiWord.length})\n\n`;
md += `The flagged line's first \`**...**\` span holds more than one word, so the base is truncated to its first word, which trips the order check. Most are genuine multi-word phrases (correct source — leave them); a few are a root plus a split-off derivation in one span (fix in source).\n\n`;
md += `## likely root+derivation — fix in source (${mwDeriv.length})\n\n`;
md += `Heuristic: the 2nd word is a prefixed form of the 1st (verify against the PDF). Split \`**root deriv**\` into \`**root** **deriv**\`.\n\n`;
for (const b of mwDeriv.sort(mwSort)) md += `- ${b.file}[${b.ln}] **${b.span}**\n`;
md += `\n## likely genuine phrase — leave (${mwPhrase.length})\n\n`;
for (const b of mwPhrase.sort(mwSort)) md += `- ${b.file}[${b.ln}] **${b.span}** (after **${b.prev}**)\n`;

for (const k of ORDER) {
  md += `\n---\n\n# ${k} (${buckets[k].length})\n\n${DESC[k]}\n\n`;
  for (const b of buckets[k].sort((a, b) => a.file.localeCompare(b.file) || a.ln - b.ln)) {
    md += `- ${b.file}[${b.ln}] **${b.flagged}** after **${b.prev}**\n`;
  }
}

writeFileSync(resolve(root, 'STEVENS_ORDER_WARNINGS.md'), md);
console.log(`Source: ${stevensDir}`);
console.log(`Wrote STEVENS_ORDER_WARNINGS.md — ${total + multiWord.length} order + ${wrongLetter.length} wrong-letter${parseErrors.length ? `, ${parseErrors.length} parse error(s)` : ''}`);
console.log(`  wrong-letter: ${wrongLetter.length} (split-derivation ${wlSplit.length}, intruder/mangled ${wlIntruder.length})`);
console.log(`  multi-word spans: ${multiWord.length} (root+derivation ${mwDeriv.length}, phrase ${mwPhrase.length})`);
for (const k of ORDER) console.log(`  ${k}: ${buckets[k].length}`);
