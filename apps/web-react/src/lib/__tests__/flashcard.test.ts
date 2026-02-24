import {
  shuffle,
  hasFlashCards,
  formatFlashcard,
  extractFlashcards,
} from '../flashcard.ts';
import type { FlashcardData } from '../../types/models.ts';

// --- shuffle ---

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle([...arr])).toHaveLength(arr.length);
  });

  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle([...arr]);
    expect(result.sort()).toEqual(arr.sort());
  });

  it('handles an empty array', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('handles a single-element array', () => {
    expect(shuffle([42])).toEqual([42]);
  });
});

// --- hasFlashCards ---

describe('hasFlashCards', () => {
  it('returns true when marker is present', () => {
    expect(hasFlashCards('some text <!-- flashcard --> more text')).toBe(true);
  });

  it('returns false when no marker is present', () => {
    expect(hasFlashCards('some plain text')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(hasFlashCards('')).toBe(false);
  });
});

// --- formatFlashcard ---

describe('formatFlashcard', () => {
  const data: FlashcardData = {
    index: 3,
    foreignText: 'rumah',
    nativeText: 'huis',
  };

  it('formats in nativeFirst mode', () => {
    const card = formatFlashcard(data, 'nl', 'id', 'nativeFirst');
    expect(card.prompt.text).toBe('huis');
    expect(card.prompt.lang).toBe('nl');
    expect(card.prompt.isForeign).toBe(false);
    expect(card.answer.text).toBe('rumah');
    expect(card.answer.lang).toBe('id');
    expect(card.answer.isForeign).toBe(true);
  });

  it('formats in foreignFirst mode', () => {
    const card = formatFlashcard(data, 'nl', 'id', 'foreignFirst');
    expect(card.prompt.text).toBe('rumah');
    expect(card.prompt.lang).toBe('id');
    expect(card.prompt.isForeign).toBe(true);
    expect(card.answer.text).toBe('huis');
    expect(card.answer.lang).toBe('nl');
    expect(card.answer.isForeign).toBe(false);
  });

  it('defaults to nativeFirst mode', () => {
    const card = formatFlashcard(data, 'nl', 'id');
    expect(card.prompt.isForeign).toBe(false);
    expect(card.answer.isForeign).toBe(true);
  });

  it('sets key to the data index', () => {
    const card = formatFlashcard(data, 'nl', 'id');
    expect(card.key).toBe(3);
  });
});

// --- extractFlashcards ---

describe('extractFlashcards', () => {
  it('extracts single-line format flashcards', () => {
    const html = [
      '<!-- flashcard -->',
      '## Vocab',
      'Het **rumah** is groot',
      'De **kucing** is klein',
      '<!-- end-flashcard -->',
    ].join('\n');

    const sections = extractFlashcards(html);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.title).toBe('Vocab');
    expect(sections[0]!.flashcards).toHaveLength(2);
    expect(sections[0]!.flashcards[0]!.foreignText).toBe('rumah');
    expect(sections[0]!.flashcards[0]!.nativeText).toBe('Het  is groot');
  });

  it('extracts unordered-list format flashcards', () => {
    const html = [
      '<!-- flashcard -->',
      '## Words',
      '- huis',
      '**rumah**',
      '',
      '- kat',
      '**kucing**',
      '',
      '<!-- end-flashcard -->',
    ].join('\n');

    const sections = extractFlashcards(html);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.title).toBe('Words');
    expect(sections[0]!.flashcards).toHaveLength(2);
    expect(sections[0]!.flashcards[0]!.nativeText).toBe('huis');
    expect(sections[0]!.flashcards[0]!.foreignText).toBe('rumah');
  });

  it('extracts heading title from section', () => {
    const html = [
      '<!-- flashcard -->',
      '### My Title',
      'A **word** here',
      '<!-- end-flashcard -->',
    ].join('\n');

    const sections = extractFlashcards(html);
    expect(sections[0]!.title).toBe('My Title');
  });

  it('handles multiple flashcard sections', () => {
    const html = [
      '<!-- flashcard -->',
      '## Section1',
      'A **b** c',
      '<!-- end-flashcard -->',
      'some other text',
      '<!-- flashcard -->',
      '## Section2',
      'D **e** f',
      '<!-- end-flashcard -->',
    ].join('\n');

    const sections = extractFlashcards(html);
    expect(sections).toHaveLength(2);
  });

  it('returns empty array when no markers present', () => {
    expect(extractFlashcards('plain text without markers')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractFlashcards('')).toEqual([]);
  });
});
