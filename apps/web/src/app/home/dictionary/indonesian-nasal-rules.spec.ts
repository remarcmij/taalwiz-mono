import { describe, expect, it } from 'vitest';
import { nasalCandidates, prefixWithMeN } from './indonesian-nasal-rules';

describe('nasalCandidates', () => {
  // Convenience: just the remainder strings, which is what the variation generator uses.
  const remainders = (form: string, stem: string) =>
    nasalCandidates(form, stem).map((c) => c.remainder);

  describe('meN- (stem "me")', () => {
    it('meng- restores an elided k before a vowel: mengumpul -> kumpul', () => {
      expect(remainders('mengumpul', 'me')).toContain('kumpul');
    });

    it('meng- does NOT restore k before g/h (non-eliding allomorph): menggali -> gali', () => {
      const r = remainders('menggali', 'me');
      expect(r).toContain('gali');
      expect(r).not.toContain('kgali');
    });

    it('meny- restores s: menyapu -> sapu', () => {
      expect(remainders('menyapu', 'me')).toContain('sapu');
    });

    it('mem- restores p, but not before b/f: memotong -> potong; membaca keeps baca only', () => {
      expect(remainders('memotong', 'me')).toContain('potong');
      const baca = remainders('membaca', 'me');
      expect(baca).toContain('baca');
      expect(baca).not.toContain('pbaca');
    });

    it('men- restores t, but not before d/c/j/z or sy: menulis -> tulis', () => {
      expect(remainders('menulis', 'me')).toContain('tulis');
      expect(remainders('mencuci', 'me')).not.toContain('tcuci');
    });

    it('bare me- before a liquid/nasal root: melihat -> lihat', () => {
      expect(remainders('melihat', 'me')).toContain('lihat');
    });

    it('emits the bare nasal-initial root case: menganga -> nganga', () => {
      expect(remainders('menganga', 'me')).toContain('nganga');
    });

    it('returns [] when the form does not start with the stem', () => {
      expect(nasalCandidates('berlari', 'me')).toEqual([]);
    });
  });

  describe('peN- (stem "pe")', () => {
    it('peng- restores an elided k before a vowel: pengumpul -> kumpul', () => {
      expect(remainders('pengumpul', 'pe')).toContain('kumpul');
    });

    it('peny- restores s: penyapu -> sapu', () => {
      expect(remainders('penyapu', 'pe')).toContain('sapu');
    });

    it('pem- restores p: pemukul -> pukul', () => {
      expect(remainders('pemukul', 'pe')).toContain('pukul');
    });

    it('pen- restores t: penulis -> tulis', () => {
      expect(remainders('penulis', 'pe')).toContain('tulis');
    });
  });

  describe('rule-note metadata', () => {
    it('flags the restored consonant and surface allomorph', () => {
      const restored = nasalCandidates('mengumpul', 'me').find((c) => c.restored);
      expect(restored).toEqual({ remainder: 'kumpul', restored: 'k', surface: 'meng-' });
    });

    it('marks the bare remainder as unrestored', () => {
      const [bare] = nasalCandidates('menyapu', 'me');
      expect(bare).toEqual({ remainder: 'apu', restored: null, surface: 'meny-' });
    });
  });

  describe('onset precedence (most-specific wins)', () => {
    it('treats meng... as meng-, not men-: the t-restored "tg..." never appears', () => {
      // "menggali" starts with both "men" and "meng"; only the meng- row should fire.
      const r = remainders('menggali', 'me');
      expect(r).toContain('gali');
      expect(r).not.toContain('tggali');
    });
  });
});

describe('prefixWithMeN (root -> active meN- surface form)', () => {
  // Each row exercises one allomorph/onset; the inverse of nasalCandidates(.., 'me').
  const cases: [string, string][] = [
    // vowel onsets -> meng-, nothing elided
    ['ambil', 'mengambil'],
    ['elok', 'mengelok'],
    ['isi', 'mengisi'],
    ['obat', 'mengobat'],
    ['urus', 'mengurus'],
    // b/f -> mem-, kept
    ['baca', 'membaca'],
    ['foto', 'memfoto'],
    // p -> mem-, elided
    ['potong', 'memotong'],
    ['pukul', 'memukul'],
    // per-/pelajar- exceptions: p kept
    ['pergi', 'mempergi'],
    ['pelajari', 'mempelajari'],
    // t -> men-, elided
    ['tulis', 'menulis'],
    // d/c/j/z/sy -> men-, kept (sy before s)
    ['dapat', 'mendapat'],
    ['cuci', 'mencuci'],
    ['jual', 'menjual'],
    ['zakat', 'menzakat'],
    ['syarat', 'mensyarat'],
    // s -> meny-, elided
    ['sapu', 'menyapu'],
    // k -> meng-, elided; but kh kept
    ['kumpul', 'mengumpul'],
    ['khusus', 'mengkhusus'],
    // g/h -> meng-, kept
    ['gali', 'menggali'],
    ['hitung', 'menghitung'],
    // liquids/nasals/glides -> me-, kept (n subsumes ny-, ng-)
    ['lihat', 'melihat'],
    ['rasa', 'merasa'],
    ['makan', 'memakan'],
    ['nilai', 'menilai'],
    ['nyala', 'menyala'],
    ['ngeri', 'mengeri'],
    ['waris', 'mewaris'],
    ['yakin', 'meyakin'],
  ];

  for (const [root, surface] of cases) {
    it(`${root} -> ${surface}`, () => expect(prefixWithMeN(root)).toBe(surface));
  }

  it('returns the root unchanged when no onset rule matches', () => {
    expect(prefixWithMeN('123')).toBe('123');
  });

  it('is consistent with nasalCandidates: the built form strips back to the root', () => {
    // Forward then inverse should recover the root among the candidates.
    for (const [root, surface] of cases) {
      if (surface === root) continue;
      const back = nasalCandidates(surface, 'me').map((c) => c.remainder);
      expect(back).toContain(root);
    }
  });
});
