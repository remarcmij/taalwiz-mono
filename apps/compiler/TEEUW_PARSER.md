# Teeuw Parser

How the Teeuw dictionary markdown source (`dict/teeuw/*.md`) is compiled into the chapter
JSON (`json/teeuw.*.json`) the app loads. Three things live here:

- **Part 1** — how the parser derives each word's role from the markup: headword (`base`) vs
  `keyword`, and the `homonym` number.
- **Part 2** — how the optional `+` supplement files let linguists add post-1996 words
  without touching the digitized originals.
- **Part 3** — the translation-side companion to Part 1: how the **Dutch** words are pulled
  out of the glosses and indexed, turning Teeuw's one-way Indonesian->Dutch dictionary into
  a best-effort Dutch->Indonesian reverse lookup.

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

### 1.3 The parenthesis double-pass

The mechanism is simple: **the parser reads each line twice** and unions the words it finds
(`ParserBase.parseLine`, [src/compiler/ParserBase.ts](src/compiler/ParserBase.ts)):

1. **with the parenthesis characters removed** (`line.replace(/[()]/g, '')`) — content kept;
2. **with the parenthesized fragments removed** (`removeParenthesizedFragments`) — content
   dropped.

Everything below follows from that one rule.

Its main job is **optional word-parts**, and not only trailing suffixes — pass 1 gives the long
form, pass 2 the short form, and a search for either reaches the entry:

- a **suffix**: `mengabolisi(kan)` -> `mengabolisikan` / `mengabolisi`;
- a **medial insertion or reduplication**: `beragah(-agah)an` -> `beragah-agahan` /
  `beragahan`;
- on the **Dutch** side, an optional continuation of a gloss: `uitdagen(d aankijken)` ->
  `uitdagend aankijken` / `uitdagen`.

This holds for bold keywords and italic references alike — e.g. `**mengabolisi(kan)**` yields
`sourceKeywords = { mengabolisi, mengabolisikan }`, and `**agah, beragah(-agah)an**` yields
`{ agah, beragahan, beragah-agahan }` (both covered in `parser.test.ts`).

Parentheses have a **second, unrelated** use: a **descriptive aside** in the Dutch gloss
(`potje (voor het opbergen van opium)`), whose content is meant to be read, not searched. The
parser does **not** distinguish the two uses — both fall out of the same two passes — and it
gets away with it *almost* always, because asides are usually multi-word and so fail the
single-word test (§3.3). The lone exception is an aside containing a comma:

```
*mengadudomba(kan)*, *memperadudombakan*, (mensen, groepen ed) tegen elkaar uitspelen;
```

In pass 1 the aside becomes `mensen, groepen ed`, leaving `mensen` alone before a comma, which
Rule 1 then indexes. So a comma inside an aside leaks its first word into the reverse index. It
is harmless (a loose Dutch-side reverse hit, never a wrong Indonesian mapping), and **left in
place on purpose**: a clean fix is deceptively hard. Parentheses are not reliably classifiable
from the raw line — the same notation appears glued as an optional word-part (`domba(kan)`),
chained (`mengadang(adang)(i)`), and *inside* an Indonesian markup span where the content is a
reference, not an aside (`*(proses) belajar mengajar*`, `*nafsu (al) ammarah*`,
`*(ber)campur gaul*`). Suppressing the leak without markup-context awareness corrupts Indonesian
indexing (it drops `proses`, `al`, `ber`, and breaks chained affixes like `mengadangadangi`), so
the harmless leak is the cheaper trade.

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

---

## Part 3 — Indexing the Dutch words (the reverse lookup)

Teeuw is a **one-way** dictionary: every entry is an Indonesian headword glossed in Dutch.
Part 1 covered the Indonesian side (`base`/`keyword`). This part covers the other side: the
**Dutch translation words** are also harvested and indexed, so a Dutch search term can find
the Indonesian entry it translates. That makes the compiled JSON a **poor man's reverse
dictionary** (Dutch->Indonesian), something a printed edition could never offer. It is
"best effort": the goal is high-precision single-word equivalents, not exhaustive recall.

