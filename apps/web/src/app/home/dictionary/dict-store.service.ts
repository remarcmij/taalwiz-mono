import { Injectable } from '@angular/core';
import { IDBPDatabase } from 'idb';
import { DictDB, openDictDb } from './dict-db';
import { ILemma } from './lemma/lemma.model';

// This service is now read-only — the dictionary import runs in
// `dict-import.worker.ts` and writes directly to the shared IndexedDB. The DB
// schema, types, and `transformDict` live in `./dict-db.ts` so the worker can
// reuse them without dragging `@angular/core` into the worker bundle.

@Injectable({ providedIn: 'root' })
export class DictStoreService {
  #db: IDBPDatabase<DictDB> | null = null;

  async open(): Promise<void> {
    if (this.#db) return;
    this.#db = await openDictDb();
  }

  async getStoredVersion(): Promise<string | null> {
    const record = await this.#db!.get('meta', 'version');
    return record?.value ?? null;
  }

  async findByWordAndLang(word: string, lang: string, keywordOnly = false): Promise<ILemma[]> {
    // Match on the lowercased key so lookups are case-insensitive — the headword
    // "Belanda" is found whether the user typed "belanda" or "Belanda".
    const results = await this.#db!.getAllFromIndex(
      'lemmas',
      'by-lang-wordlower',
      IDBKeyRange.only([lang, word.toLowerCase()]),
    );
    return results
      .filter((lemma) => !keywordOnly || (lemma.keyword ?? 1) === 1)
      .sort((a, b) => a.homonym - b.homonym);
  }

  async findWordsStartingWith(
    startString: string,
    lang: string,
    limit: number,
  ): Promise<{ word: string; lang: string; isSupplement?: boolean }[]> {
    // [lang, wordLower] ordering lets the range pin lang as the primary key and
    // bound the lowercased word by prefix — IndexedDB never visits entries from
    // other languages, and matching is case-insensitive.
    const start = startString.toLowerCase();
    const range = IDBKeyRange.bound([lang, start], [lang, start + '￿']);
    const index = this.#db!.transaction('lemmas', 'readonly').store.index('by-lang-wordlower');
    const results: { word: string; lang: string; isSupplement?: boolean }[] = [];

    // Records sharing a wordLower are consecutive in the index, so accumulate
    // each group before emitting one suggestion. `isSupplement` is set only when
    // EVERY record for the word is a supplement, so a word that also exists in
    // core Teeuw (e.g. "aplikasi") is not marked as a new word.
    let cursor = await index.openCursor(range);
    let curLower: string | null = null;
    let curWord = '';
    let curAllPlus = true;
    let have = false;

    while (cursor) {
      const { word, wordLower, isSupplement } = cursor.value;
      if (have && wordLower !== curLower) {
        // Dedupe case-insensitively so "Belanda" and "belanda" yield one suggestion.
        results.push({ word: curWord, lang, isSupplement: curAllPlus });
        if (results.length >= limit) return results;
        have = false;
      }
      if (!have) {
        curLower = wordLower;
        curWord = word;
        curAllPlus = true;
        have = true;
      }
      curAllPlus = curAllPlus && !!isSupplement;
      cursor = await cursor.continue();
    }

    if (have && results.length < limit) {
      results.push({ word: curWord, lang, isSupplement: curAllPlus });
    }

    return results;
  }

  async count(): Promise<number> {
    return this.#db!.count('lemmas');
  }
}
