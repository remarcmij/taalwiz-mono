import {
  EDITORIAL_MARKERS_EN,
  IGNORED_WORDS_ID,
  COMMON_WORDS_EN,
  IGNORED_WORDS_EN,
} from './filter_data.js';
import ParserBase, { ParserResult } from './ParserBase.js';
import Tokenizer, { Token } from './Tokenizer.js';

// Parser for the Stevens Indonesian->English dictionary. It shares Teeuw's
// block/base/keyword/homonym model and parenthesis double-pass (inherited from
// ParserBase), with the format-specific differences spelled out in
// `../../STEVENS_PARSER.md`:
//
//   - glosses are English (`super('id', 'en')`);
//   - `^` is the headword placeholder (resolves to the block's base);
//   - `~` is the nearest-previous-keyword placeholder (Teeuw's `tildeWord`);
//   - sense numbers are `__N__`, and an `__N__`-led line continues the nearest
//     keyword (the `__` analog of Teeuw's bare-digit lines);
//   - a derived keyword may be wrapped as `_**word**_`, which is unwrapped so the
//     bold keyword is indexed rather than skipped as an italic span.
export default class StevensParser extends ParserBase {
  constructor() {
    super('id', 'en');
  }

  reset() {
    this._prevBase = this._base;
    this._base = null;
    this._tildeWord = null;
    // Do NOT zero `_homonym` here. `setBase()` fully governs it on the next
    // block's headword: 0 for a fresh base, +1 for a repeat. Zeroing it first
    // capped a repeated headword at homonym 1, so a word with three or more
    // homonyms (ékor I/II/III/IV) collapsed III+ onto II's number.
  }

