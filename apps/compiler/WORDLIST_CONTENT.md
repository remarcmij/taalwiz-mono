# wordlist-content

Turn a flat word list into a sorted, deduplicated Markdown content file by looking
every word up against the compiled Teeuw dictionary. Useful for turning a list of
words collected while learning (Duolingo, a course book, flashcards) into a
ready-to-upload content article, with each word shown alongside its decomposition
and dictionary gloss.

The script lives at [`tools/wordlist-content.mts`](tools/wordlist-content.mts) and
is run with `tsx` (no build step).

## Usage

```bash
pnpm --filter compiler run wordlist [-w] <input.txt> [output.md]
```

- `<input.txt>` — the word list (required). Use an absolute path, or a path
  relative to the directory you run the command from.
- `[output.md]` — optional explicit output path.
- `-w` / `--write` — write the output next to the input file instead of stdout,
  reusing the input's base name (`duolingo.txt` → `duolingo.md`). If the input is
  itself a `.md` file, the output becomes `<base>.content.md` so the input is not
  clobbered.

With no output path and no `-w`, the content is written to stdout (redirect it
where you like). Diagnostics always go to stderr, so they stay out of a
redirected or `-w`-written file.

Examples:

```bash
# print to screen
pnpm -F compiler wordlist /path/to/anki/duolingo.txt

# write duolingo.md next to the input
pnpm -F compiler wordlist -w /path/to/anki/duolingo.txt

# explicit output path
pnpm -F compiler wordlist /path/to/in.txt /path/to/out.md
```

## Input format

One item per line, in the same `term;back` bulk-import format the app uses
(see [`import-line-parser.ts`](../web/src/app/home/vocabulary/vocabulary-entry-modal/import-line-parser.ts)).
The same parser is reused, so quoting rules match exactly.

| Line                                   | Meaning                                                   |
| -------------------------------------- | -------------------------------------------------------- |
| `bayar`                                | a single target-language word, to be looked up           |
| `kalian;jullie ...`                    | a term with an authored back (gloss)                     |
| `Tidurlah!;**Tidurlah**! Ga slapen!`   | a term with a fully authored back                        |
| `# 15-6-2026`                          | a comment, ignored                                       |
| (blank)                                | ignored                                                  |

A leading UTF-8 BOM is stripped. Duplicate terms (case-insensitive) are removed,
keeping the first occurrence.

## Output format

A YAML front-matter block followed by one content line per entry:

```markdown
---
title: duolingo
targetLang: id
---

**abad** 1 eeuw.

**adil** 1 rechtvaardig, eerlijk, onpartijdig.
**pengadilan** (peN- + **adil** + -an) 1 rechtbank, gerecht.
```

- **`title`** defaults to the input file name without its extension. **`targetLang`**
  is read from the dictionary JSON (so the file is upload-ready; the app rejects
  content without `targetLang: id`).
- Each generated line is `**term** (decomposition) <gloss>`:
  - **`**term**`** — the surface word, bold so it is tappable in the app.
  - **`(decomposition)`** — present only for a derived form (surface differs from
    its root). Produced by the real segmenter, e.g. `peN- + **adil** + -an`. The
    root morpheme is bold so it is tappable too; affixes stay plain.
  - **`<gloss>`** — the first matched lemma's dictionary text, with a trailing
    `;`/`,` trimmed and a leading bold headword stripped when it just repeats the
    term (so a bare root reads `**abad** 1 eeuw`, not `**abad** **abad**, 1 eeuw`).
- Lines are sorted alphabetically by resolved **root** (the dictionary's own
  ordering principle), so derived forms group under their root. A blank line
  separates each new root group.
- Every content line ends with two spaces (a Markdown hard break) so consecutive
  entries in the same group render on their own lines.
- Every content line ends in sentence punctuation; a period is appended when the
  line lacks a terminal `.`, `!`, or `?`.

### Authored backs

A line with a `;back` is used as the content line. If the back already shows the
word (e.g. `**Tidurlah**! Ga slapen!`), it is kept verbatim. If the back is a bare
gloss without the word (e.g. `lima;5` or `kalian;jullie ...`), the term is
prepended as a tappable bold prefix, so `lima;5` renders as `**lima** 5.` rather
than a headword-less `5.`.

## How it works (and why output matches the app)

The lookup mirrors the web app exactly. It reuses the *real* language code from
`apps/web` and the *real* compiled JSON in [`json/`](json/), the same approach as
[`lookup-trace.mts`](tools/lookup-trace.mts):

- [`IndonesianVariationGenerator`](../web/src/app/home/dictionary/indonesian-variation-generator.ts)
  over-generates candidate roots; the first that is a keyword headword wins
  (mirrors `DictionaryService.fetchWordLemmas`).
- [`segmentIndonesian`](../web/src/app/home/dictionary/indonesian-segmenter.ts)
  produces the decomposition against the resolved root (mirrors
  `StudyModal.flipCard`).
- The in-memory index mirrors `dict-db.ts`'s `transformDict` + `findByWordAndLang`.

Because the same code decides the resolution, the generated file shows the same
root and decomposition a user would see by tapping the word in the app. The
script imports `apps/web` source with `.ts`-extension specifiers that only the
`tsx` runtime resolves, so it lives outside `src/` and is excluded from the tsc
build. The editor picks up [`tools/tsconfig.json`](tools/tsconfig.json) for these
files. Node's own startup warnings are silenced via `NODE_OPTIONS=--no-warnings`
in the npm script.

## Diagnostics (stderr)

Two review lists are printed to stderr (never into the output file):

- **Did not resolve** — the variation generator found no dictionary hit. Almost
  always a typo or a post-1996 word not in Teeuw. These words are dropped from the
  output.
- **May be over-stripped** — the lookup landed on a short root, but a *longer*
  keyword headword also matched and the segmenter confirms it as a valid fuller
  analysis of the surface (e.g. `memasakan -> asa` while `masak` also derives the
  surface). This is the typical signature of a misspelling. The segmenter check
  deliberately ignores the generator's synthesised meN- forms, so confident bare
  roots (`jadi`) and clean derivations (`memalukan`) are *not* flagged.

A flagged word is still emitted with its (possibly wrong) resolution; the warning
is only a prompt to eyeball it. Wrong-but-resolving hits cannot be detected
automatically beyond this heuristic, so a quick review of derived forms is still
worthwhile.

## Limitations

- The lookup has no semantic knowledge: it returns the first morphologically
  plausible dictionary hit. A derived form that is not itself a headword can
  resolve to an unrelated shorter root (see the over-stripping diagnostic). The
  fix, per "Teeuw is the judge," is never to patch the generator but to correct
  the input or author an explicit `;back` for that line.
- DuoLingo and similar sources sometimes use words that are not in Teeuw; those
  show up as misses (or, if a related form exists, as a resolved root that is
  still useful).
