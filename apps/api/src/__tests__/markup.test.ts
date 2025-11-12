import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { markupFragments } from '../util/markup.js';

describe('util/markup', () => {
  describe('markupFragments', () => {
    it('should place Indonesian words in a <span>', () => {
      // This is a requirement of the client front-end.
      const expected = String.raw`**<span>mengabdi</span>** (*<span>ke</span>, <span>pada</span>, <span>kepada</span>*), dienen bij, in dienst zijn van, toegewijd`;
      const actual = markupFragments(
        '**mengabdi** (*ke, pada, kepada*), dienen bij, in dienst zijn van, toegewijd'
      );
      assert.equal(actual, expected);
    });

    it('should handle edge cases correctly', () => {
      const expected = String.raw`__aaien__ *<span>mengelus</span> [<span>elus</span>]*`;
      const actual = markupFragments('__aaien__ *mengelus [elus]*');
      assert.equal(actual, expected);
    });
  });
});
