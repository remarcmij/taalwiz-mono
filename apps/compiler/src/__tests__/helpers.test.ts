import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { removeParenthesizedFragments } from '../compiler/helpers.js';

describe('removeParenthesizedFragments', () => {
  it('it should remove parenthesized fragments', () => {
    const expected = '**trusa** †, →  **usah**, het hoeft niet.';
    const actual = removeParenthesizedFragments(
      '**trusa(h)** †, → (*tak*) **usah**, het hoeft niet.'
    );
    assert.equal(actual, expected);
  });
});