### 3.1 What counts as a Dutch word

The Indonesian words are the **marked-up** tokens (`**bold**` keywords, `*italic*` run-ons,
see Part 1). The Dutch words are everything left over: the **plain, unmarked** `Token.Word`
tokens. `extractWords` accumulates them into a `pendingWords` buffer
([src/compiler/TeeuwParser.ts](src/compiler/TeeuwParser.ts) `case Token.Word`), while the
`**`/`*` fragments are routed to the Indonesian sets and bracketed/italic asides are skipped.

Every Dutch entry that survives the filter below lands in `result.targetWords` and is
emitted as a word with `lang: 'nl'`, `keyword: 1`
([src/compiler/Compiler.ts](src/compiler/Compiler.ts) `buildLemma`, the `targetWords`
loop). The language tags come from the parser constructor, `super('id', 'nl')`. Note the
`keyword` flag is a **constant `1`** for every Dutch entry: unlike the Indonesian side (which
splits into primary `sourceKeywords` and secondary `referenceWords`), Dutch words are only
ever indexed as translations or not at all.

### 3.2 The unit: a comma/semicolon fragment

A Dutch gloss is a list of meanings (separated by `;`) of synonyms (separated by `,`). The
parser does **not** distinguish the two: it flushes the `pendingWords` buffer on **every comma
and every semicolon alike** (`case Token.Comma: case Token.Semicolon:`), and once more at
end of line. So the unit the algorithm reasons about is a single **fragment** = one
comma-or-semicolon-delimited run of plain words, i.e. one synonym. Each fragment is judged
independently by `selectTargetWord`.

### 3.3 The rules (`selectTargetWord`, verified against the source)

```ts
selectTargetWord(fragmentWords: string[], wordSet: Set<string>) {
  let filtered = fragmentWords.filter((word) => !EDITORIAL_MARKERS_NL.has(word));
  if (filtered.length == 1) {
    wordSet.add(filtered[0]);
  } else {
    filtered = filtered.filter((word) => !COMMON_WORDS_NL.has(word));
    if (filtered.length === 1) {
      wordSet.add(filtered[0]);
    }
  }
}
```

**Rule 1 — a word standing alone in a fragment is the translation.** After dropping
abbreviations, if exactly one word remains, index it. The intuition: if Teeuw gives a
one-word Dutch synonym, it is very likely a clean 1:1 equivalent of the Indonesian headword,
which is exactly the kind of term a reverse search should hit.

**A deliberate consequence (looks like a bug, isn't):** Rule 1 fires **even when that lone
word is on the common-word list**. The common-word list (`COMMON_WORDS_NL`) is consulted *only*
in the multi-word branch below. So a fragment that is just `in` is indexed as a Dutch
keyword, while the same `in` buried inside `in plaats van` is stripped as glue. Same word,
opposite treatment, both correct: alone it is the translation; in a phrase it is connective
tissue. Do not "fix" this by filtering stopwords up front; it would discard valid
single-word glosses.

**Rule 2 — a word that survives a multi-word fragment is the translation.** If more than one
word remains after the abbreviation pass, also drop the common words; if **exactly one**
content word now remains, index it. Otherwise (zero, or two or more remain) **discard the
whole fragment**. This rescues fragments like `de tang` (-> `tang`) or `I eeuw` (-> `eeuw`)
while throwing away genuine phrases and descriptive paraphrases.

The two filter lists ([src/compiler/filter_data.ts](src/compiler/filter_data.ts)):

- `EDITORIAL_MARKERS_NL` — Teeuw's editorial apparatus: origin codes (`N` Nederlands, `A`
  Arabisch, `E` Engels, ...), grammatical abbreviations (`enz`, `ed`, `bv`, `mv`, ...), and
  the Roman numerals `I`-`X` used for sense numbering. (Its old name, `ABBREVIATIONS_NL`,
  undersold the numerals and origin codes, which is why it was renamed.)
