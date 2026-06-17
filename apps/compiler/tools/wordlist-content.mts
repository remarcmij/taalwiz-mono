/**
 * wordlist-content — turn a flat word list into a sorted, deduplicated content
 * file, looking every word up against the compiled Teeuw dictionary.
 *
 * The list is source-agnostic (it happens to be collected from Duolingo, a
 * course book, etc.). Each line is one item in the bulk-import `term;back`
 * format (see apps/web/.../import-line-parser.ts):
 *
 *   - `term`            -> a single target-language word to be looked up
 *   - `term;back`       -> a line whose back is already authored
 *   - `# ...`           -> a comment, ignored
 *   - blank             -> ignored
 *
 * For a bare term we mirror the web app EXACTLY (DictionaryService.fetchWordLemmas
 * + StudyModal.flipCard): run the real IndonesianVariationGenerator, take the
 * first keyword/headword hit, and format
 *
 *   **term** (decomposition if derived) <first lemma's text>
 *
 * where the decomposition is `segmentIndonesian(term, root)` (only shown when the
 * surface form differs from its root) and the lemma text is the dictionary's
 * first line, trailing `;`/`,` trimmed and a leading bold headword stripped when
 * it just repeats the term. A line that already has a back is emitted verbatim.
 * Output is sorted alphabetically by resolved root (the dictionary's own ordering
 * principle); items that share a root group together, separated by a blank line,
 * and every content line ends with two spaces (a Markdown hard break). The file
 * opens with `title:`/`targetLang:` front matter. Words that resolve to nothing
 * (typos or post-1996 coinages) are logged to stderr and dropped.
 *
 * Like lookup-trace.mts this reuses the *real* web-app language code and the
 * *real* compiled JSON, so output can never drift from what the app shows. It
 * reaches into apps/web with .ts-extension imports that only the tsx runtime
 * resolves, so it lives outside src/ and is excluded from the tsc build.
 *
 * Run (no build needed):
 *
 *   pnpm --filter compiler run wordlist [-w] <input.txt> [output.md]
 *
 * With no output path the content goes to stdout (redirect it where you like);
 * `-w`/`--write` instead writes it next to the input file (e.g. duolingo.txt ->
 * duolingo.md). Miss diagnostics always go to stderr.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as genModule from '../../web/src/app/home/dictionary/indonesian-variation-generator.ts';
import * as segModule from '../../web/src/app/home/dictionary/indonesian-segmenter.ts';
import * as parseModule from '../../web/src/app/home/vocabulary/vocabulary-entry-modal/import-line-parser.ts';

// tsx's CJS interop can surface a named export under `default`; resolve via both.
function pick<T>(mod: Record<string, unknown> & { default?: Record<string, unknown> }, name: string): T {
  return (mod[name] ?? mod.default?.[name]) as T;
}

interface Generator {
  getWordVariations(word: string): string[];
}
type SegmentResult = { display: string; morphemes: string[] };
const GenCtor = pick<new () => Generator>(genModule, 'IndonesianVariationGenerator');
const generator = new GenCtor();
const segmentIndonesian = pick<(surface: string, root: string) => SegmentResult | null>(
  segModule,
  'segmentIndonesian',
);
const splitImportLine = pick<(line: string) => { term: string; back?: string }>(
  parseModule,
  'splitImportLine',
);

// --- Dictionary index, mirroring dict-db.ts transformDict + findByWordAndLang.
interface DictRecord {
  word: string;
  lang: string;
  keyword: number;
  baseWord: string;
  text: string;
  homonym: number;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonDir = path.join(__dirname, '..', 'json');

const index = new Map<string, DictRecord[]>(); // key: `${lang}|${wordLower}`
let targetLang = 'id';

for (const file of fs.readdirSync(jsonDir).sort()) {
  if (!file.endsWith('.json')) continue;
  const raw = JSON.parse(fs.readFileSync(path.join(jsonDir, file), 'utf8'));
  const lemmas = Array.isArray(raw) ? raw : raw.lemmas;
  if (!Array.isArray(raw) && typeof raw.targetLang === 'string') targetLang = raw.targetLang;
  for (const lemma of lemmas) {
    for (const w of lemma.words) {
      const rec: DictRecord = {
        word: w.word,
        lang: w.lang,
        keyword: w.keyword,
        baseWord: lemma.base,
        text: lemma.text,
        homonym: lemma.homonym,
      };
      const key = `${w.lang}|${w.word.toLowerCase()}`;
      const bucket = index.get(key);
      if (bucket) bucket.push(rec);
      else index.set(key, [rec]);
    }
  }
}

function findByWordAndLang(word: string, lang: string, keywordOnly: boolean): DictRecord[] {
  const bucket = index.get(`${lang}|${word.toLowerCase()}`) ?? [];
  return bucket
    .filter((r) => !keywordOnly || (r.keyword ?? 1) === 1)
    .sort((a, b) => a.homonym - b.homonym);
}

interface LookupHit {
  word: string; // the matched headword (the variation that hit)
  lemmas: DictRecord[];
  /**
   * Keyword headwords that matched, are LONGER than `word`, AND are a valid fuller
   * affix-analysis of the surface (the segmenter can derive the surface from them).
   * Non-empty means the first-hit rule may have over-stripped to a shorter, unrelated
   * root while a fuller form was available (e.g. "memasakan" -> "asa" with "masak"
   * still deriving the surface). The segmenter check excludes the generator's
   * SYNTHESISED meN- forms (e.g. "jadi" -> "menjadi"), which are longer but not
   * reductions, so confident bare roots and clean derivations are not flagged.
   */
  longerHits: string[];
}

