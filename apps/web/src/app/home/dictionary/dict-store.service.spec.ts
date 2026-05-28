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
          words: [{ word: 'Belanda', lang: 'id', keyword: 1, order: 0 }],
        },
      ],
    };

    const [record] = transformDict(dict);

    expect(record.word).toBe('Belanda');
    expect(record.wordLower).toBe('belanda');
  });
});
