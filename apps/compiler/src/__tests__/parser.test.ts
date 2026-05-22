import TeeuwParser from '../compiler/TeeuwParser.js';
import VanDaleParser from '../compiler/VanDaleParser.js';

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
    expect(result.sourceWords.size).toBe(0);
    expect(result.targetKeywords).toStrictEqual(new Set(['busje', 'potje']));
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
    expect(result.sourceWords).toStrictEqual(
      new Set(['abad', 'emas', 'keemasan'])
    );
    expect(result.targetKeywords).toStrictEqual(
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
    expect(result.sourceWords.size).toBe(0);
    expect(result.targetKeywords).toStrictEqual(
      new Set(['afschaffen', 'kwijtschelden'])
    );
  });

  it('**acara** IV † → **cara**, manier.', () => {
    const parser = new TeeuwParser();

    const result = parser.parseLine('**acara** IV † → **cara**, manier.');
    expect(result.line).toBe('**acara** IV † → **cara**, manier.');
    expect(result.sourceKeywords).toStrictEqual(new Set(['acara']));
    expect(result.sourceWords).toStrictEqual(new Set(['cara']));
    expect(result.targetKeywords).toStrictEqual(new Set(['manier']));
  });

  it('2 tijd, periode;', () => {
    const parser = new TeeuwParser();
    parser.tildeWord = 'abad';

    const result = parser.parseLine('2 tijd, periode;');
    expect(result.line).toBe('**abad**, 2 tijd, periode;');
    expect(result.sourceKeywords).toStrictEqual(new Set(['abad']));
    expect(result.sourceWords.size).toBe(0);
    expect(result.targetKeywords).toStrictEqual(new Set(['tijd', 'periode']));
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

describe('VanDaleParser', () => {
  it('parses a line with an explicit __ heading', () => {
    const parser = new VanDaleParser();
    const result = parser.parseLine('__aap__, een dier');
    expect(result.line).toBe('__aap__, een dier');
    expect(result.sourceKeywords).toStrictEqual(new Set(['aap']));
    expect(result.sourceWords.size).toBe(0);
    expect(result.targetKeywords.size).toBe(0);
  });

  it('sets base to the first word in the __ fragment', () => {
    const parser = new VanDaleParser();
    parser.parseLine('__boom__, een plant');
    expect(parser.base).toBe('boom');
  });

  it('prepends the tilde word as a __ heading when the line has no __', () => {
    const parser = new VanDaleParser();
    parser.parseLine('__boom__, een plant');
    const result = parser.parseLine('een groot gewas');
    expect(result.line).toBe('__boom__, een groot gewas');
    expect(result.sourceKeywords).toStrictEqual(new Set(['boom']));
  });

  it('reset clears base and tildeWord', () => {
    const parser = new VanDaleParser();
    parser.parseLine('__aap__, een dier');
    parser.reset();
    expect(parser.base).toBeNull();
    expect(parser.tildeWord).toBeNull();
  });

  describe('error paths', () => {
    it('throws when line has no __ and tildeWord is not set', () => {
      const parser = new VanDaleParser();
      expect(() => parser.parseLine('een dier')).toThrow(/Tilde word not set/);
    });

    it('throws on an unterminated __ fragment', () => {
      const parser = new VanDaleParser();
      expect(() => parser.parseLine('__abc')).toThrow(
        /unterminated "__" fragment/
      );
    });

    it('throws on an empty __ fragment', () => {
      const parser = new VanDaleParser();
      expect(() => parser.parseLine('____')).toThrow(/expected word/);
    });
  });
});
