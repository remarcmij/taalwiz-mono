import { removeParenthesizedFragments as removeParenFragments } from './helpers.js';

export interface Parser {
  get sourceLang(): string;
  get targetLang(): string;
  get base(): string | null;
  get homonym(): number;
  get tildeWord(): string | null;
  reset(): void;
  revertTildeToBase(): void;
  parseLine(line: string): ParserResult;
}

export class ParserResult {
  line = '';
  sourceKeywords: Set<string> = new Set();
  referenceWords: Set<string> = new Set();
  targetWords: Set<string> = new Set();
  // Non-fatal authoring warning (e.g. a likely-missing `^` tilde-revert). The
  // compiler logs it with a line number; it does not abort the build.
  warning: string | undefined = undefined;
}

abstract class ParserBase implements Parser {
  private _sourceLang: string;
  private _targetLang: string;
  protected _base: string | null = null;
  protected _prevBase: string | null = null;
  protected _tildeWord: string | null = null;
  protected _homonym = 0;
  // Forward guard for missing `^` markers: track whether the active compound's
  // own derivation has already appeared (the signature of a tilde that should
  // have been reverted to the base). `_tildeTracked` is the tilde value these
  // flags describe, so we can reset them when the tilde changes.
  protected _tildeTracked: string | null = null;
  protected _tildeDerivSeen = false;

  abstract extractWords(line: string, result: ParserResult): void;

  // Whether `line` carries a derivation of `compound` (an affixed form whose
  // stem contains the compound). Default: no; overridden per language.
  protected lineHasDerivation(_line: string, _compound: string): boolean {
    return false;
  }

  constructor(sourceLang: string, targetLang: string) {
    this._sourceLang = sourceLang;
    this._targetLang = targetLang;
  }

  reset() {
    this._base = null;
    this._tildeWord = null;
    this._tildeTracked = null;
    this._tildeDerivSeen = false;
  }

  // True when the active tilde is a multi-word compound whose own derivation has
  // already been seen — i.e. the headword's list has resumed and a `^` revert is
  // expected. Genuine sub-compounds come *before* the derivation, so they don't
  // trip this.
  protected tildeNeedsRevert(): boolean {
    return (
      !!this._tildeWord &&
      this._tildeWord.includes(' ') &&
      this._tildeDerivSeen
    );
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

  // A `^` marker line resets the tilde reference back to the grondwoord (base),
  // undoing the drift caused by a bold compound mid-entry. Teeuw's swung dash
  // always denotes the headword within the compound list, but a bold compound
  // (e.g. **akal+budi**) re-anchors the tilde; `^` marks where the headword's
  // alphabetical compound list resumes, so following `~`/sense lines bind to the
  // base again until the next bold word re-anchors it.
  revertTildeToBase(): void {
    if (!this._base) {
      throw new Error('"^" tilde-revert marker before any headword');
    }
    this._tildeWord = this._base;
  }

  get homonym() {
    return this._homonym;
  }

  parseLine(line: string): ParserResult {
    const parserResult = new ParserResult();
    const original = line;

    const hasParens = line.match(/[()]/);

    let text = hasParens ? line.replace(/[()]/g, '') : line;
    this.extractWords(text, parserResult);

    if (hasParens) {
      text = removeParenFragments(line);
      this.extractWords(text, parserResult);
    }

    if (this.base && !parserResult.sourceKeywords.has(this.base)) {
      parserResult.referenceWords.add(this.base);
    }

    // Reset the derivation tracker whenever the active tilde changes.
    if (this._tildeWord !== this._tildeTracked) {
      this._tildeTracked = this._tildeWord;
      this._tildeDerivSeen = false;
    }

    if (line.indexOf('~') !== -1) {
      if (!this._tildeWord) {
        throw new Error('Tilde found but no tilde word set');
      }
      // Check against derivations seen on *prior* lines, before this line's own
      // derivation (if any) updates the flag below.
      if (this.tildeNeedsRevert()) {
        parserResult.warning =
          `"~" binds to compound "${this._tildeWord}" after its derivation; ` +
          `expected a "^" revert to base "${this._base}"`;
      }
      line = line.replace(/~/g, this._tildeWord);
    }

    if (line.indexOf('+') !== -1) {
      line = line.replace(/\+/g, ' ');
    }

    // If this line carries the active compound's derivation, the headword's
    // list resumes after it — so following `~`/sense lines expect a `^`.
    if (
      this._tildeWord &&
      this._tildeWord.includes(' ') &&
      this.lineHasDerivation(original, this._tildeWord)
    ) {
      this._tildeDerivSeen = true;
    }

    parserResult.line = line;

    return parserResult;
  }
}

export default ParserBase;
