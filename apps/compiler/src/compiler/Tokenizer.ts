export const enum Token {
  Arrow,
  Caret,
  Star,
  Comma,
  DblStar,
  DblUnder,
  Done,
  LeftBracket,
  Numeric,
  Other,
  RightBracket,
  Semicolon,
  Tilde,
  Underscore,
  Word,
}

// A word may carry internal `.` or `/` between letters so dotted/slashed
// abbreviation headwords stay whole (`a.d.`, `Bc.Ac.P.`, `b/b`, `s/d`) instead of
// splitting at the first period — the run must still END in a letter, so a
// trailing sentence period is consumed by `[.!?]?`, not absorbed into the word.
const RE_WORD = RegExp(
  String.raw`^((?:-?[+'\p{L}][-+'\d\p{L}./]*['\p{L}·]-?)|(?:-?[+'\p{L}]+-?))[.!?]?`,
  'u'
);

const TOKEN_PATTERNS = [
  { regex: RE_WORD, token: Token.Word },
  { regex: /^\*\*/, token: Token.DblStar },
  { regex: /^\*/, token: Token.Star },
  { regex: /^__/, token: Token.DblUnder },
  { regex: /^_/, token: Token.Underscore },
  { regex: /^~/, token: Token.Tilde },
  { regex: /^\^/, token: Token.Caret },
  { regex: /^,/, token: Token.Comma },
  { regex: /^;/, token: Token.Semicolon },
  { regex: /^[\d½¼¾²⁵]+/, token: Token.Numeric },
  { regex: /^\[/, token: Token.LeftBracket },
  { regex: /^]/, token: Token.RightBracket },
  { regex: /^→/, token: Token.Arrow },
  { regex: /^./, token: Token.Other },
];

const whiteSpaceRegex = /^[ \t\n\f]+/;

class Tokenizer {
  private _value = '';

  constructor(private text: string) {}

  next(): Token {
    const match = this.text.match(whiteSpaceRegex);
    if (match) {
      this.text = this.text.slice(match[0].length);
    }

    if (!this.text) {
      this._value = '';
      return Token.Done;
    }

    for (const { regex, token } of TOKEN_PATTERNS) {
      const match = this.text.match(regex);

      if (match) {
        switch (token) {
          case Token.Word: {
            this._value = match[1] || match[2];
            break;
          }

          default:
            this._value = match[0];
            break;
        }

        this.text = this.text.slice(match[0].length);
        return token;
      }
    }

    throw new Error(`unexpected lexer error: '${this.text}'`);
  }

  get value() {
    return this._value;
  }
}

export default Tokenizer;
