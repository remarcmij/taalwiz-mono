export interface ILemma {
  _id?: string;
  word: string;
  lang: string;
  keyword?: number;
  baseWord: string;
  baseLang: string;
  text: string;
  homonym: number;
  // True when this entry comes from a Teeuw supplement (`teeuw.a+.md`) file, so
  // the UI can mark post-1996 additions distinctly. Absent for core entries.
  teeuwPlus?: boolean;
}
