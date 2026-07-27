// Tests for the read side of the dictionary IndexedDB layer.
//
// These run against `fake-indexeddb`, a spec-faithful in-memory IndexedDB, so
// the real `openDictDb()` schema, the real compound index, and the real cursor
// walk are all exercised -- nothing here is a mock of our own code. What they do
// NOT cover is browser-specific behaviour (Safari quirks, quota eviction) and
// the write path in `dict-import.worker.ts`.
//
// Read them as worked examples: each one seeds a handful of records, says what
// the store should make of them, and names the rule it is demonstrating.

// `/auto` installs the whole IndexedDB global family (IDBRequest, IDBKeyRange,
// ...), not just `indexedDB` -- idb does `instanceof IDBRequest` internally.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { DictRecord, foldKey, openDictDb } from './dict-db';
import { DictStoreService } from './dict-store.service';

// One fixture record = one word occurrence on one dictionary line. `wordLower`
// is derived exactly as the importer derives it, so the index keys match what
// production would store.
function record(word: string, opts: Partial<DictRecord> = {}): DictRecord {
  return {
    word,
    wordLower: foldKey(word),
    lang: 'id',
    keyword: 1,
    baseWord: word,
    baseLang: 'id',
    text: `**${word}**, glosse`,
    homonym: 0,
    ...opts,
  };
}

async function seed(records: DictRecord[]): Promise<DictStoreService> {
  const db = await openDictDb();
  const tx = db.transaction('lemmas', 'readwrite');
  // Insertion order is the autoIncrement primary key, which is also the order
  // records with an equal index key come back in -- so the fixtures below can
  // deliberately put a cross-reference *before* the real entry.
  for (const r of records) tx.store.add(r);
  await tx.done;
  db.close();

  const service = new DictStoreService();
  await service.open();
  return service;
}

beforeEach(() => {
  // A fresh in-memory IndexedDB per test. Cheaper and more reliable than
  // deleting the database, which would have to wait on open connections.
  globalThis.indexedDB = new IDBFactory();
});

describe('findWordsStartingWith', () => {
  it('emits one suggestion per word, however many records that word has', async () => {
    // `makan` appears on three lines of the dictionary. The dropdown should
    // offer it once, not three times.
    const store = await seed([
      record('makan'),
      record('makan', { text: '**makan** hati, zich ergeren' }),
      record('makan', { homonym: 1 }),
    ]);

    expect(await store.findWordsStartingWith('mak', 'id', 10)).toEqual([
      { word: 'makan', lang: 'id', isSupplement: false },
    ]);
  });

  it('matches case-insensitively and shows the original casing', async () => {
    // Teeuw stores the proper noun capitalised. Both the stored key and the
    // typed prefix are folded, so it does not matter which case either is in.
    // The dropdown must still read "Belanda".
    const store = await seed([record('Belanda')]);

    for (const typed of ['bel', 'Bel', 'BEL']) {
      const hits = await store.findWordsStartingWith(typed, 'id', 10);
      expect(
        hits.map((h) => h.word),
        `typed "${typed}"`,
      ).toEqual(['Belanda']);
    }
  });

  it('matches accent-insensitively and keeps the accent for display', async () => {
    // Stevens writes an acute accent as a pronunciation aid. Typing plain ASCII
    // has to find it -- and so does typing the accent, since the prefix is
    // folded the same way. The accent belongs on screen either way.
    const store = await seed([record('boléh')]);

    for (const typed of ['bol', 'bolé', 'BOLÉ']) {
      const hits = await store.findWordsStartingWith(typed, 'id', 10);
      expect(
        hits.map((h) => h.word),
        `typed "${typed}"`,
      ).toEqual(['boléh']);
    }
  });

  it('collapses casing variants of the same word into one suggestion', async () => {
    // Both fold to the key "belanda", so they are one group.
    const store = await seed([record('Belanda'), record('belanda')]);

    expect(await store.findWordsStartingWith('bel', 'id', 10)).toHaveLength(1);
  });

  it('shows the real entry, not a capitalised cross-reference to it', async () => {
    // `KERÉTA` is how the word is written inside *another* entry's cross-
    // reference; it is not an entry itself (keyword 0). It is seeded first, so
    // without the preference rule the dropdown would show "KERÉTA".
    const store = await seed([record('KERÉTA', { keyword: 0 }), record('keréta')]);

    const hits = await store.findWordsStartingWith('ker', 'id', 10);

    expect(hits.map((h) => h.word)).toEqual(['keréta']);
  });

  it('does not suggest a word that only ever appears as a cross-reference', async () => {
    // No record carries `sepur` as a keyword, so it has no entry of its own.
    // Looking it up would come back empty, so it must not be offered. Being the
    // only group, it is decided by the flush after the cursor runs out.
    const store = await seed([record('sepur', { keyword: 0 })]);

    expect(await store.findWordsStartingWith('sep', 'id', 10)).toEqual([]);
  });

  it('skips a cross-reference-only word mid-scan and carries on', async () => {
    // Same rule, other code path: the cursor walks in folded-key order, so
    // `sepak` here is decided at a group boundary rather than at the end. The
    // skip must not swallow the words that follow it.
    const store = await seed([
      record('sepak', { keyword: 0 }), // cross-reference only -- skipped
      record('sepeda'),
      record('sepur'),
    ]);

    const hits = await store.findWordsStartingWith('sep', 'id', 10);

    expect(hits.map((h) => h.word)).toEqual(['sepeda', 'sepur']);
  });

  it('stops at the limit', async () => {
    const store = await seed([record('satu'), record('sate'), record('sawah'), record('sabun')]);

    expect(await store.findWordsStartingWith('sa', 'id', 2)).toHaveLength(2);
  });

  it('returns the last word in the range when the limit is not reached', async () => {
    // The final group is emitted after the cursor runs out, not at a boundary
    // -- a different code path from every other suggestion.
    const store = await seed([record('satu'), record('sawah')]);

    const hits = await store.findWordsStartingWith('sa', 'id', 10);

    expect(hits.map((h) => h.word)).toEqual(['satu', 'sawah']);
  });

  it('searches only the requested language', async () => {
    // The same prefix exists in both halves of the dictionary.
    const store = await seed([record('makan'), record('maken', { lang: 'nl' })]);

    expect((await store.findWordsStartingWith('mak', 'id', 10)).map((h) => h.word)).toEqual([
      'makan',
    ]);
    expect((await store.findWordsStartingWith('mak', 'nl', 10)).map((h) => h.word)).toEqual([
      'maken',
    ]);
  });

  it('marks a word as new only when every one of its records is a supplement', async () => {
    // `akun` exists only in the post-1996 supplement -> flagged (amber).
    // `angin` and `aplikasi` are in the supplement AND in core Teeuw -> not new
    // words. They are seeded in opposite orders on purpose: the flag is an AND
    // across every record in the group, so neither the first nor the last one
    // may decide it alone.
    const store = await seed([
      record('akun', { isSupplement: true }),
      record('angin'), // core first...
      record('angin', { isSupplement: true }),
      record('aplikasi', { isSupplement: true }), // ...supplement first
      record('aplikasi'),
    ]);

    const hits = await store.findWordsStartingWith('a', 'id', 10);

    expect(hits).toEqual([
      { word: 'akun', lang: 'id', isSupplement: true },
      { word: 'angin', lang: 'id', isSupplement: false },
      { word: 'aplikasi', lang: 'id', isSupplement: false },
    ]);
  });

  it('returns nothing for a prefix that matches no word', async () => {
    const store = await seed([record('makan')]);

    expect(await store.findWordsStartingWith('zzz', 'id', 10)).toEqual([]);
  });
});

