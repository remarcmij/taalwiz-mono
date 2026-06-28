import TeeuwParser from '../compiler/TeeuwParser.js';

describe('TeeuwParser', () => {
  it('**ab** I, sv busje, potje (voor het opbergen van opium).', () => {
    const parser = new TeeuwParser();
    const result = parser.parseLine(
      '**ab** I, sv busje, potje (voor het opbergen van opium).'
    );
    expect(result.line).toBe(
      '**ab** I, sv busje, potje (voor het opbergen van opium).'
    );
    expect(result.sourceKeywords).toStrictEqual(new Set(['ab']));
    expect(result.referenceWords.size).toBe(0);
    expect(result.targetWords).toStrictEqual(new Set(['busje', 'potje']));
  });

  it('*~ emas*(, *keemasan*), gouden eeuw, bloeitijd, hoogtepunt;', () => {
    const parser = new TeeuwParser();
    parser.tildeWord = 'abad';

    const result = parser.parseLine(
      '*~ emas*(, *keemasan*), gouden eeuw, bloeitijd, hoogtepunt;'
    );
    expect(result.line).toBe(
      '*abad emas*(, *keemasan*), gouden eeuw, bloeitijd, hoogtepunt;'
    );
    expect(result.sourceKeywords.size).toBe(0);
    expect(result.referenceWords).toStrictEqual(
      new Set(['abad', 'emas', 'keemasan'])
    );
    expect(result.targetWords).toStrictEqual(
      new Set(['bloeitijd', 'hoogtepunt'])
    );
  });

  it('**mengabolisi(kan)**, afschaffen, kwijtschelden', () => {
    const parser = new TeeuwParser();

    const result = parser.parseLine(
      '**mengabolisi(kan)**, afschaffen, kwijtschelden'
    );
    expect(result.line).toBe(
      '**mengabolisi(kan)**, afschaffen, kwijtschelden'
    );
    expect(result.sourceKeywords).toStrictEqual(
      new Set(['mengabolisi', 'mengabolisikan'])
    );
    expect(result.referenceWords.size).toBe(0);
    expect(result.targetWords).toStrictEqual(
      new Set(['afschaffen', 'kwijtschelden'])
    );
  });

  it('**agah, beragah(-agah)an**, elkaar uitdagen(d aankijken);', () => {
    // Parentheses mark an optional word-part that is NOT a trailing suffix:
    // a medial reduplication on the Indonesian side (beragah(-agah)an ->
    // beragahan / beragah-agahan) and an optional continuation on the Dutch
    // side (uitdagen(d aankijken) -> uitdagen). The double pass indexes both.
    const parser = new TeeuwParser();

    const result = parser.parseLine(
      '**agah, beragah(-agah)an**, elkaar uitdagen(d aankijken);'
    );
    expect(result.sourceKeywords).toStrictEqual(
      new Set(['agah', 'beragahan', 'beragah-agahan'])
    );
    expect(result.referenceWords.size).toBe(0);
    expect(result.targetWords).toStrictEqual(new Set(['uitdagen']));
  });

  it('**acara** IV † → **cara**, manier.', () => {
    const parser = new TeeuwParser();

    const result = parser.parseLine('**acara** IV † → **cara**, manier.');
    expect(result.line).toBe('**acara** IV † → **cara**, manier.');
    expect(result.sourceKeywords).toStrictEqual(new Set(['acara']));
    expect(result.referenceWords).toStrictEqual(new Set(['cara']));
    expect(result.targetWords).toStrictEqual(new Set(['manier']));
  });

  it('2 tijd, periode;', () => {
    const parser = new TeeuwParser();
    parser.tildeWord = 'abad';

    const result = parser.parseLine('2 tijd, periode;');
    expect(result.line).toBe('**abad**, 2 tijd, periode;');
    expect(result.sourceKeywords).toStrictEqual(new Set(['abad']));
    expect(result.referenceWords.size).toBe(0);
    expect(result.targetWords).toStrictEqual(new Set(['tijd', 'periode']));
  });

  describe('reset and homonym tracking', () => {
    it('homonym is 0 for the first occurrence of a base word', () => {
      const parser = new TeeuwParser();
      parser.parseLine('**abad** I, eeuw, tijdperk');
      expect(parser.base).toBe('abad');
      expect(parser.homonym).toBe(0);
    });

    it('homonym increments to 1 when the same base reappears after reset', () => {
      const parser = new TeeuwParser();
      parser.parseLine('**abad** I, eeuw, tijdperk');
      parser.reset();
      parser.parseLine('**abad** II, generatie');
      expect(parser.base).toBe('abad');
      expect(parser.homonym).toBe(1);
    });

    it('homonym keeps incrementing past 1 for a third and fourth occurrence', () => {
      const parser = new TeeuwParser();
      parser.parseLine('**abu** I, as');
      parser.reset();
      parser.parseLine('**abu** II, kleur');
      expect(parser.homonym).toBe(1);
      parser.reset();
      parser.parseLine('**abu** III, verliezen');
      expect(parser.homonym).toBe(2);
      parser.reset();
      parser.parseLine('**abu** IV, sv vis');
      expect(parser.homonym).toBe(3);
    });

    it('homonym stays 0 when a different base follows after reset', () => {
      const parser = new TeeuwParser();
      parser.parseLine('**abad** I, eeuw');
      parser.reset();
      parser.parseLine('**adat**, gewoonte');
      expect(parser.base).toBe('adat');
      expect(parser.homonym).toBe(0);
    });

    it('reset clears base and tildeWord', () => {
      const parser = new TeeuwParser();
      parser.parseLine('**abad** I, eeuw');
      parser.reset();
      expect(parser.base).toBeNull();
      expect(parser.tildeWord).toBeNull();
    });
  });

  describe('error paths', () => {
    it('throws when a digit-line is parsed without a tilde word', () => {
      const parser = new TeeuwParser();
      expect(() => parser.parseLine('2 tijd, periode;')).toThrow(
        /Tilde word not set/
      );
    });

    it('throws when ~ is used in a * fragment but tildeWord is not set', () => {
      const parser = new TeeuwParser();
      expect(() => parser.parseLine('*~woord*')).toThrow(
        /tilde word not set/
      );
    });

    it('throws on an unterminated ** fragment', () => {
      const parser = new TeeuwParser();
      expect(() => parser.parseLine('**abc')).toThrow(
        /unterminated "\*\*" fragment/
      );
    });

    it('throws on an unterminated * fragment', () => {
      const parser = new TeeuwParser();
      expect(() => parser.parseLine('**base**, *adj')).toThrow(
        /unterminated "\*" fragment/
      );
    });

    it('throws on an empty ** fragment', () => {
      const parser = new TeeuwParser();
      expect(() => parser.parseLine('****')).toThrow(/expected word/);
    });

    it('throws when ~ appears inside a ** fragment', () => {
      const parser = new TeeuwParser();
      expect(() => parser.parseLine('**~woord**')).toThrow(
        /"~" not allowed in "\*\*" fragment/
      );
    });
  });
});
