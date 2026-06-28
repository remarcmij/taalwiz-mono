# Taalwiz Compiler

A standalone TypeScript utility that compiles bilingual dictionary source files (a custom Markdown format) into the structured JSON consumed by the Taalwiz web/mobile apps. A parser is chosen per source file by its filename prefix (`src/compiler/parser-registry.ts`):

- **Teeuw** — Indonesian → Dutch (`dict/teeuw/*.md`)
- **Stevens** — Indonesian → English (`dict/stevens/*.md`)

## Source location

The compiler compiles straight from the git-tracked canonical source in the sibling `taalwiz-content` repo (`../taalwiz-content/dict/{teeuw,stevens}`) when that repo is checked out alongside this one; otherwise it falls back to this package's local `dict/` copies. Set `DICT_DIR` (a dict root containing `teeuw/` and/or `stevens/`) to override. See `src/index.ts`.

## Scripts

```bash
pnpm --filter compiler run build               # tsc build
pnpm --filter compiler run start               # compile the dictionaries → json/
pnpm --filter compiler run test                # Vitest
pnpm --filter compiler run order-report        # QA: Stevens headword order/letter warnings
pnpm --filter compiler run teeuw-order-report  # QA: Teeuw headword order/letter warnings
pnpm --filter compiler run trace               # lookup-trace tool
```

A normal compile (`build`/`start`) does **not** emit headword order/leading-letter warnings; the two `*-order-report` scripts flip that validation on and slice the warnings (see [INTERNALS.md](./INTERNALS.md), "Headword validation").

## More

- [INTERNALS.md](./INTERNALS.md) — source layout, input/output formats, headword validation, and known issues
- [TEEUW_PARSER.md](./TEEUW_PARSER.md) — how the Teeuw markdown compiles to JSON (base/keyword/homonym) and the `+` supplement file mechanism
- [TEEUW_SOURCE_FORMAT.md](./TEEUW_SOURCE_FORMAT.md) — how to read/write the Teeuw source markup (authoring conventions, the `~` tilde and the `^` revert rule)
- [STEVENS_PARSER.md](./STEVENS_PARSER.md) — the Stevens (Indonesian → English) parser
- [CLAUDE.md](../../CLAUDE.md) — development commands & conventions
