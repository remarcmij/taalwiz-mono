import { removeParenthesizedFragments as removeParenFragments } from './helpers.js';

export class WordSets {
  sourceKeywords: Set<string> = new Set();
  sourceWords: Set<string> = new Set();
  targetKeywords: Set<string> = new Set();
}

export interface Parser {
  get sourceLang(): string;
  get targetLang(): string;
  get base(): string | null;
  get homonym(): number;
  get tildeWord(): string | null;
  reset(): void;
  parseLine(line: string): ParserResult;
}

export class ParserResult {
  line = '';
  sourceKeywords: Set<string> = new Set();
  sourceWords: Set<string> = new Set();
  targetKeywords: Set<string> = new Set();
}

abstract class ParserBase implements Parser {
  private _sourceLang: string;
  private _targetLang: string;
  protected _base: string | null = null;
  protected _prevBase: string | null = null;
  protected _tildeWord: string | null = null;
  protected _homonym = 0;

  abstract extractWords(line: string, wordSets: WordSets): void;

  constructor(sourceLang: string, targetLang: string) {
    this._sourceLang = sourceLang;
    this._targetLang = targetLang;
  }

  reset() {
    this._base = null;
    this._tildeWord = null;
  }

  get sourceLang() {
    return this._sourceLang;
  }

  get targetLang() {
    return this._targetLang;
  }

  get base(): string | null {
    return this._base;
  }

  setBase(word: string) {
    this._base = word;
    if (this._base == this._prevBase) {
      this._homonym += 1;
    } else {
      this._homonym = 0;
    }
  }

  get tildeWord(): string | null {
    return this._tildeWord;
  }

  set tildeWord(word: string | null) {
    this._tildeWord = word;
  }

  get homonym() {
    return this._homonym;
  }

  parseLine(line: string): ParserResult {
    const parserResult = new ParserResult();

    const hasParens = line.match(/[()]/);

    let text = hasParens ? line.replace(/[()]/g, '') : line;
    this.extractWords(text, parserResult);

    if (hasParens) {
      text = removeParenFragments(line);
      this.extractWords(text, parserResult);
    }

    // TODO: deduplicate words?
    if (this.base && !parserResult.sourceKeywords.has(this.base)) {
      parserResult.sourceWords.add(this.base);
    }

    if (line.indexOf('~') !== -1) {
      if (!this._tildeWord) {
        throw new Error('Tilde found but no tilde word set');
      }
      line = line.replace(/~/g, this._tildeWord);
    }

    if (line.indexOf('+') !== -1) {
      line = line.replace(/\+/g, ' ');
    }

    parserResult.line = line;

    return parserResult;
  }
}

export default ParserBase;
