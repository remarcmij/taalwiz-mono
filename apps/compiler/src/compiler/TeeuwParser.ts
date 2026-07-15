import {
  EDITORIAL_MARKERS_NL,
  IGNORED_WORDS_ID,
  COMMON_WORDS_NL,
} from './filter_data.js';
import ParserBase, { ParserResult } from './ParserBase.js';
import Tokenizer, { Token } from './Tokenizer.js';

export default class TeeuwParser extends ParserBase {
  constructor() {
    super('id', 'nl');
  }

  reset() {
    this._prevBase = this._base;
    this._base = null;
    this._tildeWord = null;
    // Do NOT zero `_homonym` here. `setBase()` fully governs it on the next
    // block's headword: 0 for a fresh base, +1 for a repeat. Zeroing it first
    // capped a repeated headword at homonym 1, so a word with three or more
    // homonyms (abu I/II/III/IV/V) collapsed III+ onto II's number.
  }

  parseLine(line: string): ParserResult {
    if (line.match(/^\d/)) {
      if (this.tildeWord) {
        line = `**${this.tildeWord}**, ${line}`;
      } else {
        throw new Error('Tilde word not set');
      }
    }

    const result = super.parseLine(line);

    // `^` stands for the headword; resolve it to the base for the rendered line
    // (its indexing is handled during extraction and by ParserBase adding the
    // base to every line's reference words). Same rule as Stevens: printed
    // Teeuw has no headword marker of its own — it reverts by starting a line
    // without a bold word — so `^` re-encodes that position for the flattened
    // source.
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
          this.skipUntilSentinelToken(
            tokenizer,
            Token.RightBracket,
            'missing "]"'
          );
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
        case Token.Equals:
          // Both `→` and `=` introduce a cross-reference: a following
          // `**word**` is a reference to another keyword, not a source
          // keyword of this entry.
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
    let wordSeen = false;
    // Consecutive Word tokens were separated by whitespace only (the tokenizer
    // skips whitespace but emits a token for every punctuation mark), so they
    // are one multi-word unit: print marks it by running the bold across both
    // words. Any other token ends the run — notably a comma, which is how the
    // source lists variants (`**ahlil, ahlul**` is two words, not one).
    let parts: string[] = [];

    const flush = () => {
      if (parts.length === 0) return;
      const word = parts.join(' ');
      parts = [];
      if (!this._base) {
        this.setBase(word);
      }
      if (!this.tildeWord) {
        this.tildeWord = word;
      }
      wordSet.add(word);
      // A multi-word unit is indexed as the unit it is ("rumah sakit"), which is
      // what makes it a lemma and an autocomplete row. Index its parts too, or
      // it is unreachable from a word tap: article markup wraps each word in its
      // own span, so a tap can never send the phrase.
      if (word.includes(' ')) {
        for (const part of word.split(' ')) {
          if (part) wordSet.add(part);
        }
      }
    };

    for (;;) {
      switch (token) {
        case Token.Word: {
          parts.push(tokenizer.value);
          wordSeen = true;
          token = tokenizer.next();
          break;
        }

        case Token.DblStar:
          flush();
          if (!wordSeen) {
            throw new Error('expected word');
          }
          return;

        case Token.Done:
          throw new Error('unterminated "**" fragment');

        case Token.Tilde:
          throw new Error('"~" not allowed in "**" fragment');

        default:
          flush();
          token = tokenizer.next();
      }
    }
  }

  parseStarFragment(tokenizer: Tokenizer, wordSet: Set<string>) {
    let token = tokenizer.next();
    let wordSeen = false;

    for (;;) {
      switch (token) {
        case Token.Word: {
          if (!IGNORED_WORDS_ID.has(tokenizer.value)) {
            wordSet.add(tokenizer.value);
          }
          wordSeen = true;
          token = tokenizer.next();
          break;
        }

        case Token.Caret: {
          // Headword placeholder inside an italic span: resolve to the base.
          if (this._base) {
            wordSet.add(this._base);
          } else {
            throw new Error('"^" headword placeholder before any headword');
          }
          wordSeen = true;
          token = tokenizer.next();
          break;
        }

        case Token.Tilde: {
          if (this.tildeWord) {
            wordSet.add(this.tildeWord);
          } else {
            throw new Error('tilde word not set');
          }
          wordSeen = true;
          token = tokenizer.next();
          break;
        }
        case Token.Star: {
          if (!wordSeen) {
            throw new Error('expected word');
          }
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

  selectTargetWord(fragmentWords: string[], wordSet: Set<string>) {
    let filtered = fragmentWords.filter((word) => !EDITORIAL_MARKERS_NL.has(word));

    if (filtered.length == 1) {
      wordSet.add(filtered[0]);
    } else {
      filtered = filtered.filter((word) => !COMMON_WORDS_NL.has(word));
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
