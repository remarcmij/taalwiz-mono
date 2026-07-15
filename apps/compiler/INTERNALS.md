# Taalwiz Compiler — Internals

## Dictionaries

- **Teeuw** — Indonesian (`id`) → Dutch (`nl`), based on the work of A. Teeuw
- **Stevens** — Indonesian (`id`) → English (`en`), based on Stevens & Schmidgall-Tellings

A parser is chosen per source file by its filename prefix in
`src/compiler/parser-registry.ts` (`teeuw` → `TeeuwParser`, `stevens` →
`StevensParser`).

## Source location

`index.ts` compiles from the git-tracked canonical source in the sibling
`taalwiz-content` repo (`../taalwiz-content/dict/{teeuw,stevens}`) when it is
checked out alongside this one, falling back to this package's local `dict/`
otherwise. Set the `DICT_DIR` env var (a dict root containing `teeuw/` and/or
`stevens/`) to override. Output JSON is always written to this package's `json/`.

## Source layout

```
src/
  index.ts              ← Entry: source discovery (DICT_DIR / content repo), glob, parallel compilation
  compiler/
    Compiler.ts         ← Orchestrator: reads .md, writes .json; optional headword validation
    ParserBase.ts       ← Abstract base with shared parsing logic
    TeeuwParser.ts      ← Indonesian-to-Dutch parser
    StevensParser.ts    ← Indonesian-to-English parser
    parser-registry.ts  ← Maps filename prefix → parser (+ validateHeadwords flag)
    Tokenizer.ts        ← Hand-written lexer
    helpers.ts          ← Parenthesis stripping utility
    filter_data.ts      ← Dutch/English abbreviations & stop word filters
scripts/
  order-report.mjs        ← QA: slices Stevens headword order/letter warnings
  teeuw-order-report.mjs  ← QA: slices Teeuw headword order/letter warnings
```

## How It Works

1. `index.ts` finds all `{teeuw,stevens}/**/*.md` files under the source dir via
   `glob`, then groups them by output chapter so a core file (`teeuw.a.md`) and
   its optional supplement (`teeuw.a+.md`) compile together into a single
   `teeuw.a.json`
2. `Compiler` reads each source file line-by-line, groups entries by blank lines,
   and streams them all into one output (reusing the parser across files so
   homonym numbering carries across the core -> supplement boundary)
3. Parser extracts lemmas with words, language tags, and keyword flags; lemmas
   read from a `+` supplement file are stamped `isSupplement: true`
4. Streams JSON output to `json/*.json`

### Input Format

Custom markup syntax:

| Syntax | Meaning |
|--------|---------|
| `**word**` | Source keyword (`keyword: 1`). The *first* bold word of a blank-line block is the headword (`base`); later bold words are keywords under that base |
| `*word*` | Reference or example form (`keyword: 0`), not searchable |
| `~` | The nearest preceding bold word (often the `base`, but a bold compound captures it: under `**terima+kasih**`, `kurang ~` is "kurang terima kasih") |
| `^` | The headword (the block's `base`). Resolved per occurrence, no scope. Used where the headword's compound list resumes past a bold compound — print marks that by starting a line with no bold word, which flattening loses. Same marker and meaning in the Stevens source, where it stands for print's en-dash |
| `+` | Space (in compound words). Makes the unit one bold word for `~`; the compound is indexed both whole (`rumah sakit`) and by its parts (`rumah`, `sakit`) |
| `->` | Cross-reference separator (bold words after it are `keyword: 0`) |
| `//` | Comment line: ignored entirely, and does **not** break the surrounding block (not treated as a blank-line separator) |
| Blank line | Entry delimiter (resets the `base`) |
| `1`, `2`, etc. | Sub-sense. A line opening with a bare digit is attributed to the current `~` word, so a headword sense that follows a bold compound must name the headword explicitly |

See [TEEUW_PARSER.md, Part 1](./TEEUW_PARSER.md) for the exact base/keyword/homonym
derivation and worked examples, and [TEEUW_SOURCE_FORMAT.md](./TEEUW_SOURCE_FORMAT.md)
for the print -> markup authoring conventions (how to write/extend the source,
including the `~`/`^` rule).

### Supplement files

A chapter may have an optional supplement file alongside the core file, named
with a `+` before the extension: `teeuw.a+.md` next to `teeuw.a.md`. It uses the
exact same markup and lets linguists add post-1996 words **without editing the
digitized originals**. Both files compile into the same chapter JSON, and every
lemma from the `+` file is flagged `isSupplement: true` so the client can mark
modern additions distinctly. See [TEEUW_PARSER.md](./TEEUW_PARSER.md)
for the full design (Part 2).

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
(case- and accent-insensitive prefix search — the client folds keys via
`foldKey()`) and ordered for display by `homonym`; the keyword/reference
distinction is carried by the `keyword` flag. The compiler therefore emits no
positional sort key.

Lemmas from a supplement file additionally carry `"isSupplement": true` at the
lemma level (omitted for core lemmas, so their JSON is byte-identical to a
single-file compile).

## Headword validation

`Compiler` can validate that headwords are alphabetically ordered and that each
starts with its chapter's leading letter. For a dictionary generated from a
correctly-ordered PDF, a violation marks a transcription/conversion artifact, so
these are QA warnings rather than fatal errors.

Validation is **opt-in per parser** via the `validateHeadwords` flag in
`parser-registry.ts`, and is **off** for both dictionaries during a normal
compile (`build`/`start`) so the output stays quiet. The two QA scripts
(`scripts/order-report.mjs`, `scripts/teeuw-order-report.mjs`) flip the flag on,
recompile, and slice the resulting warnings by letter and repair shape. The
order key ignores parenthesized fragments and keeps internal periods/slashes in
headword tokens so multi-word and abbreviated headwords sort the way the print
does.

`//` comment lines and out-of-order entries do not abort a compile; comments are
skipped and order violations only surface as warnings under the QA scripts.

## Testing

Uses **Vitest** (`vitest run`), run via `pnpm --filter compiler run test`.

Test files (in `src/__tests__/`):
- `helpers.test.ts` — `removeParenthesizedFragments()`
- `tokenizer.test.ts` — Tokenizer token sequences
- `parser.test.ts` — `TeeuwParser` extraction logic (incl. homonym numbering past II)
- `stevens-parser.test.ts` — `StevensParser` extraction logic
- `compiler.test.ts` — `Compiler` integration (multi-group compilation, homonym assignment, malformed-file handling, core+supplement merge with `isSupplement`, headword-order/leading-letter validation, `//` comment skipping)

## Known Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | ~~`mkdirp` listed in dependencies but never used~~ — resolved: removed from `package.json` | — |
| 2 | ~~`ts-node` listed in devDependencies but unused (tests use `tsx`)~~ — resolved: removed from `package.json` | — |
| 4 | ~~No tests for `Compiler` (integration tests)~~ — resolved: covered in `compiler.test.ts` | — |
| 5 | ~~`moduleResolution` commented out in `tsconfig.json`~~ — resolved: set to `nodenext` | — |
| 6 | `tsgo` build uses experimental TypeScript Go compiler (`@typescript/native-preview`) | Medium |
| 7 | Streaming JSON without validation — malformed output only caught downstream | Medium |
| 8 | ~~Partially-written JSON on parse errors (lenient error handling continues processing)~~ — resolved: failures now abort file processing and delete the malformed JSON | — |
| 9 | ~~Magic numbers: `CHAPTER_DISTANCE` (50,000), `ORDER_OFFSET` (2,000,000)~~ — resolved: the `order` field and its constants were removed; the client sorts by `homonym` and the `[lang, wordLower]` index | — |
