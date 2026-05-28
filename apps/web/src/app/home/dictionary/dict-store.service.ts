import { Injectable } from '@angular/core';
import { IDBPDatabase, openDB } from 'idb';
import { ILemma } from './lemma/lemma.model';

// `wordLower` is a stored-only field: the lowercased `word` used as the lookup
// key so searches are case-insensitive (e.g. typing "belanda" finds "Belanda").
// `word` keeps its original casing for display.
export type DictRecord = ILemma & { wordLower: string };

interface MetaRecord {
  key: string;
  value: string;
}

interface DictDB {
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
  order: number;
}

export interface CompiledLemma {
  text: string;
  base: string;
  homonym: number;
  words: CompiledWord[];
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
        wordLower: wordDef.word.toLowerCase(),
        lang: wordDef.lang,
        keyword: wordDef.keyword,
        baseWord: lemma.base,
        baseLang: data.targetLang,
        text: lemma.text,
        homonym: lemma.homonym,
      });
    }
  }
  return records;
}

@Injectable({ providedIn: 'root' })
export class DictStoreService {
  #db: IDBPDatabase<DictDB> | null = null;

  async open(): Promise<void> {
    if (this.#db) return;
    this.#db = await openDB<DictDB>('taalwiz-dict', 4, {
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

  async getStoredVersion(): Promise<string | null> {
    const record = await this.#db!.get('meta', 'version');
    return record?.value ?? null;
  }

  async replaceAll(lemmas: DictRecord[], version: string): Promise<void> {
    const tx = this.#db!.transaction(['lemmas', 'meta'], 'readwrite');
    const store = tx.objectStore('lemmas');
    await store.clear();
    // Fire the adds without awaiting each one — the single index (by-lang-wordlower)
    // keeps per-record maintenance minimal and the transaction commits in one batch.
    for (const lemma of lemmas) {
      void store.add(lemma);
    }
    tx.objectStore('meta').put({ key: 'version', value: version });
    await tx.done;
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
  ): Promise<{ word: string; lang: string }[]> {
    // [lang, wordLower] ordering lets the range pin lang as the primary key and
    // bound the lowercased word by prefix — IndexedDB never visits entries from
    // other languages, and matching is case-insensitive.
    const start = startString.toLowerCase();
    const range = IDBKeyRange.bound([lang, start], [lang, start + '￿']);
    const index = this.#db!.transaction('lemmas', 'readonly').store.index('by-lang-wordlower');
    const seen = new Set<string>();
    const results: { word: string; lang: string }[] = [];

    let cursor = await index.openCursor(range);
    while (cursor && results.length < limit) {
      const { word, wordLower } = cursor.value;
      // Dedupe case-insensitively so "Belanda" and "belanda" yield one suggestion.
      if (!seen.has(wordLower)) {
        seen.add(wordLower);
        results.push({ word, lang });
      }
      cursor = await cursor.continue();
    }

    return results;
  }

  async count(): Promise<number> {
    return this.#db!.count('lemmas');
  }
}