describe('findByWordAndLang', () => {
  it('finds a word however the user typed its case and accents', async () => {
    const store = await seed([record('Belanda'), record('boléh')]);

    expect(await store.findByWordAndLang('belanda', 'id')).toHaveLength(1);
    expect(await store.findByWordAndLang('BOLEH', 'id')).toHaveLength(1);
  });

  it('returns every line mentioning the word, including mention-only lines', async () => {
    // The dictionary page wants the usage lines too, so the default is
    // unfiltered.
    const store = await seed([record('ékor'), record('ékor', { keyword: 0 })]);

    expect(await store.findByWordAndLang('ekor', 'id')).toHaveLength(2);
  });

  it('drops mention-only lines when keywordOnly is set (the word-tap modal)', async () => {
    const store = await seed([record('ékor'), record('ékor', { keyword: 0 })]);

    const lemmas = await store.findByWordAndLang('ekor', 'id', true);

    expect(lemmas).toHaveLength(1);
    expect(lemmas[0].keyword).toBe(1);
  });

  it('orders homonyms by their homonym number, not by insertion order', async () => {
    const store = await seed([
      record('bisa', { homonym: 2, text: '**bisa** II, gif' }),
      record('bisa', { homonym: 1, text: '**bisa** I, kunnen' }),
    ]);

    const lemmas = await store.findByWordAndLang('bisa', 'id');

    expect(lemmas.map((l) => l.homonym)).toEqual([1, 2]);
  });

  it('returns an empty array for an unknown word', async () => {
    const store = await seed([record('makan')]);

    expect(await store.findByWordAndLang('nietbestaand', 'id')).toEqual([]);
  });

  it('does not find a word filed under the other language', async () => {
    const store = await seed([record('maken', { lang: 'nl' })]);

    expect(await store.findByWordAndLang('maken', 'id')).toEqual([]);
  });
});

describe('getStoredVersion and count', () => {
  it('reports no version before anything has been imported', async () => {
    const store = await seed([]);

    expect(await store.getStoredVersion()).toBeNull();
  });

  it('reports the version the importer stamped, and the record count', async () => {
    const store = await seed([record('makan'), record('minum')]);

    const db = await openDictDb();
    await db.put('meta', { key: 'version', value: '2026-07-27' });
    db.close();

    expect(await store.getStoredVersion()).toBe('2026-07-27');
    expect(await store.count()).toBe(2);
  });
});
