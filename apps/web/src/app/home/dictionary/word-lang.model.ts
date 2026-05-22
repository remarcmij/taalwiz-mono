export class WordLang {
  public _id?: string;

  constructor(public word: string, public lang: string) {}

  get key() {
    return this.word + ':' + this.lang;
  }
}
