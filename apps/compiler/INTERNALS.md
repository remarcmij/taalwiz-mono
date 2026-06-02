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

1. `index.ts` finds all `dict/**/*.md` files via `glob`, then groups them by
   output chapter so a core file (`teeuw.a.md`) and its optional supplement
   (`teeuw.a+.md`) compile together into a single `teeuw.a.json`
2. `Compiler` reads each source file line-by-line, groups entries by blank lines,
   and streams them all into one output (reusing the parser across files so
   homonym numbering carries across the core -> supplement boundary)
3. Parser extracts lemmas with words, language tags, and keyword flags; lemmas
   read from a `+` supplement file are stamped `teeuwPlus: true`
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

### Supplement files

A chapter may have an optional supplement file alongside the core file, named
with a `+` before the extension: `teeuw.a+.md` next to `teeuw.a.md`. It uses the
exact same markup and lets linguists add post-1996 words **without editing the
digitized originals**. Both files compile into the same chapter JSON, and every
lemma from the `+` file is flagged `teeuwPlus: true` so the client can mark
modern additions distinctly. See [TEEUW_SUPPLEMENT.md](./TEEUW_SUPPLEMENT.md)
for the full design.

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
        { "word": "ab", "lang": "id", "keyword": 1 },
        { "word": "busje", "lang": "nl", "keyword": 1 },
        { "word": "potje", "lang": "nl", "keyword": 1 }
      ]
    }
  ]
}
```

Lookups are resolved on the client by the `[lang, wordLower]` IndexedDB index
(case-insensitive prefix search) and ordered for display by `homonym`; the
keyword/reference distinction is carried by the `keyword` flag. The compiler
therefore emits no positional sort key.

Lemmas from a supplement file additionally carry `"teeuwPlus": true` at the
lemma level (omitted for core lemmas, so their JSON is byte-identical to a
single-file compile).

## Testing

Uses **Vitest** (`vitest run`), run via `pnpm --filter compiler run test`.

Test files (in `src/__tests__/`):
- `helpers.test.ts` — `removeParenthesizedFragments()`
- `tokenizer.test.ts` — Tokenizer token sequences
- `parser.test.ts` — `TeeuwParser` and `VanDaleParser` extraction logic
- `compiler.test.ts` — `Compiler` integration (multi-group compilation, homonym assignment, malformed-file handling, core+supplement merge with `teeuwPlus`)

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
| 9 | ~~Magic numbers: `CHAPTER_DISTANCE` (50,000), `ORDER_OFFSET` (2,000,000)~~ — resolved: the `order` field and its constants were removed; the client sorts by `homonym` and the `[lang, wordLower]` index | — |
