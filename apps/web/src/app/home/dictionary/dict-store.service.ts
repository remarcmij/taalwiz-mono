import { Injectable } from '@angular/core';
import { IDBPDatabase } from 'idb';
import { DictDB, foldKey, openDictDb } from './dict-db';
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
    // Match on the folded key so lookups are case- and accent-insensitive — the
    // headword "Belanda" is found whether the user typed "belanda" or "Belanda",
    // and Stevens' "boléh" is found by typing "boleh".
    const results = await this.#db!.getAllFromIndex(
      'lemmas',
      'by-lang-wordlower',
      IDBKeyRange.only([lang, foldKey(word)]),
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
    const start = foldKey(startString);
    const range = IDBKeyRange.bound([lang, start], [lang, start + '￿']);
    const index = this.#db!.transaction('lemmas', 'readonly').store.index('by-lang-wordlower');
    const results: { word: string; lang: string; isSupplement?: boolean }[] = [];

    // Records sharing a wordLower are consecutive in the index, so accumulate
    // each group before emitting one suggestion. `isSupplement` is set only when
    // EVERY record for the word is a supplement, so a word that also exists in
    // core Teeuw (e.g. "aplikasi") is not marked as a new word.
    //
    // The display form prefers a true headword (`keyword === 1`) over a
    // cross-reference mention (`keyword === 0`): the same folded key can be
    // captured from another entry in capitalized form (a cross-ref like
    // `→ KERÉTA` or an abbreviation expansion like `[Keréta Api]`), and that
    // record may sort first. Without this preference the dropdown would show
    // `KERÉTA`/`Keréta` instead of the actual headword `keréta`. A group with no
    // headword record (a pure cross-ref target) falls back to its first form.
    let cursor = await index.openCursor(range);
    let curLower: string | null = null;
    let curWord = '';
    let curHasHeadword = false;
    let curAllPlus = true;
    let have = false;

    while (cursor) {
      const { word, wordLower, isSupplement, keyword } = cursor.value;
      if (have && wordLower !== curLower) {
        // Dedupe case-insensitively so "Belanda" and "belanda" yield one suggestion.
        results.push({ word: curWord, lang, isSupplement: curAllPlus });
        if (results.length >= limit) return results;
        have = false;
      }
      if (!have) {
        curLower = wordLower;
        curWord = word;
        curHasHeadword = keyword === 1;
        curAllPlus = true;
        have = true;
      } else if (!curHasHeadword && keyword === 1) {
        // First real headword in this group wins the display slot over the
        // cross-reference form picked up earlier.
        curWord = word;
        curHasHeadword = true;
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