/** The web app's lookup: first hit across [keywordOnly, then any] × variations. */
function lookup(term: string): LookupHit | null {
  const variations = generator.getWordVariations(term);
  for (const keywordOnly of [true, false]) {
    for (const w of variations) {
      const lemmas = findByWordAndLang(w, targetLang, keywordOnly);
      if (lemmas.length === 0) continue;
      // Over-stripping is only meaningful against the keyword pass that the web app
      // resolves on; a non-keyword fallback hit has no "fuller form" to compare to.
      const longerHits = keywordOnly
        ? variations.filter(
            (v) =>
              v.length > w.length &&
              findByWordAndLang(v, targetLang, true).length > 0 &&
              segmentIndonesian(term, v) !== null,
          )
        : [];
      return { word: w, lemmas, longerHits };
    }
  }
  return null;
}

// --- CLI: [-w|--write] <input.txt> [output.md]. With -w (and no explicit output
// path) the content is written next to the input file, saving a second argument.
const argv = process.argv.slice(2);
const writeFlag = argv.includes('-w') || argv.includes('--write');
const positionals = argv.filter((a) => !a.startsWith('-'));
const inputPath = positionals[0];
if (!inputPath) {
  console.error('usage: pnpm --filter compiler run wordlist [-w] <input.txt> [output.md]');
  process.exit(1);
}

const inputExt = path.extname(inputPath);
const inputBase = path.basename(inputPath, inputExt);
let outputPath = positionals[1];
if (!outputPath && writeFlag) {
  const candidate = path.join(path.dirname(inputPath), `${inputBase}.md`);
  // Don't clobber the input if it is itself a .md file.
  outputPath =
    path.resolve(candidate) === path.resolve(inputPath)
      ? path.join(path.dirname(inputPath), `${inputBase}.content.md`)
      : candidate;
}

interface Entry {
  sortKey: string; // resolved root (preferred) or the raw term, for ordering
  line: string; // the formatted content line
}

const entries: Entry[] = [];
const seen = new Set<string>(); // dedup key: lowercased term
const misses: string[] = [];
const suspicious: { term: string; root: string; longer: string[] }[] = [];

/**
 * Strip the lemma text's leading bold headword when it merely repeats the surface
 * term, so a bare root does not render as "**abad** **abad**, 1 eeuw". A homonym
 * roman numeral (e.g. "abang I,") and a different root headword (the common case
 * for a derived form, e.g. "dianggap" -> "**anggap** ...") are kept, since those
 * are informative rather than duplicated.
 */
