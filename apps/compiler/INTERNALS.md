# Taalwiz Compiler — Internals

## Dictionaries

- **Teeuw** — Indonesian (`id`) → Dutch (`nl`), based on the work of A. Teeuw
- **Van Dale** — Dutch (`nl`) → Indonesian (`id`), based on the Van Dale dictionary

## Source layout

```
src/
  index.ts              ← Entry: glob discovery + parallel compilation
  compiler/
    Compiler.ts         ← Orchestrator: reads .md, writes .json
    ParserBase.ts       ← Abstract base with shared parsing logic
    TeeuwParser.ts      ← Indonesian-to-Dutch parser
    VanDaleParser.ts    ← Dutch-to-Indonesian parser
    Tokenizer.ts        ← Hand-written lexer
    helpers.ts          ← Parenthesis stripping utility
    filter_data.ts      ← Dutch abbreviations & stop word filters
```

## How It Works

1. `index.ts` finds all `dict/**/*.md` files via `glob`
2. `Compiler` reads `.md` line-by-line, groups entries by blank lines
3. Parser extracts lemmas with words, language tags, keyword flags, and sort order
4. Streams JSON output to `json/*.json`

### Input Format

Custom markup syntax:

| Syntax | Meaning |
|--------|---------|
| `**word**` | Headword (source keyword) |
| `*word*` | Derived/related form |
| `~` | Shorthand for current headword |
| `+` | Space (in compound words) |
| `->` | Cross-reference separator |
| Blank line | Entry delimiter |
| `1`, `2`, etc. | Sub-sense of previous headword |

### Output Format

```json
{
  "targetLang": "id",
  "lemmas": [
    {
      "text": "**ab** I, sv busje, potje (voor het opbergen van opium).",
      "base": "ab",
      "homonym": 0,
      "words": [
        { "word": "ab", "lang": "id", "keyword": 1, "order": 0 },
        { "word": "busje", "lang": "nl", "keyword": 1, "order": 0 },
        { "word": "potje", "lang": "nl", "keyword": 1, "order": 0 }
      ]
    }
  ]
}
```

The `order` field enables efficient alphabetical searching:
- `(letter_code - 'a') * 50,000` as the chapter base
- Incremented by 1 per lemma within the chapter
- `ORDER_OFFSET` (2,000,000) added for non-keyword source words

## Testing

Uses **Vitest** (`vitest run`), run via `pnpm --filter compiler run test`.

Test files (in `src/__tests__/`):
- `helpers.test.ts` — `removeParenthesizedFragments()`
- `tokenizer.test.ts` — Tokenizer token sequences
- `parser.test.ts` — `TeeuwParser` and `VanDaleParser` extraction logic
- `compiler.test.ts` — `Compiler` integration (multi-group compilation, homonym assignment, malformed-file handling)

## Known Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | ~~`mkdirp` listed in dependencies but never used~~ — resolved: removed from `package.json` | — |
| 2 | ~~`ts-node` listed in devDependencies but unused (tests use `tsx`)~~ — resolved: removed from `package.json` | — |
| 3 | ~~No tests for `VanDaleParser`~~ — resolved: covered in `parser.test.ts` | — |
| 4 | ~~No tests for `Compiler` (integration tests)~~ — resolved: covered in `compiler.test.ts` | — |
| 5 | ~~`moduleResolution` commented out in `tsconfig.json`~~ — resolved: set to `nodenext` | — |
| 6 | `tsgo` build uses experimental TypeScript Go compiler (`@typescript/native-preview`) | Medium |
| 7 | Streaming JSON without validation — malformed output only caught downstream | Medium |
| 8 | ~~Partially-written JSON on parse errors (lenient error handling continues processing)~~ — resolved: failures now abort file processing and delete the malformed JSON | — |
| 9 | Magic numbers: `CHAPTER_DISTANCE` (50,000), `ORDER_OFFSET` (2,000,000) | Low |
