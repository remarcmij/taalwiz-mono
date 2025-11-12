export interface ILemma {
  _id: string;
  word: string;
  lang: string;
  attr: string;
  baseWord: string;
  baseLang: string;
  text: string;
  order: number;
  homonym: number;
  groupName: string;
}
