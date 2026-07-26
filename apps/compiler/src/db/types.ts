/**
 * Shapes of the compiler-generated chapter JSON files
 * (`json/<dict>/<dict>.<letter>.json`) consumed by the database builder.
 */

export type Lang = 'id' | 'nl' | 'en';

export interface JsonWord {
  /** The searchable token. */
  word: string;
  /** Language of the token: `id` = headword, `nl`/`en` = gloss. */
  lang: Lang;
  /**
   * 1 when the word is a keyword (indexed headword/gloss), 0 otherwise.
   * Optional only because this describes untrusted on-disk JSON; the compiler
   * always emits it and the builder defaults an absent value to 1, as the web
   * client's `transformDict` does.
   */
  keyword?: 0 | 1;
}

export interface JsonLemma {
  /** Rendered markup for the whole entry. */
  text: string;
  /** Normalised base (root) headword. */
  base: string;
  /** Homonym discriminator (0 when there is only one sense group). */
  homonym: number;
  /** Individual searchable tokens harvested from the entry. */
  words: JsonWord[];
  /** Present and true for post-1996 supplement entries. */
  isSupplement?: boolean;
}

export interface ChapterJson {
  /** Fixed headword language for the deployment (currently always `id`). */
  targetLang: string;
  lemmas: JsonLemma[];
}

export type DictName = 'teeuw' | 'stevens';
