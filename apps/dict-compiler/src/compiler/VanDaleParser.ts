import ParserBase, { ParserResult } from './ParserBase.js';
import Tokenizer, { Token } from './Tokenizer.js';

export default class VanDaleParser extends ParserBase {
  constructor() {
    super('nl', 'id');
  }

  parseLine(line: string): ParserResult {
    if (!line.match(/__/)) {
      if (!this.tildeWord) {
        throw new Error('Tilde word not set');
      }

      line = `__${this.tildeWord}__, ${line}`;
    }

    return super.parseLine(line);
  }

  extractWords(line: string, result: ParserResult): void {
    const tokenizer = new Tokenizer(line);
    let token = tokenizer.next();

    while (token !== Token.Done) {
      if (token === Token.DblUnder) {
        this.parseDblUnderFragment(tokenizer, result.sourceKeywords);
      }
      token = tokenizer.next();
    }
  }

  parseDblUnderFragment(tokenizer: Tokenizer, wordSet: Set<string>) {
    let token = tokenizer.next();
    let wordSeen = false;
    this.tildeWord = null;

    for (;;) {
      switch (token) {
        case Token.Word: {
          const word = tokenizer.value;
          if (!this._base) {
            this.setBase(word);
          }
          if (!this.tildeWord) {
            this.tildeWord = word;
          }
          wordSet.add(word);
          wordSeen = true;
          break;
        }

        case Token.DblUnder:
          if (!wordSeen) {
            throw new Error('expected word');
          }
          return;

        case Token.Done:
          throw new Error('unterminated "__" fragment');

        default:
        // ignore other tokens
      }

      token = tokenizer.next();
    }
  }
}
