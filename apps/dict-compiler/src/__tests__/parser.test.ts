import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import TeeuwParser from '../compiler/TeeuwParser.js';

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
});
