import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import Tokenizer, { Token } from '../compiler/Tokenizer.js';

describe('Tokenizer', () => {
  it('**ab** I, sv busje, potje (voor het opbergen van opium).', () => {
    const lexer = new Tokenizer(
      '**ab** I, sv busje, potje (voor het opbergen van opium).'
    );
    const expected = [
      Token.DblStar,
      Token.Word,
      Token.DblStar,
      Token.Word,
      Token.Comma,
      Token.Word,
      Token.Word,
      Token.Comma,
      Token.Word,
      Token.Other,
      Token.Word,
      Token.Word,
      Token.Word,
      Token.Word,
      Token.Word,
      Token.Other,
      Token.Other,
      Token.Done,
    ];

    const actual = [];

    let token;

    do {
      token = lexer.next();
      actual.push(token);
    } while (token !== Token.Done);

    assert.deepStrictEqual(actual, expected);
  });

  it('should recognize all token types', () => {
    const text = 'abc ** * __ _ ~,;1[]$';
    const expectedTokens = [
      Token.Word,
      Token.DblStar,
      Token.Star,
      Token.DblUnder,
      Token.Underscore,
      Token.Tilde,
      Token.Comma,
      Token.Semicolon,
      Token.Numeric,
      Token.LeftBracket,
      Token.RightBracket,
      Token.Other,
      Token.Done,
    ];

    const expectedContent = [
      'abc',
      '**',
      '*',
      '__',
      '_',
      '~',
      ',',
      ';',
      '1',
      '[',
      ']',
      '$',
      '',
    ];

    const lexer = new Tokenizer(text);
    const actualTokens = [];
    const actualContent = [];

    let token;

    do {
      token = lexer.next();
      actualTokens.push(token);
      actualContent.push(lexer.value);
    } while (token !== Token.Done);

    assert.deepStrictEqual(actualTokens, expectedTokens);
    assert.deepStrictEqual(actualContent, expectedContent);
  });
});
