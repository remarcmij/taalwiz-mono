import StevensParser from '../compiler/StevensParser.js';

describe('StevensParser', () => {
  it('indexes a headword and its single-word English glosses', () => {
    const parser = new StevensParser();
    const result = parser.parseLine(
      '**abadi** (_A_) eternal, everlasting, perpetual, permanent, abiding, without end, unbreakable.'
    );
    expect(result.line).toBe(
      '**abadi** (_A_) eternal, everlasting, perpetual, permanent, abiding, without end, unbreakable.'
    );
    expect(result.sourceKeywords).toStrictEqual(new Set(['abadi']));
    expect(result.referenceWords.size).toBe(0);
    // "without end" (two content words) is dropped; the lone synonyms are kept.
    expect(result.targetWords).toStrictEqual(
      new Set([
        'eternal',
        'everlasting',
        'perpetual',
        'permanent',
        'abiding',
        'unbreakable',
      ])
    );
  });

  it('resolves the `^` headword placeholder to the base', () => {
    const parser = new StevensParser();
    parser.parseLine('**aala** and **a\'ala** dynasty; → **RAJAKULA**.');
    const result = parser.parseLine('*^ Tang* Tang dynasty.');
    expect(result.line).toBe('*aala Tang* Tang dynasty.');
    expect(result.sourceKeywords.size).toBe(0);
    expect(result.referenceWords).toStrictEqual(new Set(['aala', 'Tang']));
  });

  it('resolves the `~` nearest-keyword placeholder', () => {
    const parser = new StevensParser();
    parser.parseLine('**aba-aba** (_mil_) command, signal, word of command.');
    const result = parser.parseLine(
      '*memberikan ~ kepada* to command, give a command to.'
    );
    expect(result.line).toBe(
      '*memberikan aba-aba kepada* to command, give a command to.'
    );
    expect(result.referenceWords).toStrictEqual(
      new Set(['memberikan', 'aba-aba', 'kepada'])
    );
    expect(result.targetWords).toStrictEqual(new Set(['command']));
  });

  it('binds an `__N__`-led line to the nearest keyword', () => {
    const parser = new StevensParser();
    parser.parseLine('**abad** (_A_) __1__ century.');
    const result = parser.parseLine('__2__ era, age.');
    expect(result.line).toBe('**abad**, __2__ era, age.');
    expect(result.sourceKeywords).toStrictEqual(new Set(['abad']));
    expect(result.targetWords).toStrictEqual(new Set(['era', 'age']));
  });

  it('unwraps a `_**word**_` derived keyword so it is indexed', () => {
    const parser = new StevensParser();
    parser.parseLine('**abadi** (_A_) eternal.');
    const result = parser.parseLine(
      '_**ketidak-abadian**_ temporariness, ephemerality.'
    );
    expect(result.line).toBe(
      '**ketidak-abadian** temporariness, ephemerality.'
    );
    expect(result.sourceKeywords).toStrictEqual(
      new Set(['ketidak-abadian'])
    );
    expect(result.targetWords).toStrictEqual(
      new Set(['temporariness', 'ephemerality'])
    );
  });

  it('treats both `**X** and **Y**` headwords as keywords under one base', () => {
    const parser = new StevensParser();
    const result = parser.parseLine(
      '**a** and **A** __I__ /a/ the first letter of the Latin alphabet used for writing Indonesian.'
    );
    expect(parser.base).toBe('a');
    expect(parser.homonym).toBe(0);
    expect(result.sourceKeywords).toStrictEqual(new Set(['a', 'A']));
    // The bridging "and" is not indexed as an English word.
    expect(result.targetWords.has('and')).toBe(false);
  });

  it('routes a post-arrow bold word to references, not keywords', () => {
    const parser = new StevensParser();
    const result = parser.parseLine('**aala** dynasty; → **RAJAKULA**.');
    expect(result.sourceKeywords).toStrictEqual(new Set(['aala']));
    expect(result.referenceWords).toStrictEqual(new Set(['RAJAKULA']));
    expect(result.targetWords).toStrictEqual(new Set(['dynasty']));
  });

  it('routes a bold word after `_opp_` / `_cp_` to references, not keywords', () => {
    // `_opp_` (opposite) and `_cp_` (compare) introduce a cross-reference just
    // like `→`, so the following bold word is a reference, not a source keyword.
    const oppParser = new StevensParser();
    const opp = oppParser.parseLine('**abad**, eternity; _opp_ **AJAL**.');
    expect(opp.sourceKeywords).toStrictEqual(new Set(['abad']));
    expect(opp.referenceWords).toStrictEqual(new Set(['AJAL']));

    const cpParser = new StevensParser();
    const cp = cpParser.parseLine('**Aga** an honorific title; _cp_ **BAPAK**.');
    expect(cp.sourceKeywords).toStrictEqual(new Set(['Aga']));
    expect(cp.referenceWords).toStrictEqual(new Set(['BAPAK']));
  });

  it('still skips a non-reference italic span (e.g. `_naut_`)', () => {
    // A normal italic marker must NOT latch the reference flag; a later bold
    // headword stays a source keyword.
    const parser = new StevensParser();
    const result = parser.parseLine('**abah** __II__ (_naut_) bottom of a ship.');
    expect(result.sourceKeywords).toStrictEqual(new Set(['abah']));
    expect(result.referenceWords.size).toBe(0);
  });

  it('tags glosses as English (targetLang "en")', () => {
    const parser = new StevensParser();
    expect(parser.sourceLang).toBe('id');
    expect(parser.targetLang).toBe('en');
  });

  describe('homonym tracking', () => {
    it('increments when the same base reappears after reset', () => {
      const parser = new StevensParser();
      parser.parseLine('**ab** __I__ (_A ob_) father.');
      parser.reset();
      parser.parseLine('**ab** __II__ (_ob_) a tin opium box/cylinder.');
      expect(parser.base).toBe('ab');
      expect(parser.homonym).toBe(1);
    });

    it('stays 0 when a different base follows after reset', () => {
      const parser = new StevensParser();
      parser.parseLine('**ab** __I__ father.');
      parser.reset();
      parser.parseLine('**aba** father.');
      expect(parser.base).toBe('aba');
      expect(parser.homonym).toBe(0);
    });
  });

  describe('error paths', () => {
    it('throws on a `^` placeholder before any headword', () => {
      const parser = new StevensParser();
      expect(() => parser.parseLine('*^ Tang* dynasty.')).toThrow(
        /"\^" headword placeholder before any headword/
      );
    });

    it('throws on an `__N__`-led line with no nearest keyword', () => {
      const parser = new StevensParser();
      expect(() => parser.parseLine('__2__ era, age.')).toThrow(
        /Tilde word not set/
      );
    });
  });
});
