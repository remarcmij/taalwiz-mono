export interface ILemma {
  _id?: string;
  word: string;
  lang: string;
  keyword?: number;
  baseWord: string;
  baseLang: string;
  text: string;
  homonym: number;
}
