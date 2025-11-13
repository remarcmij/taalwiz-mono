export interface ILemma {
  _id: string;
  word: string;
  lang: string;
  baseWord: string;
  baseLang: string;
  text: string;
  homonym: number;
}
