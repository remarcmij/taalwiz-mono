# Taalwiz Compiler

A standalone TypeScript utility that compiles bilingual dictionary source files (a custom Markdown format) into the structured JSON consumed by the Taalwiz web/mobile apps. It handles the Teeuw (Indonesian → Dutch) dictionary.

## More

- [INTERNALS.md](./INTERNALS.md) — source layout, input/output formats, and known issues
- [TEEUW_PARSER.md](./TEEUW_PARSER.md) — how the markdown compiles to JSON (base/keyword/homonym) and the `+` supplement file mechanism
- [TEEUW_SOURCE_FORMAT.md](./TEEUW_SOURCE_FORMAT.md) — how to read/write the source markup (authoring conventions, the `~` tilde and the `^` revert rule)
- [CLAUDE.md](../../CLAUDE.md) — development commands & conventions