  parseLine(line: string): ParserResult {
    // Unwrap a derived keyword an editor wrapped in italics (`_**bercacah**_`):
    // strip the outer underscores so the bold span is tokenized and indexed,
    // instead of being swallowed whole by the `_..._` skip.
    line = line.replace(/_(\*\*[^*]+\*\*)_/g, '$1');

    // Normalize a whole-span-optional reference from Stevens' `*(word)*` (parens
    // INSIDE the emphasis) to Teeuw's `(*word*)` (parens OUTSIDE). Both render the
    // same, but the inside form collapses to a dangling `**`/`*` in the second
    // parenthesis pass (the parens leave the two delimiters adjacent), corrupting
    // the rest of the line; the outside form is dropped cleanly as one unit.
    line = line
      .replace(/\*\*\(([^)]+)\)\*\*/g, '(**$1**)')
      .replace(/\*\(([^)]+)\)\*/g, '(*$1*)');

    // An `__N__`-led line is a new sense of the nearest keyword; re-assert that
    // keyword so the sense is attributed to it, mirroring Teeuw's handling of a
    // line that opens with a bare sense digit.
    if (/^__\d/.test(line)) {
      if (this.tildeWord) {
        line = `**${this.tildeWord}**, ${line}`;
      } else {
        throw new Error('Tilde word not set');
      }
    }

    const result = super.parseLine(line);

    // `^` stands for the headword; resolve it to the base for the rendered line
    // (its indexing as a reference word is already handled during extraction and
    // by ParserBase adding the base to every line's reference words).
    if (result.line.indexOf('^') !== -1) {
      if (!this._base) {
        throw new Error('"^" headword placeholder before any headword');
      }
      result.line = result.line.replace(/\^/g, this._base);
    }

    return result;
  }

  extractWords(line: string, result: ParserResult): void {
    const tokenizer = new Tokenizer(line);
    let pendingWords: string[] = [];

    let arrowSeen = false;
    let token = tokenizer.next();

    while (token != Token.Done) {
      switch (token) {
        case Token.DblStar: {
          if (arrowSeen) {
            this.parseDblStarFragment(tokenizer, result.referenceWords);
          } else {
            this.tildeWord = null;
            this.parseDblStarFragment(tokenizer, result.sourceKeywords);
          }
          break;
        }

        case Token.Star: {
          this.parseStarFragment(tokenizer, result.referenceWords);
          break;
        }

        case Token.Caret: {
          // A bare `^` outside a span: the base is already added to the line's
          // reference words by ParserBase, so nothing extra to index here.
          break;
        }

        case Token.Word: {
          pendingWords.push(tokenizer.value);
          break;
        }

        case Token.LeftBracket: {
          // `[...]` holds an editorial note (not indexed). Tolerate one that
          // runs off the end of the line: Stevens notes sometimes span several
          // lines, and a few use `[...)` typos. Skip to the close or EOL either
          // way rather than aborting the entry.
          this.skipBracket(tokenizer);
          break;
        }

        case Token.DblUnder: {
          this.skipUntilSentinelToken(
            tokenizer,
            Token.DblUnder,
            'unterminated "__" fragment'
          );
          break;
        }
        case Token.Underscore: {
          this.skipUntilSentinelToken(
            tokenizer,
            Token.Underscore,
            'unterminated "_" fragment'
          );
          break;
        }
        case Token.Comma:
        case Token.Semicolon: {
          if (pendingWords.length > 0) {
            this.selectTargetWord(pendingWords, result.targetWords);
            pendingWords = [];
          }
          break;
        }

        case Token.Arrow:
          arrowSeen = true;
          break;

        default: {
          // Skip and ignore other tokens
        }
      }

      token = tokenizer.next();
    }

    if (pendingWords.length > 0) {
      this.selectTargetWord(pendingWords, result.targetWords);
    }
  }

  parseDblStarFragment(tokenizer: Tokenizer, wordSet: Set<string>) {
    let token = tokenizer.next();

    for (;;) {
      switch (token) {
        case Token.Word: {
          const word = tokenizer.value.replace(/\+/g, ' ');
          if (!this._base) {
            this.setBase(word);
          }
          if (!this.tildeWord) {
            this.tildeWord = word;
          }
          wordSet.add(word);
          token = tokenizer.next();
          break;
        }

        case Token.DblStar:
          // An empty `**` span is tolerated: the second parenthesis pass turns a
          // whole-optional reference like `*(nasi)*` / `**(x)**` into bare `**`,
          // which carries no indexable word and should simply be skipped.
          return;

        case Token.Done:
          throw new Error('unterminated "**" fragment');

        case Token.Tilde:
          throw new Error('"~" not allowed in "**" fragment');

        case Token.Caret:
          throw new Error('"^" not allowed in "**" fragment');

        default:
          // Ignore other tokens
          token = tokenizer.next();
      }
    }
  }

  parseStarFragment(tokenizer: Tokenizer, wordSet: Set<string>) {
    let token = tokenizer.next();

    for (;;) {
      switch (token) {
        case Token.Word: {
          if (!IGNORED_WORDS_ID.has(tokenizer.value)) {
            wordSet.add(tokenizer.value);
          }
          token = tokenizer.next();
          break;
        }

        case Token.Caret: {
          // Headword placeholder inside an italic example: resolve to the base.
          if (this._base) {
            wordSet.add(this._base);
          } else {
            throw new Error('"^" headword placeholder before any headword');
          }
          token = tokenizer.next();
          break;
        }

        case Token.Tilde: {
          if (this.tildeWord) {
            wordSet.add(this.tildeWord);
          } else {
            throw new Error('tilde word not set');
          }
          token = tokenizer.next();
          break;
        }
        case Token.Star: {
          // An empty `*` span is tolerated for the same reason as `**` above, and
          // also covers word-less emphasis like `*5*`, `*?*`, or `*...*`.
          return;
        }
        case Token.Done: {
          throw new Error('unterminated "*" fragment');
        }

        default: {
          // ignore other tokens
          token = tokenizer.next();
        }
      }
    }
  }

  // Skip an editorial `[...]` note. Unlike skipUntilSentinelToken, tolerates a
  // bracket that is not closed on the line (multi-line notes and `[...)` typos):
  // stop at the closing `]` or end of line, indexing nothing either way.
  skipBracket(tokenizer: Tokenizer): void {
    let token = tokenizer.next();
    while (token !== Token.RightBracket && token !== Token.Done) {
      token = tokenizer.next();
    }
  }

  selectTargetWord(fragmentWords: string[], wordSet: Set<string>) {
    // Drop hard-ignored connectors (e.g. the `and` bridging two headwords) up
    // front so they cannot be indexed via the single-word rule below.
    const words = fragmentWords.filter((word) => !IGNORED_WORDS_EN.has(word));

    let filtered = words.filter((word) => !EDITORIAL_MARKERS_EN.has(word));

    if (filtered.length == 1) {
      wordSet.add(filtered[0]);
    } else {
      filtered = filtered.filter((word) => !COMMON_WORDS_EN.has(word));
      if (filtered.length === 1) {
        wordSet.add(filtered[0]);
      }
    }
  }

  skipUntilSentinelToken(
    tokenizer: Tokenizer,
    sentinel: Token,
    errMsg: string
  ): void {
    let token = tokenizer.next();

    while (token !== sentinel) {
      if (token === Token.Done) {
        throw new Error(errMsg);
      }
      token = tokenizer.next();
    }
  }
}
