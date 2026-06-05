# Teeuw Parser

How the Teeuw dictionary markdown source (`dict/teeuw/*.md`) is compiled into the chapter
JSON (`json/teeuw.*.json`) the app loads. Two things live here:

- **Part 1** — how the parser derives each word's role from the markup: headword (`base`) vs
  `keyword`, and the `homonym` number.
- **Part 2** — how the optional `+` supplement files let linguists add post-1996 words
  without touching the digitized originals.

For the higher-level pipeline overview and the markup table, see [INTERNALS.md](./INTERNALS.md).

---

## Part 1 — Markdown to JSON: headwords, keywords, homonyms

The whole dictionary, and features built on it (e.g. the morphology aid, see
[../web/MORPHOLOGY_AID.md](../web/MORPHOLOGY_AID.md)), rest on the `base`/`keyword`
distinction. It is **not a manual annotation** and **not a parser heuristic** — it is a
mechanical encoding of Teeuw's own printed typography.

### 1.1 It mirrors the print's indentation

In the printed Teeuw, a headword sits at the **left margin**, and its derived run-on forms
are **indented beneath it**. For example, under the headword `indah`:

```
indah I, fraai, mooi, ...
    memperindah(kan), verfraaien enz;
    keindahan, schoonheid; ...
    pengindahan, verfraaiing;
    pengindah, sier(plant, enz);
```

`indah` is the headword (root); `memperindah`, `keindahan`, `pengindahan`, `pengindah` are
indented derived forms _under_ it. The markdown source encodes this indentation in a
parsable way: a **blank line** marks the return to the left margin, i.e. the start of a new
headword block. So the headword/derived distinction is Teeuw's editorial layout, preserved
mechanically — not something we inferred.

### 1.2 The algorithm (verified against the source)

- **Block = the lines between blank lines.** A blank line triggers the parser's `reset()`
  (`src/compiler/Compiler.ts`, the read loop; `TeeuwParser.ts` `reset()`), which saves the
  current base as `_prevBase` and clears `_base = null`.
- **The first `**bold**` word of a block becomes the `base` (headword).** It is set once per
  block, guarded by `if (!this._base) this.setBase(word)` (`TeeuwParser.ts`). The base then
  **persists for the entire block**.
- **Every later `**bold**` word in the same block becomes `keyword: 1` _under that same
  base_** — it does not start a new headword, because the `if (!_base)` guard is already
  false. This is the mechanism that makes a derived run-on form (`memukul`, `keindahan`) a
  keyword sharing its root's `base`.
- **The `keyword` flag** (`Compiler.ts`; `TeeuwParser.ts`): `**bold**` words before a `->`
  cross-reference arrow, plus the Dutch translation words, get `keyword: 1`; `*italic*`
  words, `**bold**` words _after_ a `->`, and the bare base-as-word get `keyword: 0`.
- **Homonym numbering** (`ParserBase.ts` `setBase()`): not a within-block marker. When the
  _same_ base reappears in a later block, `_homonym` increments (same headword, next sense);
  a different base resets it to 0. Roman numerals (`I`, `II`) in the source are just text.

Worked example, the `babak` block (one base, three keywords):

```
**babak** I, 1 bedrijf (toneelstuk, ed);   -> base "babak", keyword 1
2 fase, stadium;                           -> still base "babak"
**babakan**, periode, ...;                 -> base "babak", keyword 1 (NOT a new base)
**pembabakan**, indeling in bedrijven ...  -> base "babak", keyword 1
```

And two blocks of `bab` give `homonym` 0 then 1:

```
**bab** I, 1 hoofdstuk, ...    -> base "bab", homonym 0
                               (blank line: reset)
**bab** II A, poort, deur.     -> base "bab", homonym 1
```

---

## Part 2 — Supplement (`+`) files

> Status: implemented. See `feat/teeuw-supplement-files`.

### Goal

Let linguists extend the Teeuw dictionary with words that entered Indonesian
after Teeuw's last revision (1996) **without ever modifying the digitized
originals**. Teeuw's original work stays byte-for-byte untouched; the additions
live in separate files and are visually marked as modern additions.

### Source layout

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

### Compilation

`teeuw.a.md` and `teeuw.a+.md` compile into a **single** `teeuw.a.json`. The
asset layer and the Angular client are unchanged: still 26 `teeuw.{a-z}.json`
files, same loader, same IndexedDB schema, same lookup path.

- `index.ts` groups source files by output chapter (the basename with any
  trailing `+` stripped) and orders each group **core before supplement**.
- `Compiler` accepts the ordered list of files and streams them into one output,
  reusing a single parser instance so homonym numbering carries across the
  core -> supplement boundary.
- `TeeuwParser` is reused unchanged; it operates on content, not filenames.

#### Homonym numbering across the boundary

Homonyms are assigned by comparing each headword to the immediately preceding
group's base (`_prevBase` in `ParserBase`). Because the parser is shared and not
reset between files, a brand-new supplement headword gets `homonym: 0`, and a
supplement entry that repeats the **last** core headword continues as the next
homonym index. The one unsupported case is a supplement adding a new sense of an
existing word that is **not** the last core entry: it would restart at 0 rather
than continuing. New headwords (the common case) are unaffected. If continuing
arbitrary existing headwords ever becomes a real need, it requires switching
homonym tracking from `_prevBase` to a global base -> count map.

### Attribution: the automatic `isSupplement` flag

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

#### Defined headwords only, not references

The rule is scoped to `.is-supplement strong span`, not all spans. The converter
wraps `**word**` keywords in `<strong>` and `*word*` references in `<em>`. A
supplement entry may **cite an existing core word**, e.g.
`**daring** (van *dalam jaringan*)`; colouring every span would wrongly paint
`dalam jaringan` as a new word. Scoping to `strong span` colours only what the
supplement actually introduces (the headwords), leaving citations and example
collocations in the standard teal.

#### Why not the `Nw` editorial label?

An earlier plan reused Teeuw's "Hoofdletters" convention with a new `Nw`
(= nieuw) capital-letter label, typed by the linguist per entry. Rejected: it
relies on the editor remembering it, gives no colour affordance, and `N` is
already taken (Nederlands). The automatic flag supersedes it. A linguist may
still add origin labels (`P`, `J`, ...) as usual; they are independent of the
`isSupplement` mechanism.

### Re-import note

`isSupplement` is a new field on stored records, so existing installs only show the
colour after the dictionary is re-imported. That is triggered by bumping the
dict version string when the updated content is published.

### Touched files

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
