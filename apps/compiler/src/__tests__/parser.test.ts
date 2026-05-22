import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import TeeuwParser from '../compiler/TeeuwParser.js';
import VanDaleParser from '../compiler/VanDaleParser.js';

describe('TeeuwParser', () => {
  it('**ab** I, sv busje, potje (voor het opbergen van opium).', () => {
    const parser = new TeeuwParser();
    const result = parser.parseLine(
      '**ab** I, sv busje, potje (voor het opbergen van opium).'
    );
    assert.equal(
      result.line,
      '**ab** I, sv busje, potje (voor het opbergen van opium).'
    );
    assert.deepStrictEqual(result.sourceKeywords, new Set(['ab']));
    assert.equal(result.sourceWords.size, 0);
    assert.deepStrictEqual(result.targetKeywords, new Set(['busje', 'potje']));
  });

  it('*~ emas*(, *keemasan*), gouden eeuw, bloeitijd, hoogtepunt;', () => {
    const parser = new TeeuwParser();
    parser.tildeWord = 'abad';

    const result = parser.parseLine(
      '*~ emas*(, *keemasan*), gouden eeuw, bloeitijd, hoogtepunt;'
    );
    assert.equal(
      result.line,
      '*abad emas*(, *keemasan*), gouden eeuw, bloeitijd, hoogtepunt;'
    );
    assert.equal(result.sourceKeywords.size, 0);
    assert.deepStrictEqual(
      result.sourceWords,
      new Set(['abad', 'emas', 'keemasan'])
    );
    assert.deepStrictEqual(
      result.targetKeywords,
      new Set(['bloeitijd', 'hoogtepunt'])
    );
  });

  it('**mengabolisi(kan)**, afschaffen, kwijtschelden', () => {
    const parser = new TeeuwParser();

    const result = parser.parseLine(
      '**mengabolisi(kan)**, afschaffen, kwijtschelden'
    );
    assert.equal(
      result.line,
      '**mengabolisi(kan)**, afschaffen, kwijtschelden'
    );
    assert.deepStrictEqual(
      result.sourceKeywords,
      new Set(['mengabolisi', 'mengabolisikan'])
    );
    assert.equal(result.sourceWords.size, 0);
    assert.deepStrictEqual(
      result.targetKeywords,
      new Set(['afschaffen', 'kwijtschelden'])
    );
  });

  it('**acara** IV † → **cara**, manier.', () => {
    const parser = new TeeuwParser();

    const result = parser.parseLine('**acara** IV † → **cara**, manier.');
    assert.equal(result.line, '**acara** IV † → **cara**, manier.');
    assert.deepStrictEqual(result.sourceKeywords, new Set(['acara']));
    assert.deepStrictEqual(result.sourceWords, new Set(['cara']));
    assert.deepStrictEqual(result.targetKeywords, new Set(['manier']));
  });

  it('2 tijd, periode;', () => {
    const parser = new TeeuwParser();
    parser.tildeWord = 'abad';

    const result = parser.parseLine('2 tijd, periode;');
    assert.equal(result.line, '**abad**, 2 tijd, periode;');
    assert.deepStrictEqual(result.sourceKeywords, new Set(['abad']));
    assert.equal(result.sourceWords.size, 0);
    assert.deepStrictEqual(result.targetKeywords, new Set(['tijd', 'periode']));
  });

  describe('reset and homonym tracking', () => {
    it('homonym is 0 for the first occurrence of a base word', () => {
      const parser = new TeeuwParser();
      parser.parseLine('**abad** I, eeuw, tijdperk');
      assert.equal(parser.base, 'abad');
      assert.equal(parser.homonym, 0);
    });

    it('homonym increments to 1 when the same base reappears after reset', () => {
      const parser = new TeeuwParser();
      parser.parseLine('**abad** I, eeuw, tijdperk');
      parser.reset();
      parser.parseLine('**abad** II, generatie');
      assert.equal(parser.base, 'abad');
      assert.equal(parser.homonym, 1);
    });

    it('homonym stays 0 when a different base follows after reset', () => {
      const parser = new TeeuwParser();
      parser.parseLine('**abad** I, eeuw');
      parser.reset();
      parser.parseLine('**adat**, gewoonte');
      assert.equal(parser.base, 'adat');
      assert.equal(parser.homonym, 0);
    });

    it('reset clears base and tildeWord', () => {
      const parser = new TeeuwParser();
      parser.parseLine('**abad** I, eeuw');
      parser.reset();
      assert.equal(parser.base, null);
      assert.equal(parser.tildeWord, null);
    });
  });

  describe('error paths', () => {
    it('throws when a digit-line is parsed without a tilde word', () => {
      const parser = new TeeuwParser();
      assert.throws(
        () => parser.parseLine('2 tijd, periode;'),
        /Tilde word not set/
      );
    });

    it('throws when ~ is used in a * fragment but tildeWord is not set', () => {
      const parser = new TeeuwParser();
      assert.throws(
        () => parser.parseLine('*~woord*'),
        /tilde word not set/
      );
    });

    it('throws on an unterminated ** fragment', () => {
      const parser = new TeeuwParser();
      assert.throws(
        () => parser.parseLine('**abc'),
        /unterminated "\*\*" fragment/
      );
    });

    it('throws on an unterminated * fragment', () => {
      const parser = new TeeuwParser();
      assert.throws(
        () => parser.parseLine('**base**, *adj'),
        /unterminated "\*" fragment/
      );
    });

    it('throws on an empty ** fragment', () => {
      const parser = new TeeuwParser();
      assert.throws(
        () => parser.parseLine('****'),
        /expected word/
      );
    });

    it('throws when ~ appears inside a ** fragment', () => {
      const parser = new TeeuwParser();
      assert.throws(
        () => parser.parseLine('**~woord**'),
        /"~" not allowed in "\*\*" fragment/
      );
    });
  });
});