- `COMMON_WORDS_NL` — a deliberately **small** Dutch common-word list (`de`, `het`, `een`, `zich`,
  `zijn`, `in`, `hebben`, `elkaar`, `iets`, `iemand`, `er`). Many candidates (`van`, `met`,
  `op`, `voor`, ...) are intentionally **commented out**: they were found to be meaningful as
  standalone glosses or to wrongly salvage paraphrases into fake one-word hits. Both lists are
  hand-tuned knobs; expect to revise them, not the algorithm, when results look off.

Storage is a `Set`, so duplicates within an entry collapse; case is preserved (no
lowercasing at compile time, so case-insensitive matching is the search layer's job).

### 3.4 Parentheses: the double pass

Dutch glosses carry parenthetical asides (`verfraaien (enz)`, `busje, potje (voor het
opbergen van opium)`). These are handled by the **same** double-pass documented in §1.3: pass 2
removes the aside, and pass 1's multi-word remainder fails the single-word test (§3.3), so
`potje (voor het opbergen van opium)` indexes only `potje`. The one caveat from §1.3 applies —
a comma *inside* an aside exposes its first word in pass 1, which Rule 1 then indexes (the
harmless `mensen` leak, left in place because suppressing it without markup-context awareness
would corrupt Indonesian indexing).

### 3.5 Worked example

```
**ab** I, sv busje, potje (voor het opbergen van opium).
```

- `ab` -> Indonesian `base`/keyword (Part 1); not a Dutch word.
- `I` -> fragment `[I]`; `I` is an abbreviation -> 0 remain -> **discarded**.
- `sv busje` -> `sv` is an abbreviation -> `busje` alone -> **indexed** (Rule 1).
- `potje (...)` -> first pass `potje voor het opbergen van opium`: nothing is an
  abbreviation, so Rule 2 applies; dropping common words still leaves five content words ->
  **discarded**. Second pass (paren fragment removed) `potje`: alone -> **indexed**.

Result: `targetWords = { busje, potje }`, exactly the `parser.test.ts` expectation. And in
`gouden eeuw, bloeitijd, hoogtepunt`, the two single-word synonyms are indexed while
`gouden eeuw` (two content words) is dropped.

### 3.6 Why single-word only (a considered, rejected alternative)

Multi-word Dutch glosses (`gouden eeuw`, `hoge raad`) are deliberately **not** indexed. We
weighed adding them and rejected it:

- **Searching the phrase has little value.** A learner doing reverse lookup overwhelmingly
  types a single Dutch word; almost nobody searches `gouden eeuw`, even though prefix search
  *would* surface it as a suggestion if they did.
- **The only real gain is reachability** of a content word that appears *exclusively* inside
  multi-word fragments and never once as a standalone gloss anywhere in the dictionary. Across
  tens of thousands of entries that set is small, and skewed toward generic heads (`raad`,
  `eeuw`) where the reverse mapping would be semantically loose anyway.
- **Both storage options are lossy.** Indexing each word (`gouden` + `eeuw`) floods results
  via the common modifier; indexing only the grammatical head (`eeuw`) relocates the noise
  into a generic head that mismatches the specific phrase. A single space-joined phrase key
  (`"gouden eeuw"`, which the index already supports via the Indonesian `+`->space
  convention) avoids both but is, per the first bullet, rarely searched.

Small recall gain, real noise cost, and it would muddy the clean Rule 1 / Rule 2 story. So the
single-content-word rule is a deliberate **precision-over-recall** choice, not a limitation to
apologize for. (Detecting a genuine collocation, if this were ever revisited, should gate on
the **raw** fragment length being ~2 with no interior function word, **not** on the post-filter
count, which would let a stripped paraphrase masquerade as a phrase.)
