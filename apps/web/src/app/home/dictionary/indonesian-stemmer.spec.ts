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

    it('-kan', () => expect(variations('bukakan')).toContain('buka'));

    it('-i', () => expect(variations('ajari')).toContain('ajar'));

    it('-an', () => expect(variations('makanan')).toContain('makan'));
  });

  describe('prefix stripping', () => {
    it('ku-', () => expect(variations('kuambil')).toContain('ambil'));

    it('kau-', () => expect(variations('kauambil')).toContain('ambil'));

    it('mu-', () => expect(variations('muambil')).toContain('ambil'));

    it('di- generates meN- active variant (before bare root)', () => {
      const vars = variations('diambil');
      const mengambilIndex = vars.indexOf('mengambil');
      const ambilIndex = vars.indexOf('ambil');
      expect(mengambilIndex).toBeGreaterThan(-1);
      expect(ambilIndex).toBeGreaterThan(-1);
      expect(mengambilIndex).toBeLessThan(ambilIndex);
    });

    it('di- with k-initial root: dikritik generates mengritik', () => {
      const vars = variations('dikritik');
      const mengritikIndex = vars.indexOf('mengritik');
      const kritikIndex = vars.indexOf('kritik');
      expect(mengritikIndex).toBeGreaterThan(-1);
      expect(kritikIndex).toBeGreaterThan(-1);
      expect(mengritikIndex).toBeLessThan(kritikIndex);
    });

    it('ter-', () => expect(variations('terima')).toContain('ima'));

    it('ber-', () => expect(variations('berbicara')).toContain('bicara'));

    it('se-', () => expect(variations('sehari')).toContain('hari'));

    it('ke-', () => expect(variations('ketua')).toContain('tua'));

    it('per-', () => expect(variations('perbaik')).toContain('baik'));
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
    it('dibakar: di- prefix + base (membakar before bakar)', () => {
      const vars = variations('dibakar');
      const membakarIndex = vars.indexOf('membakar');
      const bakarIndex = vars.indexOf('bakar');
      expect(membakarIndex).toBeGreaterThan(-1);
      expect(bakarIndex).toBeGreaterThan(-1);
      // Active form before bare root for API efficiency
      expect(membakarIndex).toBeLessThan(bakarIndex);
    });

    it('mengambilnya: meN- prefix + -nya suffix (original first)', () => {
      const vars = variations('mengambilnya');
      const origIndex = vars.indexOf('mengambilnya');
      const ambilIndex = vars.indexOf('ambil');
      expect(origIndex).toBe(0); // Original should be first
      expect(ambilIndex).toBeGreaterThan(origIndex);
    });

    it('berbicara: ber- prefix', () =>
      expect(variations('berbicara')).toContain('bicara'));

    it('memperbaik: mem- + per- prefixes → baik', () =>
      expect(variations('memperbaik')).toContain('baik'));
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
    it('membaca should include baca (original first)', () => {
      const vars = variations('membaca');
      const origIndex = vars.indexOf('membaca');
      const bacaIndex = vars.indexOf('baca');
      expect(origIndex).toBe(0); // Original form first (might be indexed directly)
      expect(bacaIndex).toBeGreaterThan(origIndex);
    });

    it('mengambil should include ambil (original first)', () => {
      const vars = variations('mengambil');
      const origIndex = vars.indexOf('mengambil');
      const ambilIndex = vars.indexOf('ambil');
      expect(origIndex).toBe(0); // Original form first
      expect(ambilIndex).toBeGreaterThan(origIndex);
    });

    it('diambil should include ambil and mengambil (in correct order)', () => {
      const vars = variations('diambil');
      const mengambilIndex = vars.indexOf('mengambil');
      const ambilIndex = vars.indexOf('ambil');
      expect(mengambilIndex).toBeGreaterThan(-1);
      expect(ambilIndex).toBeGreaterThan(-1);
      // mengambil (active) should come before ambil (bare root) for API efficiency
      expect(mengambilIndex).toBeLessThan(ambilIndex);
    });

    it('makanan should include makan (original first)', () => {
      const vars = variations('makanan');
      const origIndex = vars.indexOf('makanan');
      const makanIndex = vars.indexOf('makan');
      expect(origIndex).toBe(0);
      expect(makanIndex).toBeGreaterThan(origIndex);
    });

    it('berbicara should include bicara (original first)', () => {
      const vars = variations('berbicara');
      const origIndex = vars.indexOf('berbicara');
      const bicaraIndex = vars.indexOf('bicara');
      expect(origIndex).toBe(0);
      expect(bicaraIndex).toBeGreaterThan(origIndex);
    });

    it('kebaikan should include baik (original first)', () => {
      const vars = variations('kebaikan');
      const origIndex = vars.indexOf('kebaikan');
      const balikIndex = vars.indexOf('baik');
      expect(origIndex).toBe(0);
      expect(balikIndex).toBeGreaterThan(origIndex);
    });

    it('perjalanan should include jalan (original first)', () => {
      const vars = variations('perjalanan');
      const origIndex = vars.indexOf('perjalanan');
      const jalanIndex = vars.indexOf('jalan');
      expect(origIndex).toBe(0);
      expect(jalanIndex).toBeGreaterThan(origIndex);
    });

    it('penulis should include tulis (original first)', () => {
      const vars = variations('penulis');
      const origIndex = vars.indexOf('penulis');
      const tulisIndex = vars.indexOf('tulis');
      expect(origIndex).toBe(0);
      expect(tulisIndex).toBeGreaterThan(origIndex);
    });
  });
});
