# Teeuw Supplement (`+` files) — Design Note

> Status: proposal, not yet implemented. Captured for future consideration.

## Goal

Let linguists extend the Teeuw dictionary with words that entered Indonesian
after Teeuw's last revision (1996) **without ever modifying the digitized
originals**. Teeuw's original work stays byte-for-byte untouched; the additions
live in separate files.

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

A linguist only ever creates and edits the `+` files. The core files are
read-only as far as this feature is concerned.

## Compilation

`teeuw.a.md` and `teeuw.a+.md` compile into a **single** `teeuw.a.json`. The
asset layer and the Angular client are unchanged: still 26 `teeuw.{a-z}.json`
files, same loader, same IndexedDB schema, same lookup path. The supplement is
invisible to everything downstream of the compiler.

The same `TeeuwParser` is reused as-is; it operates on content, not filenames.

## Attribution: the `Nw` label

Teeuw already marks entries with capital-letter origin codes (the "Hoofdletters"
legend), e.g. `P` = Populair, `J` = Jakartaans, `N` = Nederlands. Post-1996
additions reuse this same convention with a new code:

```
Nw   (na 1996) nieuw
```

`Nw` was chosen because:

- It follows Teeuw's own two-letter style (`Jp`, `Jv`, `Ml`).
- It mirrors the Dutch-expansion convention (`N` = Nederlands, `O` = Ouder
  Maleis, etc.); `Nw` = nieuw.
- `N` (Nederlands) and the single capital `X` are both already taken; `X` in
  particular is the Roman numeral 10 used for sense numbering.

This means attribution costs **no schema change and no badge logic**: the marker
lives in the entry text exactly the way Teeuw's own labels do, and it renders in
the dictionary's own visual language. A reader sees the `Nw` label and knows the
word is a modern addition, not part of Teeuw's original work.

## Scope

Supplement entries are **structurally identical** to regular entries. They may
introduce brand-new headwords or new senses of existing headwords; there is no
special field or code path distinguishing them. The only thing that sets them
apart is the editorial `Nw` label.

## Implementation checklist (for when this is built)

1. **`index.ts`**: change the file -> output mapping from 1:1 to "group by
   output stem." Derive the JSON name from the letter (strip the `+`), group the
   core and supplement inputs under it, ordered **core before supplement**.
2. **`Compiler.run()`**: accept the ordered list of input files and stream them
   into one output. Flush the pending lemma group at each file boundary, but
   **carry the parser's homonym state across the boundary** so a supplemented
   sense of an existing headword continues numbering correctly (core entries
   first, then the supplement's next homonym index).
3. **Filename regex**: today's `([a-z])` letter group does not match `a+`; widen
   it to recognize the `+` variant.
4. **`filter_data.ts`**: add `Nw` to `ABBREVIATIONS_NL` so it is filtered out of
   keyword extraction exactly like `P`/`J`/`N` (otherwise the marker itself
   becomes a searchable Dutch "word").
5. **Hoofdletters legend**: document `Nw` where Teeuw's own codes are listed.
6. **Verify**: confirm the `Nw` label survives into the displayed `text` rather
   than being stripped.

## Why this is now a small change

The `order` field (and its `CHAPTER_DISTANCE` / `ORDER_OFFSET` math) was removed
from the compiler in a prior refactor. That eliminated the one thing that would
have complicated merging two source files into one JSON (there is no longer any
positional sort key to continue or offset across the file boundary). Lookups are
resolved client-side by the `[lang, wordLower]` index and ordered for display by
`homonym`.

## Alternative considered

A single capital letter such as `B` (= baru, Indonesian for "new") instead of
`Nw`. Rejected in favour of `Nw` for consistency with Teeuw's Dutch-expansion,
two-letter style.
