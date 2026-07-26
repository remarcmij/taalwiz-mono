/**
 * What a dictionary line is, relative to the entry's base headword. Computed at
 * import time from the parser's keyword roles (`dict-db.ts` `classifyLine`):
 *   - `headword` — a sense of the entry itself (`**ékor** 1 tail…`)
 *   - `derived`  — a derived sub-headword (`**berékor**…`, base `ékor`)
 *   - `usage`    — an italic example phrase only (`*ékor iring-iringan*…`)
 */
export type LineKind = 'headword' | 'derived' | 'usage';

/** Detail tiers for the dictionary view: `keywords` (the default) shows the
 * entry's own senses plus its derived sub-headwords; `all` additionally shows
 * the italic example usages and cross-reference cards. */
export type DetailLevel = 'keywords' | 'all';

export interface Lemma {
  word: string;
  lang: string;
  // 1 when this word is a genuine keyword of the line, 0 when it merely appears
  // as a cross-reference to another headword. Always present: `transformDict`
  // defaults an absent compiled value to 1 when writing the record. Numeric
  // rather than boolean because it is a stored IndexedDB field and booleans are
  // not valid IDB keys -- see SEARCH.md 9.2.
  keyword: 0 | 1;
  baseWord: string;
  baseLang: string;
  text: string;
  homonym: number;
  // True when this entry comes from a Teeuw supplement (`teeuw.a+.md`) file, so
  // the UI can mark post-1996 additions distinctly. Absent for core entries.
  isSupplement?: boolean;
  // Line classification for the detail tiers; absent === 'headword' (the most
  // common kind is omitted at import to save space). See LineKind.
  lineKind?: LineKind;
}

const LEVEL_RANK: Record<DetailLevel, number> = { keywords: 1, all: 2 };

/**
 * Detail rank of a lemma RELATIVE TO THE SEARCHED WORD: 0 = its own headword
 * sense, 1 = a derivative of it, 2 = a usage or an appearance inside another
 * headword's entry. It combines two signals the record already carries —
 * `keyword` (is the searched word the keyword on this line?) and the import-time
 * `lineKind` (what the line is within its OWN entry):
 *
 *   - `keyword === 1` → the searched word is itself the keyword here: its own
 *     sense, or a derived form searched directly (`memukul`). Tier 0.
 *   - else a derived line of the word's OWN entry (`lineKind === 'derived'` and
 *     the line's base is the searched word) → tier 1.
 *   - else a usage, or the word sitting inside ANOTHER headword's entry
 *     (`barang` within `barang kumanga`, where `baseWord` is `kumanga`) → tier 2.
 *
 * `lineKind` alone is relative to the line's own base, so it cannot tell a
 * derivative of the searched word from the searched word sitting inside a
 * different headword; `keyword` and the `word === baseWord` check supply that.
 */
function detailRankOf(lemma: Lemma): number {
  if (lemma.keyword === 1) return 0;
  if (lemma.lineKind === 'derived' && lemma.word === lemma.baseWord) return 1;
  return 2;
}

/**
 * Whether a lemma is shown at the given detail level: true when its rank
 * relative to the searched word is within the level's depth. At `keywords` the
 * word's own senses (rank 0) and its derivatives (rank 1) show; `all`
 * additionally admits usages and cross-references (rank 2).
 */
export function lemmaVisibleAt(lemma: Lemma, level: DetailLevel): boolean {
  return detailRankOf(lemma) <= LEVEL_RANK[level];
}
