# SQLite Dictionary Databases — Quick Start

Two SQLite databases (`teeuw.db` and `stevens.db`) provide fast local querying of dictionary data without loading entire JSON files into memory.

## Build the Databases

```bash
pnpm --filter compiler run build:dbs
```

This reads all compiled JSON chapters and generates:
- `apps/compiler/teeuw.db` (~12 MB) — 31,886 lemmas
- `apps/compiler/stevens.db` (~16 MB) — 41,823 lemmas

## Query via CLI

```bash
# Statistics
pnpm --filter compiler run db:cli teeuw stats

# Exact lookup
pnpm --filter compiler run db:cli teeuw lookup makan

# Prefix search
pnpm --filter compiler run db:cli teeuw prefix mak

# Full-text search
pnpm --filter compiler run db:cli stevens search "to eat"

# All lemmas in chapter
pnpm --filter compiler run db:cli teeuw chapter m

# Find by keyword
pnpm --filter compiler run db:cli teeuw keyword eten

# Export as JSON
pnpm --filter compiler run db:cli teeuw export a
```

## Use in TypeScript

```typescript
import { openDictionary } from '@apps/compiler/src/db-query';

async function example() {
  const dict = openDictionary('teeuw');

  // Lookup by base word
  const results = await dict.findByBase('makan');
  console.log(results);

  // Prefix search
  const prefixMatches = await dict.searchByBasePrefix('mak');

  // Full-text search
  const ftsResults = await dict.fullTextSearch('eating food');

  // Get statistics
  const stats = await dict.getStatistics();
  console.log(`Total lemmas: ${stats.totalLemmas}`);

  // Export as JSON
  const json = await dict.exportAsJson('a');

  dict.close();
}

example().catch(console.error);
```

## Database Schema

Three main tables:

- **chapters** — Dictionary chapters (a–z)
- **lemmas** — Dictionary entries (base word + homonym)
- **words** — Individual words/glosses linked to lemmas

Plus a **lemmas_view** for convenient queries joining all data:

```typescript
interface LemmaRecord {
  id: number;
  letter: string;
  base: string;
  homonym: number;
  text: string;
  keywords?: string;           // Pipe-separated keywords
  glosses_nl?: string;         // Pipe-separated Dutch glosses
  glosses_en?: string;         // Pipe-separated English glosses
  created_at: string;
}
```

## SQL Query Examples

```sql
-- Find a lemma by base word
SELECT * FROM lemmas_view WHERE base = 'makan';

-- Search prefix
SELECT DISTINCT base FROM lemmas WHERE base LIKE 'mak%';

-- All keywords
SELECT DISTINCT word FROM words WHERE is_keyword = 1 LIMIT 50;

-- Chapter statistics
SELECT letter, COUNT(*) as lemmaCount
FROM lemmas_view
GROUP BY letter
ORDER BY letter;
```

## Performance

- **Lookup latency**: < 5ms (in-memory)
- **Database size**: 12–16 MB each (3–4 MB gzipped)
- **Query concurrency**: Sequential (sql.js is single-threaded)
- **Memory overhead**: ~20–30 MB when loaded

## Workflow

1. Update source dictionary files (`dict/teeuw/*.md`, `dict/stevens/*.md`)
2. Build JSON chapters: `pnpm --filter compiler run build`
3. Build SQLite databases: `pnpm --filter compiler run build:dbs`
4. Query locally or distribute databases

## Documentation

- **`SQLITE_DATABASES.md`** — Complete schema and query guide
- **`BUILD_SUMMARY.md`** — Architecture and implementation details

## Troubleshooting

**"Database not found"**
```bash
# Rebuild databases
pnpm --filter compiler run build:dbs
```

**Slow queries**
- Ensure you're querying `lemmas_view` for joined data
- Use `LIMIT` clauses to reduce result sets
- Check indexes: `PRAGMA index_list(lemmas);`

**Need to rebuild from source?**
```bash
# Clean and rebuild everything
pnpm --filter compiler run build && pnpm --filter compiler run build:dbs
```
