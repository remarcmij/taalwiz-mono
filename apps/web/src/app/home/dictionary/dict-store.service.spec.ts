import { describe, expect, it } from 'vitest';
import { CompiledDict, transformDict } from './dict-db';

describe('transformDict', () => {
  it('adds a lowercased wordLower key for each record while preserving the display word', () => {
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

  it('propagates teeuwPlus from a supplement lemma onto every word record, and omits it otherwise', () => {
    const dict: CompiledDict = {
      targetLang: 'id',
      lemmas: [
        {
          text: '**akun**, account',
          base: 'akun',
          homonym: 0,
          teeuwPlus: true,
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

    expect(records.find((r) => r.word === 'akun')?.teeuwPlus).toBe(true);
    expect(records.find((r) => r.word === 'account')?.teeuwPlus).toBe(true);
    expect(records.find((r) => r.word === 'adat')?.teeuwPlus).toBeUndefined();
  });
});
