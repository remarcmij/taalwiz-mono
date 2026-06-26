// Framework-free dictionary IndexedDB layer.
//
// Kept free of `@angular/core` so the import Web Worker can bundle this module
// (and `transformDict`) without dragging Angular into the worker chunk. The
// service layer (`dict-store.service.ts`, `dict-sync.service.ts`) and the
// worker (`dict-import.worker.ts`) both import from here.

import { IDBPDatabase, openDB } from 'idb';
import { ILemma } from './lemma/lemma.model';

export const DICT_DB_NAME = 'taalwiz-dict';
export const DICT_DB_VERSION = 4;

// `wordLower` is a stored-only field: the folded `word` used as the lookup key so
// searches are case- AND accent-insensitive (typing "belanda" finds "Belanda";
// typing "boleh" finds Stevens' "boléh", where é is a pronunciation aid).
// `word` keeps its original casing and accents for display.
export type DictRecord = ILemma & { wordLower: string };

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
  keyword: number;
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

export function transformDict(data: CompiledDict): DictRecord[] {
  const records: DictRecord[] = [];
  for (const lemma of data.lemmas) {
    for (const wordDef of lemma.words) {
      records.push({
        word: wordDef.word,
        wordLower: foldKey(wordDef.word),
        lang: wordDef.lang,
        keyword: wordDef.keyword,
        baseWord: lemma.base,
        baseLang: data.targetLang,
        text: lemma.text,
        homonym: lemma.homonym,
        ...(lemma.isSupplement ? { isSupplement: true } : {}),
      });
    }
  }
  return records;
}

export function openDictDb(): Promise<IDBPDatabase<DictDB>> {
  return openDB<DictDB>(DICT_DB_NAME, DICT_DB_VERSION, {
    upgrade(db) {
      const lemmaStore = db.createObjectStore('lemmas', { autoIncrement: true });
      // [lang, wordLower] ordering pins language as the primary key so IDBKeyRange
      // prefix queries are language-scoped (findWordsStartingWith), and the
      // lowercased word makes lookups case-insensitive ("belanda" finds "Belanda").
      lemmaStore.createIndex('by-lang-wordlower', ['lang', 'wordLower'], { unique: false });
      db.createObjectStore('meta', { keyPath: 'key' });
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

export type ImportResult =
  | { type: 'done' }
  | { type: 'error'; error: string };

export type ImportMessage = ImportProgress | ImportResult;
