/// <reference types="jasmine" />
import { IndonesianStemmer } from './indonesian-stemmer';

describe('IndonesianStemmer', () => {
  let stemmer: IndonesianStemmer;

  beforeEach(() => {
    stemmer = new IndonesianStemmer();
  });

  const variations = (word: string) => stemmer.getWordVariations(word);

  describe('word exemptions', () => {
    it('returns only the word itself for exempt words', () => {
      expect(variations('aku')).toEqual(['aku']);
      expect(variations('bukan')).toEqual(['bukan']);
      expect(variations('ilmu')).toEqual(['ilmu']);
      expect(variations('kamu')).toEqual(['kamu']);
      expect(variations('tamu')).toEqual(['tamu']);
      expect(variations('temu')).toEqual(['temu']);
      expect(variations('dia')).toEqual(['dia']);
      expect(variations('ini')).toEqual(['ini']);
    });
  });

  describe('suffix stripping', () => {
    it('-nya', () => expect(variations('rumahnya')).toContain('rumah'));

    it('-ku', () => expect(variations('rumahku')).toContain('rumah'));

    it('-mu', () => expect(variations('rumahmu')).toContain('rumah'));

    it('-kau', () => expect(variations('rumahkau')).toContain('rumah'));

    it('-kah', () => expect(variations('dimanakah')).toContain('mana'));

    it('-lah', () => expect(variations('berikutlah')).toContain('berikut'));

    it('-pun', () => expect(variations('siapapun')).toContain('siapa'));

    it('-an', () => expect(variations('makanan')).toContain('makan'));
  });

  describe('prefix stripping', () => {
    it('ku-', () => expect(variations('kuambil')).toContain('ambil'));

    it('kau-', () => expect(variations('kauambil')).toContain('ambil'));

    it('mu-', () => expect(variations('muambil')).toContain('ambil'));

    it('di- strips to base', () =>
      expect(variations('diambil')).toContain('ambil'));

    it('di- generates meN- active variant', () =>
      expect(variations('diambil')).toContain('mengambil'));

    it('ter-', () => expect(variations('terima')).toContain('ima'));

    it('ber-', () => expect(variations('berbicara')).toContain('bicara'));

    it('se-', () => expect(variations('sehari')).toContain('hari'));

    it('ke-', () => expect(variations('ketua')).toContain('tua'));
  });

  describe('meN- prefix stripping (active voice)', () => {
    it('mem- + b/f root: membaca → baca', () =>
      expect(variations('membaca')).toContain('baca'));

    it('meng- + vowel root: mengambil → ambil', () =>
      expect(variations('mengambil')).toContain('ambil'));

    it('men- + d/c/j/z root: mendapat → dapat', () =>
      expect(variations('mendapat')).toContain('dapat'));

    it('men- + t root with restoration: menulis → tulis', () =>
      expect(variations('menulis')).toContain('tulis'));

    it('men- + s root with restoration: menyapu → sapu', () =>
      expect(variations('menyapu')).toContain('sapu'));

    it('mem- + p root with restoration: memotong → potong', () =>
      expect(variations('memotong')).toContain('potong'));

    it('meng- + k root with restoration: mengritik → kritik', () =>
      expect(variations('mengritik')).toContain('kritik'));

    it('me- + liquid root: melakukan → lakukan', () =>
      expect(variations('melakukan')).toContain('lakukan'));

    it('includes stripped form without restoration: menulis includes ulis', () =>
      expect(variations('menulis')).toContain('ulis'));
  });

  describe('peN- prefix stripping (agentive noun)', () => {
    it('pen- + t root with restoration: penulis → tulis', () =>
      expect(variations('penulis')).toContain('tulis'));

    it('pem- + b root: pembaca → baca', () =>
      expect(variations('pembaca')).toContain('baca'));

    it('peng- + vowel root: pengambil → ambil', () =>
      expect(variations('pengambil')).toContain('ambil'));

    it('pen- + s root with restoration: penyapu → sapu', () =>
      expect(variations('penyapu')).toContain('sapu'));

    it('includes stripped form without restoration: penulis includes ulis', () =>
      expect(variations('penulis')).toContain('ulis'));
  });

  describe('circumfix stripping', () => {
    it('ke-...-an: kebaikan → baik', () =>
      expect(variations('kebaikan')).toContain('baik'));

    it('ke-...-an: kehidupan → hidup', () =>
      expect(variations('kehidupan')).toContain('hidup'));

    it('per-...-an: perjalanan → jalan', () =>
      expect(variations('perjalanan')).toContain('jalan'));

    it('per-...-an: perbedaan → beda', () =>
      expect(variations('perbedaan')).toContain('beda'));

    it('pe-...-an: penulisan → tulis', () =>
      expect(variations('penulisan')).toContain('tulis'));

    it('pe-...-an: pembacaan → baca', () =>
      expect(variations('pembacaan')).toContain('baca'));
  });

  describe('reduplication', () => {
    it('anak-anak → anak', () =>
      expect(variations('anak-anak')).toContain('anak'));

    it('rumah-rumah → rumah', () =>
      expect(variations('rumah-rumah')).toContain('rumah'));
  });

  describe('complex multi-affix words', () => {
    it('dibakar: di- prefix + base', () => {
      expect(variations('dibakar')).toContain('bakar');
      expect(variations('dibakar')).toContain('membakar');
    });

    it('mengambilnya: meN- prefix + -nya suffix', () =>
      expect(variations('mengambilnya')).toContain('ambil'));

    it('berbicara: ber- prefix', () =>
      expect(variations('berbicara')).toContain('bicara'));
  });

  describe('original word is always included', () => {
    it('preserves the input word in variations', () => {
      expect(variations('membaca')).toContain('membaca');
      expect(variations('diambil')).toContain('diambil');
      expect(variations('kebaikan')).toContain('kebaikan');
      expect(variations('rumahnya')).toContain('rumahnya');
    });
  });

  describe('no duplicates in output', () => {
    it('returns a deduplicated list', () => {
      const vars = variations('membaca');
      expect(vars.length).toBe(new Set(vars).size);
    });

    it('complex word: dibakar', () => {
      const vars = variations('dibakar');
      expect(vars.length).toBe(new Set(vars).size);
    });

    it('complex word: mengambilnya', () => {
      const vars = variations('mengambilnya');
      expect(vars.length).toBe(new Set(vars).size);
    });
  });

  describe('documented test cases from SEARCH.md', () => {
    it('membaca should include baca', () =>
      expect(variations('membaca')).toContain('baca'));

    it('mengambil should include ambil', () =>
      expect(variations('mengambil')).toContain('ambil'));

    it('diambil should include ambil and mengambil (in correct order)', () => {
      const vars = variations('diambil');
      const mengambilIndex = vars.indexOf('mengambil');
      const ambilIndex = vars.indexOf('ambil');
      expect(mengambilIndex).toBeGreaterThan(-1);
      expect(ambilIndex).toBeGreaterThan(-1);
      // mengambil (active) should come before ambil (bare root) for API efficiency
      expect(mengambilIndex).toBeLessThan(ambilIndex);
    });

    it('makanan should include makan', () =>
      expect(variations('makanan')).toContain('makan'));

    it('berbicara should include bicara', () =>
      expect(variations('berbicara')).toContain('bicara'));

    it('kebaikan should include baik', () =>
      expect(variations('kebaikan')).toContain('baik'));

    it('perjalanan should include jalan', () =>
      expect(variations('perjalanan')).toContain('jalan'));

    it('penulis should include tulis', () =>
      expect(variations('penulis')).toContain('tulis'));
  });
});
