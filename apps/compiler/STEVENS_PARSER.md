# Stevens Parser

How the Stevens Indonesian->English dictionary markdown source
(`dict/stevens/*.md`) is compiled into chapter JSON (`json/stevens/stevens.*.json`). The
parser (`src/compiler/StevensParser.ts`) is a sibling of the Teeuw parser: it
inherits the same block / `base` / `keyword` / `homonym` model and the
parenthesis double-pass from `ParserBase`, so read [TEEUW_PARSER.md](./TEEUW_PARSER.md)
first. This file documents only where Stevens differs.

The dictionary is selected by filename prefix in
[`src/compiler/parser-registry.ts`](src/compiler/parser-registry.ts); the rest of
the pipeline (`index.ts`, `Compiler`) is shared and unchanged.

## Format differences from Teeuw

| Concern | Teeuw | Stevens |
| --- | --- | --- |
| Gloss language | Dutch (`nl`) | English (`en`) |
| Headword placeholder | — | `^` resolves to the block's base |
| Nearest-keyword placeholder | `~` | `~` (same as Teeuw) |
| Sense numbers | bare `1`, `2` … | `__1__`, `__2__` (and Roman `__I__`) |
| Multiple headwords | block-implicit | explicit `**X** and **Y**` |
| Optional reference | `(*word*)` | `*(word)*` (normalized to Teeuw's form) |

### 1. English glosses

`super('id', 'en')`: the source language stays Indonesian, the target (gloss)
language is English. Reverse-lookup harvesting (TEEUW_PARSER.md Part 3) uses the
English filter lists `EDITORIAL_MARKERS_EN`, `COMMON_WORDS_EN`, and the hard
`IGNORED_WORDS_EN` (connectors like `and`/`or` that bridge two headwords and must
never be indexed as a one-word gloss). All three are hand-tunable knobs, like
their `*_NL` counterparts. Most Stevens editorial markers are `_italic_`- or
`__bold__`-wrapped and so are dropped by the tokenizer before they reach these
lists.

### 2. `^` headword placeholder

Stevens writes a run-on example as `*^ Tang*` where `^` stands for the headword.
The parser resolves `^` to the block's `base`: it is indexed as a reference word
during extraction (`parseStarFragment`), and substituted into the rendered line.
`^` is a new `Token.Caret` in the shared tokenizer; it never reaches the
tokenizer in Teeuw (where `^` is a line-level tilde-revert marker the Compiler
intercepts), so the addition is inert for Teeuw.

### 3. `__N__` sense numbers and continuation lines

Sense numbers are `__N__` (e.g. `__1__`, `__2__`, Roman `__II__`), which the
`__`-skip already drops from indexing. A line that *opens* with `__N__` is a new
sense of the nearest keyword; the parser re-asserts that keyword (`**tildeWord**,
…`) exactly as Teeuw does for a line opening with a bare digit.

### 4. Multiple headwords: `**X** and **Y**`

`**a** and **A**` registers both `a` and `A` as keywords under one base (the
first, `a`). This falls out of the inherited block rule (first bold sets the
base, later bolds are keywords). The bridging `and` is hard-ignored so it is not
mistaken for a one-word English gloss.

### 5. `_**word**_` italicized keywords

A derived keyword an editor wrapped in italics, `_**ketidak-abadian**_`, would be
swallowed whole by the `_..._` skip. The parser strips the outer underscores so
the bold keyword is tokenized and indexed.

### 6. Optional-reference normalization (`*(word)*` -> `(*word*)`)

Stevens marks a whole-span-optional reference as `*(word)*` (parens **inside** the
emphasis). In the second parenthesis pass the parens are removed, leaving the two
delimiters adjacent as a dangling `**`/`*` that corrupts the rest of the line.
The parser rewrites it to Teeuw's `(*word*)` form (parens **outside**), which
renders identically and is dropped cleanly as one unit. Empty emphasis spans and
word-less ones (`*5*`, `*?*`, `*...*`) are likewise tolerated as no-ops.

### 7. `_opp_` / `_cp_` reference markers

Stevens introduces a cross-reference three ways: the `→` arrow (shared with
Teeuw) and the italic markers `_opp_` (opposite) and `_cp_` (compare), e.g.
`**abad**, … eternity; _opp_ **AJAL**.`. All three mean "the bold word that
follows points at another keyword", so that word must be indexed as a
**reference** (`referenceWords`, `keyword: 0`), not as a source keyword of the
current entry.

The arrow does this by setting an `arrowSeen` latch that routes the next
`**…**` into `referenceWords`. The italic markers are otherwise invisible (an
`_…_` span is skipped during extraction), so `extractWords` reads the span text
and latches the same flag when it is exactly `opp` or `cp` — any other italic
marker (`_naut_`, `_A_`, …) is skipped as before. Without this, the referenced
word was wrongly registered as an additional headword of the current lemma,
polluting the lemma index (e.g. `abad` falsely claiming to be a headword for
`ajal`). A homonym self-reference like `**ASU** II … _cp_ **ASU** I` is
unaffected: there the referenced word *is* the headword, so it stays a keyword.

Note the markers attach the *closing* parenthesis of a parenthetical outside the
bold span: `(… ; _cp_ **BARU**)`. A `)` typed inside the span (`**BARU)**`)
collapses the bold delimiter in the parenthesis pass and aborts the chapter with
`unterminated "**" fragment` (see Source quality).

## Source quality

Stevens source is still being cleaned, so some blocks are genuinely malformed
(most often a `(` placed inside a `**…**` span, or a front-matter note with no
headword). The Compiler aborts a chapter on the first such block, so those must
be fixed in the source. Run the audit in `STEVENS_ERRORS.md` (regenerate with the
audit script) to list them with file:line.
