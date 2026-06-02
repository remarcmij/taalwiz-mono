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

## Attribution: the automatic `isSupplement` flag

Provenance is automatic, not editorial, so it cannot be forgotten:

- The compiler stamps `isSupplement: true` on every lemma sourced from a `+` file
  (omitted for core lemmas, keeping their JSON byte-identical).
- The flag flows through `CompiledLemma` -> `transformDict` (copied onto each
  word `DictRecord`) -> `ILemma`.
- The lemma component binds `[class.is-supplement]="lemma.isSupplement"` on the entry
  `div`. A CSS rule (`global.scss`) renders the defined Indonesian headwords
  inside a `is-supplement` entry in amber (`--supplement-text-color`, with a lighter
  dark mode value) **and underlines them**. The underline is a second, colour-
  independent cue for colour-blind readers; supplements are sparse, so the
  screen is not flooded with underlines.

This needs no markup converter change: the spans already exist (the converter
wraps asterisk-marked Indonesian words in `<span>`), so a descendant selector
from the container class recolours them.

The same amber (but **without** the underline) is applied to two other
surfaces, via an optional `isSupplement` flag on `WordLang`:

- the search **suggestion** list (`searchbar-dropdown`), and
- the **headword button** at the foot of each entry card.

Both are marked only when the word is **wholly new**: every sense / record for
that word is a supplement. A word that also exists in core Teeuw (e.g.
`aplikasi`, which has both the textile sense and the modern "app" sense) stays
the standard teal in these two surfaces, even though its new senses are amber in
the entry body. `findWordsStartingWith` computes this per word; `makeLookupResult`
computes it per base.

### Defined headwords only, not references

The rule is scoped to `.is-supplement strong span`, not all spans. The converter
wraps `**word**` keywords in `<strong>` and `*word*` references in `<em>`. A
supplement entry may **cite an existing core word**, e.g.
`**daring** (van *dalam jaringan*)`; colouring every span would wrongly paint
`dalam jaringan` as a new word. Scoping to `strong span` colours only what the
supplement actually introduces (the headwords), leaving citations and example
collocations in the standard teal.

### Why not the `Nw` editorial label?

An earlier plan reused Teeuw's "Hoofdletters" convention with a new `Nw`
(= nieuw) capital-letter label, typed by the linguist per entry. Rejected: it
relies on the editor remembering it, gives no colour affordance, and `N` is
already taken (Nederlands). The automatic flag supersedes it. A linguist may
still add origin labels (`P`, `J`, ...) as usual; they are independent of the
`isSupplement` mechanism.

## Re-import note

`isSupplement` is a new field on stored records, so existing installs only show the
colour after the dictionary is re-imported. That is triggered by bumping the
dict version string when the updated content is published.

## Touched files

- `apps/compiler/src/index.ts` (grouping)
- `apps/compiler/src/compiler/Compiler.ts` (multi-file merge, `isSupplement`,
  filename regex)
- `apps/web/src/app/home/dictionary/dict-db.ts` (`CompiledLemma`, `transformDict`)
- `apps/web/src/app/home/dictionary/lemma/lemma.model.ts` (`ILemma`)
- `apps/web/src/app/home/dictionary/lemma/lemma.component.html` (class binding)
- `apps/web/src/global.scss` (colour variable + underline rule)
- `apps/web/src/app/home/dictionary/word-lang.model.ts` (`isSupplement` flag)
- `apps/web/src/app/home/dictionary/dict-store.service.ts` (per-word `isSupplement`)
- `apps/web/src/app/home/dictionary/dictionary.service.ts` (per-base `isSupplement`)
- `apps/web/src/app/home/dictionary/searchbar-dropdown/` (suggestion amber)
- `apps/web/src/app/home/dictionary/dictionary.page.html` + `.scss` (button amber)