function stripLeadingHeadword(text: string, term: string): string {
  const m = text.match(/^\*\*([^*]+)\*\*/);
  if (!m) return text;
  const headwords = m[1].split(',').map((h) => h.trim().toLowerCase());
  if (!headwords.includes(term.toLowerCase())) return text;
  return text.slice(m[0].length).replace(/^\s*,\s*/, '').trimStart();
}

/** Ensure a line ends in sentence punctuation, appending a period when it lacks one. */
function ensureTerminalPeriod(s: string): string {
  const trimmed = s.trimEnd();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

const source = fs.readFileSync(inputPath, 'utf8').replace(/^﻿/, '');
for (const rawLine of source.split('\n')) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;

  const { term, back } = splitImportLine(line);
  if (!term) continue;

  const dedupKey = term.toLowerCase();
  if (seen.has(dedupKey)) continue;
  seen.add(dedupKey);

  // An authored back is emitted verbatim; still try to resolve the term so the
  // line sorts into its root group (fall back to the term itself).
  if (back) {
    const hit = lookup(term);
    entries.push({ sortKey: (hit?.lemmas[0].baseWord ?? term).toLowerCase(), line: back });
    continue;
  }

  const hit = lookup(term);
  if (!hit) {
    misses.push(term);
    continue;
  }
  if (hit.longerHits.length > 0) {
    suspicious.push({ term, root: hit.lemmas[0].baseWord, longer: hit.longerHits });
  }

  const firstLemma = hit.lemmas[0];
  const definition = stripLeadingHeadword(firstLemma.text, term).replace(/[;,]\s*$/, '');
  const root = firstLemma.baseWord;
  // Only a genuinely derived form gets a decomposition; compare case-insensitively
  // so a capitalised list entry ("Ambil") is not segmented against its root "ambil".
  const isDerived = root && root.toLowerCase() !== term.toLowerCase();
  const seg = isDerived ? segmentIndonesian(term, root) : null;
  // Bold the root morpheme so it is tappable too (e.g. "peN- + **acara**"); the
  // affixes stay plain text. The root element equals `root` (the segmenter's anchor).
  const deco = seg
    ? ` (${seg.morphemes.map((m) => (m === root ? `**${m}**` : m)).join(' + ')})`
    : '';
  entries.push({ sortKey: root.toLowerCase(), line: `**${term}**${deco} ${definition}` });
}

// Sort by root (the dictionary's alphabetical principle), then by the rendered
// line so items sharing a root keep a stable, readable order.
entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.line.localeCompare(b.line));

// Assemble: YAML front matter, then the content. Each content line ends with two
// spaces (a Markdown hard break) so consecutive entries render on their own line,
// and a blank line precedes each new root group for readability. The title
// defaults to the input file name without its extension (e.g. "duolingo").
const title = inputBase;
const body: string[] = [];
let prevKey: string | null = null;
for (const entry of entries) {
  if (prevKey !== null && entry.sortKey !== prevKey) body.push('');
  body.push(`${ensureTerminalPeriod(entry.line)}  `);
  prevKey = entry.sortKey;
}

const output = `---\ntitle: ${title}\ntargetLang: ${targetLang}\n---\n\n${body.join('\n')}\n`;
if (outputPath) {
  fs.writeFileSync(outputPath, output);
  console.error(`wrote ${entries.length} entries to ${outputPath}`);
} else {
  process.stdout.write(output);
}

if (suspicious.length > 0) {
  console.error(
    `\n${suspicious.length} word(s) may be over-stripped to a shorter root (review — a longer dictionary form also matched, likely a typo):`,
  );
  for (const s of suspicious) {
    console.error(`  ${s.term} -> ${s.root}  (longer match: ${s.longer.join(', ')})`);
  }
}

if (misses.length > 0) {
  console.error(`\n${misses.length} word(s) did not resolve (typos or post-1996 coinages):`);
  for (const m of misses) console.error(`  ${m}`);
}
