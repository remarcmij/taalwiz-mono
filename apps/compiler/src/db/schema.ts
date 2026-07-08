/**
 * SQLite schema for a single compiled dictionary.
 *
 * One database file per dictionary (`teeuw.db`, `stevens.db`), so there is no
 * dictionary column: the file *is* the dictionary. Lemmas are stored verbatim
 * with no uniqueness constraint on (base, homonym) because the source
 * legitimately double-files some entries.
 */
export const SCHEMA_SQL = `
CREATE TABLE lemmas (
  id            INTEGER PRIMARY KEY,
  base          TEXT NOT NULL,
  homonym       INTEGER NOT NULL,
  text          TEXT NOT NULL,
  is_supplement INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE words (
  id         INTEGER PRIMARY KEY,
  lemma_id   INTEGER NOT NULL REFERENCES lemmas(id),
  word       TEXT NOT NULL,  -- original token, for display
  search     TEXT NOT NULL,  -- lowercased, diacritics stripped, for indexing
  lang       TEXT NOT NULL,
  is_keyword INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_lemmas_base       ON lemmas(base);
CREATE INDEX idx_words_lemma       ON words(lemma_id);
CREATE INDEX idx_words_search      ON words(search);
CREATE INDEX idx_words_search_lang ON words(search, lang);
`;
