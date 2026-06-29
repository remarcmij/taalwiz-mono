import {
  EDITORIAL_MARKERS_NL,
  IGNORED_WORDS_ID,
  COMMON_WORDS_NL,
} from './filter_data.js';
import ParserBase, { ParserResult } from './ParserBase.js';
import Tokenizer, { Token } from './Tokenizer.js';

// Normalize a word/compound to a comparable stem: lowercase, drop spaces,
// joiners, punctuation. Used to detect a compound's derivation by containment.
const normStem = (s: string): string =>
  s.toLowerCase().replace(/[()]/g, '').replace(/[+\-\s'·]/g, '');

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
    this._tildeTracked = null;
    this._tildeDerivSeen = false;
  }

  // A derivation of `compound` is an affixed bold/italic word whose normalized
  // stem contains the compound (e.g. `merumahsakitkan` contains `rumahsakit`).
  // `slice(1)` tolerates meN-/peN- first-consonant mutation. `~`-led spans are
  // sub-compounds, not derivations, so they are skipped.
  protected lineHasDerivation(line: string, compound: string): boolean {
    const stem = normStem(compound);
    const short = stem.slice(1);
    const spans: string[] = [];
    for (const m of line.matchAll(/\*\*([^*]+)\*\*/g)) spans.push(m[1]);
    const sansBold = line.replace(/\*\*[^*]+\*\*/g, '');
    for (const m of sansBold.matchAll(/\*([^*]+)\*/g)) spans.push(m[1]);
    return spans.some((w) => {
      const t = w.trim();
      if (t.startsWith('~')) return false;
      const n = normStem(t);
      return n !== stem && (n.includes(stem) || (short.length >= 4 && n.includes(short)));
    });
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
