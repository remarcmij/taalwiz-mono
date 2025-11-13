import {
  ABBREVIATIONS_NL,
  IGNORED_WORDS_ID,
  IGNORED_WORDS_NL,
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
    this._homonym = 0;
  }

  parseLine(line: string): ParserResult {
    if (line.match(/^\d/)) {
      if (this.tildeWord) {
        line = `**${this.tildeWord}**, ${line}`;
      } else {
        throw new Error('Tilde word not set');
      }
    }

    return super.parseLine(line);
  }

  extractWords(line: string, result: ParserResult): void {
    const tokenizer = new Tokenizer(line);
    let targetWords: string[] = [];

    let arrowSeen = false;
    let token = tokenizer.next();

    while (token != Token.Done) {
      switch (token) {
        case Token.DblStar: {
          if (arrowSeen) {
            this.parseDblStarFragment(tokenizer, result.sourceWords);
          } else {
            this.tildeWord = null;
            this.parseDblStarFragment(tokenizer, result.sourceKeywords);
          }
          break;
        }

        case Token.Star: {
          this.parseStarFragment(tokenizer, result.sourceWords);
          break;
        }

        case Token.Word: {
          targetWords.push(tokenizer.value);
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
          if (targetWords.length > 0) {
            this.assignTargetWords(targetWords, result.targetKeywords);
            targetWords = [];
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

    if (targetWords.length > 0) {
      this.assignTargetWords(targetWords, result.targetKeywords);
    }
  }

  parseDblStarFragment(tokenizer: Tokenizer, wordSet: Set<string>) {
    let token = tokenizer.next();
    let wordSeen = false;

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
          wordSeen = true;
          token = tokenizer.next();
          break;
        }

        case Token.DblStar:
          if (!wordSeen) {
            throw new Error('expected word');
          }
          return;

        case Token.Done:
          throw new Error('unterminated "**" fragment');

        case Token.Tilde:
          throw new Error('"~" not allowed in "**" fragment');

        default:
          // Ignore other tokens
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

  assignTargetWords(targetWords: string[], wordSet: Set<string>) {
    let filtered = targetWords.filter((word) => !ABBREVIATIONS_NL.has(word));

    if (filtered.length == 1) {
      wordSet.add(filtered[0]);
    } else {
      filtered = filtered.filter((word) => !IGNORED_WORDS_NL.has(word));
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
