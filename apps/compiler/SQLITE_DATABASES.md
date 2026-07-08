# SQLite Dictionary Databases

This compiler can generate SQLite databases from the compiled JSON dictionary files, enabling efficient local querying without loading entire JSON files into memory.

## Overview

Two SQLite databases are generated from the compiled JSON chapters:

- `teeuw.db` — Indonesian-Dutch dictionary
- `stevens.db` — Indonesian-English dictionary

Each database contains all chapters (a–z) from the respective dictionary, organized in a relational schema with full-text search capabilities.

## Building the Databases

### Command

```bash
pnpm --filter compiler run build:dbs
```

This command:
1. Reads all compiled JSON chapter files from `json/teeuw/` and `json/stevens/`
2. Creates or overwrites `teeuw.db` and `stevens.db` in the `apps/compiler/` folder
3. Populates them with lemmas and words
4. Builds indexes and full-text search tables

### Database Files

After building, the databases are located at:

```
apps/compiler/teeuw.db
apps/compiler/stevens.db
```

Each database includes:
- **chapters** table — Dictionary chapters by letter (a–z)
- **lemmas** table — Dictionary entries with base word, homonym, and full text
- **words** table — Individual words/glosses linked to lemmas
- **fts_lemmas** virtual table — Full-text search index
- **lemmas_view** — Convenient read-only view joining lemmas and words

## Schema

### tables.chapters

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Chapter ID |
| letter | TEXT UNIQUE | Chapter letter (a–z) |
| created_at | DATETIME | Creation timestamp |

### tables.lemmas

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Lemma ID |
| chapter_id | INTEGER FK | Reference to chapters |
| base | TEXT | Base word (headword) |
| homonym | INTEGER | Homonym number (0 for first sense) |
| text | TEXT | Full entry text with markup |
| created_at | DATETIME | Creation timestamp |

Unique constraint: `(chapter_id, base, homonym)`

### tables.words

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Word ID |
| lemma_id | INTEGER FK | Reference to lemmas |
| word | TEXT | Word text (keyword or gloss) |
| lang | TEXT | Language code ('id', 'nl', 'en') |
| is_keyword | INTEGER | 1 if keyword, 0 if gloss |
| created_at | DATETIME | Creation timestamp |

### views.lemmas_view

A denormalized view joining lemmas with their associated words. Columns:

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Lemma ID |
| letter | TEXT | Chapter letter |
| base | TEXT | Base word |
| homonym | INTEGER | Homonym number |
| text | TEXT | Full entry text |
| keywords | TEXT | Pipe-separated keywords (all languages) |
| glosses_nl | TEXT | Pipe-separated Dutch glosses |
| glosses_en | TEXT | Pipe-separated English glosses |
| created_at | DATETIME | Timestamp |

## Query Examples

### Using TypeScript

Import the query utilities:

```typescript
import { openDictionary, DictionaryDatabase } from '@apps/compiler/src/db-query';

// Open a dictionary
const teeuw = openDictionary('teeuw');

// Look up a lemma by base word
const results = teeuw.findByBase('makan');
console.log(results);

// Search by prefix
const prefixMatches = teeuw.searchByBasePrefix('mak');

// Full-text search
const ftsMatches = teeuw.fullTextSearch('food eating');

// Find by keyword
const byKeyword = teeuw.findByKeyword('voedsel');

// Get all lemmas in a chapter
const chapterH = teeuw.getChapter('h');

// Get dictionary statistics
const stats = teeuw.getStatistics();
console.log(stats);

// Export chapter as JSON
const json = teeuw.exportAsJson('a');

teeuw.close();
```

### Direct SQL Queries

Using any SQLite client (e.g., `sqlite3`, DB Browser, or in Node.js):

```sql
-- Find a lemma by base word
SELECT * FROM lemmas_view WHERE base = 'makan' ORDER BY homonym;

-- Search base words starting with "mak"
SELECT base, COUNT(*) as count
FROM lemmas_view
WHERE base LIKE 'mak%'
GROUP BY base
ORDER BY base;

-- Find all keywords (both Indonesian and Dutch)
SELECT DISTINCT word, lang, COUNT(*) as uses
FROM words
WHERE is_keyword = 1
GROUP BY word, lang
ORDER BY uses DESC
LIMIT 50;

-- Full-text search
SELECT * FROM lemmas_view l
INNER JOIN fts_lemmas f ON l.id = f.rowid
WHERE fts_lemmas MATCH 'to eat'
LIMIT 20;

-- Get chapter statistics
SELECT letter, COUNT(*) as lemmaCount
FROM lemmas_view
GROUP BY letter
ORDER BY letter;

-- Find homonyms (entries with multiple senses)
SELECT base, COUNT(*) as homonymCount
FROM lemmas
GROUP BY base
HAVING COUNT(*) > 1
ORDER BY homonymCount DESC;
```

## Performance Considerations

### Indexes

The databases include indexes on frequently queried columns:

- `idx_lemmas_base` — Fast lookups by base word
- `idx_words_word` — Fast word searches
- `idx_words_word_lang` — Scoped word searches by language
- `idx_words_is_keyword` — Filtering by keyword/gloss

### Full-Text Search

The `fts_lemmas` virtual table provides full-text search using SQLite's FTS5 engine. It's useful for:

- Substring searches across multiple columns
- Multi-term queries
- Approximate phrase matching

### Database Size

- **teeuw.db** — ~20–30 MB (depends on source file size)
- **stevens.db** — ~30–50 MB

### Memory Usage

When using `DictionaryDatabase` (read-only mode):

- Database connection: minimal overhead
- Each query loads results into memory on demand
- Large result sets (e.g., `fullTextSearch` with many matches) may consume significant memory

## Integration

### With Node.js API

To serve dictionary queries from the API:

```typescript
import { openDictionary } from '@apps/compiler/src/db-query';

app.get('/api/dict/:dict/search', (req, res) => {
  const dict = openDictionary(req.params.dict);
  const results = dict.findByBase(req.query.q);
  dict.close();
  res.json(results);
});
```

### With Web Client

The databases can be:
1. **Embedded** in the compiled app bundle (limits size)
2. **Served** as downloadable artifacts for offline use
3. **Queried** via a server-side API

## Maintenance

### Rebuilding

After updating dictionary source files (`dict/teeuw/*.md`, `dict/stevens/*.md`):

```bash
# Recompile JSON chapters
pnpm --filter compiler run build

# Rebuild SQLite databases
pnpm --filter compiler run build:dbs
```

### Checking Database Integrity

```bash
sqlite3 teeuw.db "PRAGMA integrity_check;"
```

### Exporting Data

To export chapter data:

```typescript
const teeuw = openDictionary('teeuw');
const chapterA = teeuw.exportAsJson('a');
console.log(JSON.stringify(chapterA, null, 2));
teeuw.close();
```

## Troubleshooting

### "Cannot find module 'better-sqlite3'"

Install dependencies:

```bash
pnpm install
```

### Database locked

Ensure all connections are closed after use:

```typescript
const dict = openDictionary('teeuw');
try {
  // ... queries ...
} finally {
  dict.close();
}
```

### Slow queries

- Check query plan: `EXPLAIN QUERY PLAN SELECT ...`
- Ensure indexes exist: `PRAGMA index_list(lemmas);`
- Consider using `lemmas_view` for pre-joined data
