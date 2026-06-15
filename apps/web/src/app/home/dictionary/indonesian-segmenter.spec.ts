import { describe, expect, it } from 'vitest';
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
      // ber- -> be- allomorph: the -r elides before an -er-first-syllable or
      // r-initial root. Labelled by the ber- archiphoneme.
      ['bekerja', 'kerja', ['ber-', 'kerja']],
      ['beternak', 'ternak', ['ber-', 'ternak']],
      ['beserta', 'serta', ['ber-', 'serta']],
      ['beragam', 'ragam', ['ber-', 'ragam']],
      ['berumah', 'rumah', ['ber-', 'rumah']],
      // bel- lexical exception (belajar / belunjur).
      ['belajar', 'ajar', ['ber-', 'ajar']],
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

    it('does not apply the be- allomorph to be-initial non-derivations', () => {
      // The root is neither r-initial nor -er-first-syllable, so "be" is not ber-.
      expect(seg('betapa', 'tapa')).toBeNull();
      expect(seg('begitu', 'gitu')).toBeNull();
      expect(seg('belum', 'lum')).toBeNull();
      expect(seg('benar', 'nar')).toBeNull();
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

  // The meN-/peN- nasal allomorphy is now shared with the variation generator via
  // indonesian-nasal-rules.ts (tested directly in indonesian-nasal-rules.spec.ts),
  // so there is no longer a hand-port to keep in sync here.
});
