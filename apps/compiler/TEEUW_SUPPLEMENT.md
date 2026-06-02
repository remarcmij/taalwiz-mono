# Teeuw Supplement (`+` files)

> Status: implemented. See `feat/teeuw-supplement-files`.

## Goal

Let linguists extend the Teeuw dictionary with words that entered Indonesian
after Teeuw's last revision (1996) **without ever modifying the digitized
originals**. Teeuw's original work stays byte-for-byte untouched; the additions
live in separate files and are visually marked as modern additions.

## Source layout

One supplement file per letter, mirroring the core set:

```
dict/teeuw/
  teeuw.a.md    ← core (original Teeuw, never edited)
  teeuw.a+.md   ← supplement (post-1996 additions)
  teeuw.b.md
  teeuw.b+.md
  ...
```

A linguist only ever creates and edits the `+` files, in the ordinary Teeuw
markup. No special per-entry annotation is required (see "Attribution" below).
The core files are read-only as far as this feature is concerned.

> Note: `dict/` is gitignored (it holds the copyrighted Teeuw content), so the
> demo `teeuw.a+.md` shipped for the Arps walkthrough lives on disk only. Use
> `git add -f` if you ever want to track a specific supplement file.

## Compilation

`teeuw.a.md` and `teeuw.a+.md` compile into a **single** `teeuw.a.json`. The
asset layer and the Angular client are unchanged: still 26 `teeuw.{a-z}.json`
files, same loader, same IndexedDB schema, same lookup path.

- `index.ts` groups source files by output chapter (the basename with any
  trailing `+` stripped) and orders each group **core before supplement**.
- `Compiler` accepts the ordered list of files and streams them into one output,
  reusing a single parser instance so homonym numbering carries across the
  core -> supplement boundary.
- `TeeuwParser` is reused unchanged; it operates on content, not filenames.

### Homonym numbering across the boundary

Homonyms are assigned by comparing each headword to the immediately preceding
group's base (`_prevBase` in `ParserBase`). Because the parser is shared and not
reset between files, a brand-new supplement headword gets `homonym: 0`, and a
supplement entry that repeats the **last** core headword continues as the next
homonym index. The one unsupported case is a supplement adding a new sense of an
existing word that is **not** the last core entry: it would restart at 0 rather
than continuing. New headwords (the common case) are unaffected. If continuing
arbitrary existing headwords ever becomes a real need, it requires switching
homonym tracking from `_prevBase` to a global base -> count map.

## Attribution: the automatic `teeuwPlus` flag

Provenance is automatic, not editorial, so it cannot be forgotten:

- The compiler stamps `teeuwPlus: true` on every lemma sourced from a `+` file
  (omitted for core lemmas, keeping their JSON byte-identical).
- The flag flows through `CompiledLemma` -> `transformDict` (copied onto each
  word `DictRecord`) -> `ILemma`.
- The lemma component binds `[class.teeuw-plus]="lemma.teeuwPlus"` on the entry
  `div`. A CSS rule (`global.scss`) renders the Indonesian word spans inside a
  `teeuw-plus` entry in amber (`--teeuw-plus-text-color`, with a lighter dark
  mode value) **and underlines them**. The underline is a second, colour-
  independent cue for colour-blind readers; supplements are sparse, so the
  screen is not flooded with underlines.

This needs no markup converter change: the spans already exist (the converter
wraps asterisk-marked Indonesian words in `<span>`), so a descendant selector
from the container class recolours exactly the Indonesian words.

### Why not the `Nw` editorial label?

An earlier plan reused Teeuw's "Hoofdletters" convention with a new `Nw`
(= nieuw) capital-letter label, typed by the linguist per entry. Rejected: it
relies on the editor remembering it, gives no colour affordance, and `N` is
already taken (Nederlands). The automatic flag supersedes it. A linguist may
still add origin labels (`P`, `J`, ...) as usual; they are independent of the
`teeuwPlus` mechanism.

## Re-import note

`teeuwPlus` is a new field on stored records, so existing installs only show the
colour after the dictionary is re-imported. That is triggered by bumping the
dict version string when the updated content is published.

## Touched files

- `apps/compiler/src/index.ts` (grouping)
- `apps/compiler/src/compiler/Compiler.ts` (multi-file merge, `teeuwPlus`,
  filename regex)
- `apps/web/src/app/home/dictionary/dict-db.ts` (`CompiledLemma`, `transformDict`)
- `apps/web/src/app/home/dictionary/lemma/lemma.model.ts` (`ILemma`)
- `apps/web/src/app/home/dictionary/lemma/lemma.component.html` (class binding)
- `apps/web/src/global.scss` (colour variable + underline rule)
