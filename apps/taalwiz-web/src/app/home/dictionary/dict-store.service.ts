import { Injectable } from '@angular/core';
import { IDBPDatabase, openDB } from 'idb';
import { ILemma } from './lemma/lemma.model';

type DictRecord = ILemma;

interface MetaRecord {
  key: string;
  value: string;
}

interface DictDB {
  lemmas: {
    value: DictRecord;
    key: number;
    indexes: {
      'by-word-lang': [string, string];
      'by-word': string;
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
  baseLang: string;
  lemmas: CompiledLemma[];
}

export function transformDict(data: CompiledDict): ILemma[] {
  const records: ILemma[] = [];
  for (const lemma of data.lemmas) {
    for (const wordDef of lemma.words) {
      records.push({
        word: wordDef.word,
        lang: wordDef.lang,
        keyword: wordDef.keyword,
        baseWord: lemma.base,
        baseLang: data.baseLang,
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
    this.#db = await openDB<DictDB>('taalwiz-dict', 1, {
      upgrade(db) {
        const lemmaStore = db.createObjectStore('lemmas', { autoIncrement: true });
        lemmaStore.createIndex('by-word-lang', ['word', 'lang'], { unique: false });
        lemmaStore.createIndex('by-word', 'word', { unique: false });

        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
  }

  async getStoredVersion(): Promise<string | null> {
    const record = await this.#db!.get('meta', 'version');
    return record?.value ?? null;
  }

  async replaceAll(lemmas: ILemma[], version: string): Promise<void> {
    const tx = this.#db!.transaction(['lemmas', 'meta'], 'readwrite');
    await tx.objectStore('lemmas').clear();
    for (const lemma of lemmas) {
      tx.objectStore('lemmas').add(lemma as DictRecord);
    }
    tx.objectStore('meta').put({ key: 'version', value: version });
    await tx.done;
  }

  async findByWordAndLang(word: string, lang: string, keywordOnly = false): Promise<ILemma[]> {
    const results = await this.#db!.getAllFromIndex(
      'lemmas',
      'by-word-lang',
      IDBKeyRange.only([word, lang]),
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
    // U+FFFF is the highest BMP code point and never assigned — anything starting with startString sorts before startString+U+FFFF
    const range = IDBKeyRange.bound(startString, startString + '￿');
    const index = this.#db!.transaction('lemmas', 'readonly').store.index('by-word');
    const seen = new Set<string>();
    const results: { word: string; lang: string }[] = [];

    let cursor = await index.openCursor(range);
    while (cursor && results.length < limit) {
      const { word, lang: recordLang } = cursor.value;
      if (recordLang === lang) {
        const key = word + '|' + lang;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ word, lang });
        }
      }
      cursor = await cursor.continue();
    }

    return results;
  }

  async count(): Promise<number> {
    return this.#db!.count('lemmas');
  }
}
