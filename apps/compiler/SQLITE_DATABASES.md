# SQLite Databases

The compiler can emit one SQLite database per dictionary from the generated
chapter JSON, for ad-hoc inspection with local tools (DBeaver, the `sqlite3`
CLI, etc.). These databases are **not** used by the app at runtime — they are a
developer convenience for querying the compiled data with SQL.

## Build

```bash
pnpm --filter compiler run build:dbs
```

This reads every `json/<dict>/<dict>.<letter>.json` file and writes:

- `apps/compiler/db/teeuw.db` — Indonesian → Dutch
- `apps/compiler/db/stevens.db` — Indonesian → English

The `db/` folder is gitignored; regenerate it whenever the JSON is recompiled.
Each run rebuilds the files from scratch.

## Implementation

- `src/db/build-databases.ts` — entry point / build loop
- `src/db/schema.ts` — the SQL schema (DDL)
- `src/db/types.ts` — TypeScript shapes of the chapter JSON

The builder uses Node's built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html)
(`DatabaseSync`) — no third-party dependency, native speed. It requires a Node
version that ships `node:sqlite` (Node 22.5+; developed against Node 26). All
inserts run inside a single transaction via prepared statements.

## Schema

One database file per dictionary, so there is no dictionary column — the file is
the dictionary.

**`lemmas`** — one row per dictionary entry. Entries are stored verbatim with no
uniqueness constraint on `(base, homonym)`, because the source legitimately
double-files some words.

| column | type | notes |
| ------ | ---- | ----- |
| `id` | INTEGER PK | |
| `base` | TEXT | normalised root headword |
| `homonym` | INTEGER | 0 when only one sense group |
| `text` | TEXT | rendered entry markup |
| `is_supplement` | INTEGER | 1 for post-1996 supplement entries |

**`words`** — searchable tokens harvested from each entry. Each token is stored
twice: the original for display, and a normalised form for indexing.

| column | type | notes |
| ------ | ---- | ----- |
| `id` | INTEGER PK | |
| `lemma_id` | INTEGER | → `lemmas.id` |
| `word` | TEXT | original token, for display |
| `search` | TEXT | lowercased, diacritics stripped (NFD → drop combining marks → lowercase); use this for lookups |
| `lang` | TEXT | `id` = headword, `nl`/`en` = gloss |
| `is_keyword` | INTEGER | 1 for indexed keywords |

Indexes: `lemmas(base)`, `words(lemma_id)`, `words(search)`,
`words(search, lang)`.

## Example queries

Open `db/teeuw.db` in DBeaver, or use the CLI:

```sql
-- exact headword lookup
SELECT base, homonym, text FROM lemmas WHERE base = 'makan';

-- find entries by a gloss word (match on the normalised `search` column)
SELECT DISTINCT l.base, l.text
FROM words w JOIN lemmas l ON l.id = w.lemma_id
WHERE w.lang = 'nl' AND w.search = 'eten';

-- diacritic-insensitive token search, original spelling shown for display
SELECT word, lang FROM words WHERE search = 'scene';

-- supplement entries only
SELECT base, text FROM lemmas WHERE is_supplement = 1;
```
