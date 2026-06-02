export class WordLang {
  public _id?: string;
  // True only when EVERY sense of this word is a Teeuw supplement (post-1996)
  // entry, so the suggestion list and headword button can mark wholly-new words.
  // A word that also exists in core Teeuw (e.g. "aplikasi") stays unmarked.
  public teeuwPlus?: boolean;

  constructor(
    public word: string,
    public lang: string,
    teeuwPlus?: boolean,
  ) {
    this.teeuwPlus = teeuwPlus;
  }

  get key() {
    return this.word + ':' + this.lang;
  }
}
