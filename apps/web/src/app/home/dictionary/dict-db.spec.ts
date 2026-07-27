import { describe, expect, it } from 'vitest';
import { CompiledDict, foldKey, transformDict } from './dict-db';

describe('foldKey', () => {
  it('lowercases', () => {
    expect(foldKey('Belanda')).toBe('belanda');
  });

  it('strips diacritics so accented words fold to ASCII (Stevens uses é)', () => {
    expect(foldKey('boléh')).toBe('boleh');
    expect(foldKey('Café')).toBe('cafe');
    expect(foldKey('coördinatie')).toBe('coordinatie');
  });

  it('leaves plain ASCII unchanged (the common case)', () => {
    expect(foldKey('makan')).toBe('makan');
  });
});

describe('transformDict', () => {
  it('adds a folded wordLower key for each record while preserving the display word', () => {
    const dict: CompiledDict = {
      targetLang: 'id',
      lemmas: [
        {
          text: 'Belanda, Nederland(s)',
          base: 'Belanda',
          homonym: 0,
          words: [{ word: 'Belanda', lang: 'id', keyword: 1 }],
        },
      ],
    };

    const [record] = transformDict(dict);

    expect(record.word).toBe('Belanda');
    expect(record.wordLower).toBe('belanda');
  });

  it('folds accents in wordLower while keeping the accented display word', () => {
    const dict: CompiledDict = {
      targetLang: 'id',
      lemmas: [
        {
          text: '**boléh**, may, can',
          base: 'boléh',
          homonym: 0,
          words: [{ word: 'boléh', lang: 'id', keyword: 1 }],
        },
      ],
    };

    const [record] = transformDict(dict);

    expect(record.word).toBe('boléh'); // display keeps the pronunciation accent
    expect(record.wordLower).toBe('boleh'); // lookup key is ASCII
  });

  it('propagates isSupplement from a supplement lemma onto every word record, and omits it otherwise', () => {
    const dict: CompiledDict = {
      targetLang: 'id',
      lemmas: [
        {
          text: '**akun**, account',
          base: 'akun',
          homonym: 0,
          isSupplement: true,
          words: [
            { word: 'akun', lang: 'id', keyword: 1 },
            { word: 'account', lang: 'nl', keyword: 1 },
          ],
        },
        {
          text: '**adat**, gewoonte',
          base: 'adat',
          homonym: 0,
          words: [{ word: 'adat', lang: 'id', keyword: 1 }],
        },
      ],
    };

    const records = transformDict(dict);

    expect(records.find((r) => r.word === 'akun')?.isSupplement).toBe(true);
    expect(records.find((r) => r.word === 'account')?.isSupplement).toBe(true);
    expect(records.find((r) => r.word === 'adat')?.isSupplement).toBeUndefined();
  });
});
