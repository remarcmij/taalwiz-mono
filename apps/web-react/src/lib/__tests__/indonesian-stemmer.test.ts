import { IndonesianStemmer } from '../indonesian-stemmer.ts';

describe('IndonesianStemmer', () => {
  let stemmer: IndonesianStemmer;

  beforeEach(() => {
    stemmer = new IndonesianStemmer();
  });

  // --- Base cases ---

  it('returns the word itself in variations', () => {
    const variations = stemmer.getWordVariations('rumah');
    expect(variations).toContain('rumah');
  });

  it('returns only the word for exempted words', () => {
    const variations = stemmer.getWordVariations('aku');
    expect(variations).toEqual(['aku']);
  });

  it('returns only the word for another exempted word', () => {
    const variations = stemmer.getWordVariations('dia');
    expect(variations).toEqual(['dia']);
  });

  // --- Suffixes ---

  it('strips -nya suffix', () => {
    const variations = stemmer.getWordVariations('rumahnya');
    expect(variations).toContain('rumah');
  });

  it('strips -ku suffix', () => {
    const variations = stemmer.getWordVariations('rumahku');
    expect(variations).toContain('rumah');
  });

  it('strips -mu suffix', () => {
    const variations = stemmer.getWordVariations('rumahmu');
    expect(variations).toContain('rumah');
  });

  // --- Prefixes ---

  it('strips di- prefix and generates me- variant', () => {
    const variations = stemmer.getWordVariations('dimakan');
    expect(variations).toContain('memakan');
    // The stemmer replaces di- with me- prefix rather than stripping to root
    expect(variations).toContain('dimakan');
  });

  it('strips ter- prefix', () => {
    const variations = stemmer.getWordVariations('terbang');
    expect(variations).toContain('bang');
  });

  it('strips se- prefix', () => {
    const variations = stemmer.getWordVariations('semua');
    expect(variations).toContain('mua');
  });

  // --- meng- prefix via di- ---

  it('generates meng- prefix for vowel-initial words via di-', () => {
    const variations = stemmer.getWordVariations('diambil');
    expect(variations).toContain('mengambil');
  });

  it('generates meny- prefix for s-initial words via di-', () => {
    const variations = stemmer.getWordVariations('disapu');
    expect(variations).toContain('menyapu');
  });

  // --- Reduplication ---

  it('strips reduplication', () => {
    const variations = stemmer.getWordVariations('anak-anak');
    expect(variations).toContain('anak');
  });

  it('strips reduplication for longer words', () => {
    const variations = stemmer.getWordVariations('rumah-rumah');
    expect(variations).toContain('rumah');
  });
});