describe('VanDaleParser', () => {
  it('parses a line with an explicit __ heading', () => {
    const parser = new VanDaleParser();
    const result = parser.parseLine('__aap__, een dier');
    assert.equal(result.line, '__aap__, een dier');
    assert.deepStrictEqual(result.sourceKeywords, new Set(['aap']));
    assert.equal(result.sourceWords.size, 0);
    assert.equal(result.targetKeywords.size, 0);
  });

  it('sets base to the first word in the __ fragment', () => {
    const parser = new VanDaleParser();
    parser.parseLine('__boom__, een plant');
    assert.equal(parser.base, 'boom');
  });

  it('prepends the tilde word as a __ heading when the line has no __', () => {
    const parser = new VanDaleParser();
    parser.parseLine('__boom__, een plant');
    const result = parser.parseLine('een groot gewas');
    assert.equal(result.line, '__boom__, een groot gewas');
    assert.deepStrictEqual(result.sourceKeywords, new Set(['boom']));
  });

  it('reset clears base and tildeWord', () => {
    const parser = new VanDaleParser();
    parser.parseLine('__aap__, een dier');
    parser.reset();
    assert.equal(parser.base, null);
    assert.equal(parser.tildeWord, null);
  });

  describe('error paths', () => {
    it('throws when line has no __ and tildeWord is not set', () => {
      const parser = new VanDaleParser();
      assert.throws(
        () => parser.parseLine('een dier'),
        /Tilde word not set/
      );
    });

    it('throws on an unterminated __ fragment', () => {
      const parser = new VanDaleParser();
      assert.throws(
        () => parser.parseLine('__abc'),
        /unterminated "__" fragment/
      );
    });

    it('throws on an empty __ fragment', () => {
      const parser = new VanDaleParser();
      assert.throws(
        () => parser.parseLine('____'),
        /expected word/
      );
    });
  });
});
