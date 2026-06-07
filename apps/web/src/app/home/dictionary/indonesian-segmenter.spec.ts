import { describe, expect, it } from 'vitest';
import { IndonesianVariationGenerator } from './indonesian-variation-generator';
import { segmentIndonesian } from './indonesian-segmenter';

describe('segmentIndonesian', () => {
  const seg = (surface: string, root: string) => segmentIndonesian(surface, root);

  describe('flat breakdown (morphemes + display)', () => {
    // [surface, root, expected morphemes]
    const cases: [string, string, string[]][] = [
      ['memperbaiki', 'baik', ['meN-', 'per-', 'baik', '-i']],
      ['menyapukan', 'sapu', ['meN-', 'sapu', '-kan']],
      ['memotong', 'potong', ['meN-', 'potong']],
      ['menulis', 'tulis', ['meN-', 'tulis']],
      ['membaca', 'baca', ['meN-', 'baca']],
      ['memakan', 'makan', ['meN-', 'makan']], // bare me- + m-initial root
      ['dipukul', 'pukul', ['di-', 'pukul']],
      ['terbesar', 'besar', ['ter-', 'besar']],
      ['beruang', 'uang', ['ber-', 'uang']],
      ['kebesaran', 'besar', ['ke-', 'besar', '-an']],
      ['keberuntungan', 'untung', ['ke-', 'ber-', 'untung', '-an']],
      ['penyapu', 'sapu', ['peN-', 'sapu']],
      ['makanan', 'makan', ['makan', '-an']],
      ['bersihkan', 'bersih', ['bersih', '-kan']],
    ];

    for (const [surface, root, morphemes] of cases) {
      it(`${surface} -> ${root} = ${morphemes.join(' + ')}`, () => {
        const result = seg(surface, root);
        expect(result).not.toBeNull();
        expect(result!.morphemes).toEqual(morphemes);
        expect(result!.display).toBe(morphemes.join(' + '));
      });
    }
  });

  describe('root with no affixes', () => {
    it('returns the bare root, no rule note', () => {
      const result = seg('baik', 'baik');
      expect(result).toEqual({ morphemes: ['baik'], display: 'baik' });
    });
  });

  describe('nasal allomorphy rule notes', () => {
    it('emits a rule note when a root consonant is restored (s)', () => {
      expect(seg('menyapukan', 'sapu')!.ruleNote).toEqual({
        archiphoneme: 'meN-',
        surface: 'meny-',
        letter: 's',
      });
    });

    it('restores p (mem-)', () => {
      expect(seg('memotong', 'potong')!.ruleNote).toEqual({
        archiphoneme: 'meN-',
        surface: 'mem-',
        letter: 'p',
      });
    });

    it('restores t (men-)', () => {
      expect(seg('menulis', 'tulis')!.ruleNote).toEqual({
        archiphoneme: 'meN-',
        surface: 'men-',
        letter: 't',
      });
    });

    it('restores k elided before a vowel (meng-): mengumpulkan → kumpul', () => {
      const result = seg('mengumpulkan', 'kumpul')!;
      expect(result.display).toBe('meN- + kumpul + -kan');
      expect(result.ruleNote).toEqual({
        archiphoneme: 'meN-',
        surface: 'meng-',
        letter: 'k',
      });
    });

    it('peN- restores s', () => {
      expect(seg('penyapu', 'sapu')!.ruleNote).toEqual({
        archiphoneme: 'peN-',
        surface: 'peny-',
        letter: 's',
      });
    });

    it('emits NO rule note when nothing is restored', () => {
      expect(seg('membaca', 'baca')!.ruleNote).toBeUndefined();
      expect(seg('memperbaiki', 'baik')!.ruleNote).toBeUndefined();
      expect(seg('dipukul', 'pukul')!.ruleNote).toBeUndefined();
    });
  });

  describe('no analysis (null)', () => {
    it('returns null when no affix path reaches the root', () => {
      expect(seg('kucing', 'anjing')).toBeNull();
      expect(seg('rumah', 'mobil')).toBeNull();
      expect(seg('membaca', 'tulis')).toBeNull();
    });

    it('returns null for empty input', () => {
      expect(seg('', 'baik')).toBeNull();
      expect(seg('memukul', '')).toBeNull();
    });

    // NOTE: a genuine tie between two materially-different minimal analyses returns
    // null by design (see select() in indonesian-segmenter.ts). Such ties are very
    // rare because the known-root anchor strongly constrains the search, so there is
    // no natural fixture here; the no-path cases above exercise the null contract.
  });

  describe('surface normalisation and root casing', () => {
    it('lowercases and trims the surface', () => {
      expect(seg('  TerBesar ', 'besar')!.morphemes).toEqual(['ter-', 'besar']);
    });

    it('does not bridge to a capitalised (proper-noun) root', () => {
      // "terbesar" (biggest) must NOT attach to "Besar" (the calendar month), nor a
      // lowercase surface to any capitalised headword.
      expect(seg('terbesar', 'Besar')).toBeNull();
      expect(seg('mengindonesiakan', 'Indonesia')).toBeNull();
    });
  });

  // Anti-drift guard: the segmenter's nasal allomorphy is a hand-port of the
  // variation generator (indonesian-variation-generator.ts). If someone edits its
  // rules, this fails and signals the segmenter table needs the same edit.
  describe('consistency with IndonesianVariationGenerator', () => {
    const generator = new IndonesianVariationGenerator();
    const pairs: [string, string][] = [
      ['memperbaiki', 'baik'],
      ['menyapukan', 'sapu'],
      ['memotong', 'potong'],
      ['menulis', 'tulis'],
      ['membaca', 'baca'],
      ['dipukul', 'pukul'],
      ['terbesar', 'besar'],
      ['beruang', 'uang'],
      ['kebesaran', 'besar'],
      ['penyapu', 'sapu'],
    ];

    for (const [surface, root] of pairs) {
      it(`variations of ${surface} include ${root}`, () => {
        expect(generator.getWordVariations(surface)).toContain(root);
      });
    }
  });
});
