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
  isSupplement?: boolean;
}

/**
 * True when the searched word is the headword of this lemma (`keyword === 1`,
 * the default), as opposed to a non-keyword mention: an italic example usage or
 * a derived-form cross-reference. Drives the collapsed dictionary view, which
 * shows only headword definitions — matching the condensed word-click dialog.
 */
export function isHeadwordLemma(lemma: ILemma): boolean {
  return (lemma.keyword ?? 1) === 1;
}
