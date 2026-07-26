/**
 * Builds one SQLite database per dictionary from the compiler-generated chapter
 * JSON files.
 *
 *   json/<dict>/<dict>.<letter>.json  ->  db/<dict>.db
 *
 * The databases are intended for ad-hoc inspection with local tools (DBeaver,
 * the sqlite3 CLI, etc.), so we use Node's built-in `node:sqlite` — no runtime
 * dependency, native speed, and a plain SQLite file on disk.
 *
 * Run with `pnpm --filter compiler run build:dbs`.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_SQL } from './schema.js';
import type { ChapterJson, DictName } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** `apps/compiler/json` — source of the generated chapter files. */
const JSON_ROOT = path.resolve(__dirname, '../../json');
/** `apps/compiler/db` — gitignored output directory for the `.db` files. */
const DB_ROOT = path.resolve(__dirname, '../../db');

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const DICTS: DictName[] = ['teeuw', 'stevens'];

/**
 * Index form of a token: Unicode-decompose, drop combining marks (diacritics),
 * then lowercase. Keeps the original around for display.
 */
function toSearchForm(word: string): string {
  return word
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

interface BuildResult {
  dict: DictName;
  dbPath: string;
  lemmas: number;
  words: number;
}

function buildDatabase(dict: DictName): BuildResult {
  const jsonDir = path.join(JSON_ROOT, dict);
  const dbPath = path.join(DB_ROOT, `${dict}.db`);

  // Rebuild from scratch each run so the schema is never appended twice.
  fs.rmSync(dbPath, { force: true });

  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA_SQL);

  const insertLemma = db.prepare(
    'INSERT INTO lemmas (id, base, homonym, text, is_supplement) VALUES (?, ?, ?, ?, ?)',
  );
  const insertWord = db.prepare(
    'INSERT INTO words (id, lemma_id, word, search, lang, is_keyword) VALUES (?, ?, ?, ?, ?, ?)',
  );

  let lemmaId = 0;
  let wordId = 0;

  db.exec('BEGIN TRANSACTION');

  for (const letter of LETTERS) {
    const file = path.join(jsonDir, `${dict}.${letter}.json`);
    if (!fs.existsSync(file)) continue;

    const chapter: ChapterJson = JSON.parse(fs.readFileSync(file, 'utf-8'));

    for (const lemma of chapter.lemmas) {
      lemmaId += 1;
      insertLemma.run(
        lemmaId,
        lemma.base,
        lemma.homonym,
        lemma.text,
        lemma.isSupplement ? 1 : 0,
      );

      for (const w of lemma.words) {
        wordId += 1;
        // `?? 1` (not `? 1 : 0`): an absent keyword flag in the JSON means "a
        // real keyword", matching the web client's `transformDict`. Defensive
        // only -- the compiler always emits it.
        insertWord.run(wordId, lemmaId, w.word, toSearchForm(w.word), w.lang, w.keyword ?? 1);
      }
    }

    console.log(`  ${letter}: ${chapter.lemmas.length.toLocaleString()} lemmas`);
  }

  db.exec('COMMIT');
  db.close();

  return { dict, dbPath, lemmas: lemmaId, words: wordId };
}

function main() {
  fs.mkdirSync(DB_ROOT, { recursive: true });
  console.log(`Building SQLite databases into ${DB_ROOT}\n`);

  for (const dict of DICTS) {
    console.log(`${dict}:`);
    const r = buildDatabase(dict);
    console.log(
      `  ✓ ${r.dbPath} — ${r.lemmas.toLocaleString()} lemmas, ` +
        `${r.words.toLocaleString()} words\n`,
    );
  }

  console.log('Done.');
}

main();
