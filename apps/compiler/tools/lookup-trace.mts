/**
 * lookup-trace — trace how a typed word resolves against the compiled Teeuw
 * dictionary, mirroring the web app's DictionaryService.#searchLocal().
 *
 * It reuses the *real* IndonesianVariationGenerator from apps/web and the *real*
 * compiled JSON in apps/compiler/json, so the hit/miss it reports is exactly what
 * the app would do at runtime. Handy for documentation and morphology spelunking.
 *
 * Run (no build needed — tsx transpiles on the fly):
 *
 *   pnpm --filter compiler run trace dibakar dipekerjakan diinstal
 *
 * For each word it prints every generated variation in order, marking the first
 * keyword headword hit (where the lookup stops) and which variations were
 * actually queried vs. never reached.
 *
 * This file lives outside src/ and is excluded from the tsc build on purpose: it
 * reaches across the workspace into apps/web's source with a .ts-extension import,
 * which only the tsx runtime resolves.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The variation generator is owned by the web app (it is what runs in the
// browser). Import it directly so this trace can never drift from production.
import * as genModule from '../../web/src/app/home/dictionary/indonesian-variation-generator.ts';

interface Generator {
  getWordVariations(word: string): string[];
}
// tsx's CJS interop can surface the named export under `default`; handle both.
const ns = genModule as Record<string, unknown> & { default?: Record<string, unknown> };
const GenCtor = (ns.IndonesianVariationGenerator ??
  ns.default?.IndonesianVariationGenerator) as new () => Generator;
const generator = new GenCtor();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonDir = path.join(__dirname, '..', 'json');

// Build the set of Indonesian keyword headwords (lowercased), i.e. the words a
// lookup treats as a "hit". Mirrors #searchLocal's `keyword === 1` test.
const keywordId = new Set<string>();
// Chapters live in per-dictionary subfolders (json/teeuw/, json/stevens/), so
// read recursively to pick them up regardless of nesting depth.
for (const file of fs.readdirSync(jsonDir, { recursive: true })) {
  if (typeof file !== 'string' || !file.endsWith('.json')) continue;
  const raw = JSON.parse(fs.readFileSync(path.join(jsonDir, file), 'utf8'));
  const lemmas = Array.isArray(raw) ? raw : raw.lemmas;
  for (const lemma of lemmas) {
    for (const w of lemma.words) {
      if (w.lang === 'id' && w.keyword === 1) keywordId.add(w.word.toLowerCase());
    }
  }
}

const isHit = (word: string) => keywordId.has(word.toLowerCase());

const words = process.argv.slice(2);
if (words.length === 0) {
  console.error('usage: pnpm --filter compiler run trace <word> [<word> ...]');
  process.exit(1);
}

for (const word of words) {
  const variations = generator.getWordVariations(word);
  const hitAt = variations.findIndex(isHit);
  console.log(`\n${word}  —  ${variations.length} variations, ${
    hitAt === -1 ? 'NO HIT (empty result)' : `hit at index ${hitAt}: "${variations[hitAt]}"`
  }`);
  variations.forEach((v, i) => {
    const queried = hitAt === -1 || i <= hitAt;
    const tag = isHit(v) ? 'HIT ' : '    ';
    console.log(`  ${tag} ${queried ? 'queried' : 'skipped'}  ${v}`);
  });
}
