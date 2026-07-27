// Framework-free dictionary IndexedDB layer.
//
// Kept free of `@angular/core` so the import Web Worker can bundle this module
// (and `transformDict`) without dragging Angular into the worker chunk. The
// service layer (`dict-store.service.ts`, `dict-sync.service.ts`) and the
// worker (`dict-import.worker.ts`) both import from here.

import { IDBPDatabase, openDB } from 'idb';
import { Lemma, LineKind } from './lemma/lemma.model';

export const DICT_DB_NAME = 'taalwiz-dict';
export const DICT_DB_VERSION = 4;

// `wordLower` is a stored-only field: the folded `word` used as the lookup key so
// searches are case- AND accent-insensitive (typing "belanda" finds "Belanda";
// typing "boleh" finds Stevens' "boléh", where é is a pronunciation aid).
// `word` keeps its original casing and accents for display.
export type DictRecord = Lemma & { wordLower: string };

// Folds a word to its lookup key: NFD-decompose, drop combining diacritics, and
// lowercase. Must be applied identically to the stored key (transformDict) and to
// every query (dict-store) so they match. Display text is never folded.
export function foldKey(word: string): string {
  return word.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
}

export interface MetaRecord {
  key: string;
  value: string;
}

export interface DictDB {
  lemmas: {
    value: DictRecord;
    key: number;
    indexes: {
      'by-lang-wordlower': [string, string];
    };
  };
  meta: {
    value: MetaRecord;
    key: string;
  };
}

export interface CompiledWord {
  word: string;
  lang: string;
  // Optional only because the compiled JSON is untrusted at runtime (nothing
  // validates a downloaded asset against this interface). The compiler always
  // emits it; absent is defaulted to 1 (a real keyword) at the two read sites
  // below, so a malformed asset degrades to "shown" rather than "silently
  // hidden". Stored records carry it unconditionally -- see Lemma.keyword.
  keyword?: 0 | 1;
}

export interface CompiledLemma {
  text: string;
  base: string;
  homonym: number;
  words: CompiledWord[];
  // Present only for lemmas from a Teeuw supplement (`teeuw.a+.md`) file.
  isSupplement?: boolean;
}

export interface CompiledDict {
  targetLang: string;
  lemmas: CompiledLemma[];
}

// Classify a compiled line from its keyword ROLES (not its rendered text), so
// the dictionary view can show progressive detail tiers. `data.targetLang` is
// the headword (source) language; target-language gloss words also carry
// `keyword: 1`, so we restrict to source-language keywords:
//   - no source keyword          → 'usage'    (an italic example phrase only)
//   - the block's base is one     → 'headword' (a sense of the entry itself)
//   - some other source word is   → 'derived'  (e.g. `berabang` under `abang`)
export function classifyLine(lemma: CompiledLemma, srcLang: string): LineKind {
  const srcKeywords = lemma.words.filter((w) => w.lang === srcLang && (w.keyword ?? 1) === 1);
  if (srcKeywords.length === 0) return 'usage';
  return srcKeywords.some((w) => w.word === lemma.base) ? 'headword' : 'derived';
}

export function transformDict(data: CompiledDict): DictRecord[] {
  const records: DictRecord[] = [];
  for (const lemma of data.lemmas) {
    const lineKind = classifyLine(lemma, data.targetLang);
    for (const wordDef of lemma.words) {
      records.push({
        word: wordDef.word,
        wordLower: foldKey(wordDef.word),
        lang: wordDef.lang,
        // The one place the absent-keyword default is applied, so every stored
        // record carries the flag and readers can test it as a plain `=== 1`.
        keyword: wordDef.keyword ?? 1,
        baseWord: lemma.base,
        baseLang: data.targetLang,
        text: lemma.text,
        homonym: lemma.homonym,
        ...(lemma.isSupplement ? { isSupplement: true } : {}),
        // Omit the common 'headword' (read back as the default) to save space,
        // mirroring the isSupplement pattern above.
        ...(lineKind !== 'headword' ? { lineKind } : {}),
      });
    }
  }
  return records;
}

export function openDictDb(): Promise<IDBPDatabase<DictDB>> {
  return openDB<DictDB>(DICT_DB_NAME, DICT_DB_VERSION, {
    // Destructive upgrade: drop whatever is there and rebuild from scratch.
    //
    // Two reasons. First, correctness: `upgrade` fires on an EXISTING database
    // whenever DICT_DB_VERSION goes up, and `createObjectStore` throws
    // ConstraintError if the store is already there — so a plain create-only
    // callback works on a fresh install and breaks on every installed client the
    // moment the version is bumped. Second, this database holds no authoritative
    // state: every record is derived from `/assets/dict-*.json`, so there is
    // nothing to migrate. Wiping costs one re-import and the existing readiness
    // machinery already covers it — `meta.version` goes with the stores, so
    // `hasCompleteDict$` is false and `syncIfNeeded()` re-downloads.
    //
    // Bumping DICT_DB_VERSION is therefore the whole procedure for a schema
    // change; no per-version migration branches, and no index left behind
    // (the 3 -> 4 bump dropped two indexes that this callback never deleted).
    upgrade(db) {
      for (const name of db.objectStoreNames) {
        db.deleteObjectStore(name);
      }
      const lemmaStore = db.createObjectStore('lemmas', { autoIncrement: true });
      // [lang, wordLower] ordering pins language as the primary key so IDBKeyRange
      // prefix queries are language-scoped (findWordsStartingWith), and the
      // lowercased word makes lookups case-insensitive ("belanda" finds "Belanda").
      lemmaStore.createIndex('by-lang-wordlower', ['lang', 'wordLower'], { unique: false });
      db.createObjectStore('meta', { keyPath: 'key' });
    },
    // An upgrade cannot start while another connection still holds the database
    // at the old version — typically a second tab left open across a deploy.
    // Without these two callbacks that `openDB()` never settles: no error, no
    // timeout, just a dictionary that silently never loads.
    blocking(_currentVersion, _blockedVersion, event) {
      // We are the stale connection. `close()` lets any in-flight transaction
      // finish first (so a running import still commits), then releases the
      // database so the upgrading tab can proceed. This connection stays closed
      // — reopening would immediately block that tab again, and this tab is
      // running the previous build anyway. Its dictionary reads will fail until
      // the user reloads; that is the accepted cost of unblocking the new tab.
      (event.target as IDBDatabase).close();
      console.warn('[dict] closed a stale IndexedDB connection to let a schema upgrade proceed');
    },
    blocked(currentVersion, blockedVersion) {
      console.warn(
        `[dict] IndexedDB upgrade ${currentVersion} -> ${blockedVersion} is blocked by another open connection`,
      );
    },
  });
}

// --- Worker message protocol -------------------------------------------------
//
// The main thread posts one `ImportRequest`. The worker streams `ImportProgress`
// updates and ends with a single `ImportResult`. The worker writes records
// directly to the shared IndexedDB — payloads stay tiny.

export interface ImportRequest {
  files: string[];
  version: string;
}

export interface ImportProgress {
  type: 'progress';
  phase: 'downloading' | 'importing';
  loaded: number;
  total: number;
}

export type ImportResult = { type: 'done' } | { type: 'error'; error: string };

export type ImportMessage = ImportProgress | ImportResult;
