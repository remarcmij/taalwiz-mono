# When the same bug appears twice: duplicated knowledge and the single source of truth

_2026-06-08. Context: a bug in the Indonesian dictionary's affix handling that turned out to live in two files at once, and the refactor that followed._

This note is written for learning, not as project docs. It captures both the
software-engineering reasoning and the vocabulary that came up, so the concepts
stick.

---

## 1. The story

The word-tap modal in the dictionary shows a **decomposition line** like
`meN- + sapu + -kan`, breaking a word into its prefix(es), root, and suffix(es).
Separately, the dictionary **lookup** has to find the root of whatever the user
tapped, so it can pull the right entry.

We found a bug: tapping `mengumpulkan` ("to collect/gather") did not resolve to
its root `kumpul`, and showed no decomposition line. The root cause was a single
inverted condition in the code that undoes Indonesian prefix assimilation (more
on the linguistics in §3).

We fixed it. Then Jim noticed something important: **the same bug existed in two
places** — once in the lookup code, once in the decomposition code. That "fix it
twice" feeling is a signal. It usually means the same knowledge has been written
down in more than one place, and the copies can disagree (or, worse, agree while
both being wrong).

That signal is what this note is about.

---

## 2. The vocabulary (the part Jim asked to keep)

These are general terms, useful far beyond this codebase.

- **Surface form → derivation (or "surface → root").** "Surface" is the word as
  it actually appears (`menyapu`). The "derivation" or "underlying form" is the
  structure behind it (`meN-` + `sapu`). Saying a function goes "surface → root"
  names its _direction_: it takes the visible form and recovers the structure. The
  opposite direction ("root → surface") builds the visible form from the
  structure. Naming the direction is a precise way to talk about a transform
  without spelling out the algorithm. The arrow notation (`A → B`) is common
  shorthand in linguistics, compilers, and type theory.

- **Load-bearing.** Borrowed from architecture: a load-bearing wall is one the
  building actually rests on; remove it and things fall. In code, a detail is
  "load-bearing" when behaviour genuinely depends on it (versus incidental detail
  you could change freely). Here, the duplication was load-bearing in the bad
  sense: it was actively holding up a whole _class_ of bug. (You'll also hear
  "load-bearing comment" — a comment that, if ignored, leads to breakage — and
  jokingly "load-bearing `else`".)

- **Code smell.** A surface symptom that _suggests_ a deeper design problem
  without proving one. "Fix the same thing in two files" is the classic smell for
  **duplicated knowledge**. A smell is a prompt to investigate, not an automatic
  verdict — sometimes the duplication is fine.

- **DRY / Single Source of Truth (SSOT).** "Don't Repeat Yourself." The sharper
  framing (from _The Pragmatic Programmer_) is: every piece of _knowledge_ should
  have one authoritative representation. Note it's about knowledge, not text —
  two functions that happen to contain similar lines but encode _different_ facts
  are not a DRY violation, and forcing them together is a mistake (see §6).

- **Allomorph / archiphoneme** (the linguistics, for completeness). A morpheme is
  a unit of meaning (the prefix "meN-"). An **allomorph** is one of its surface
  shapes (`meng-`, `meny-`, `mem-`, `men-`, `me-`). The capital `N` in `meN-` is
  an **archiphoneme**: a placeholder for "whichever nasal sound this becomes,"
  written once to stand for the whole family.

- **Consistency vs. correctness.** Two things being _consistent_ means they agree
  with each other. _Correct_ means they agree with reality. They are not the same
  — and conflating them is the heart of §5.

---

## 3. The actual linguistics (why the bug was subtle)

Indonesian's `meN-`/`peN-` prefixes **assimilate** to the first sound of the root
and often **elide** (drop) it. The surface word then no longer visibly contains
its own root:

| root | + prefix | surface | what happened |
|---|---|---|---|
| `sapu` | meN- | `menyapu` | s → ny, root's `s` dropped |
| `potong` | meN- | `memotong` | p → m, root's `p` dropped |
| `tulis` | meN- | `menulis` | t → n, root's `t` dropped |
| `kumpul` | meN- | `mengumpul` | k → ng, root's `k` dropped |

To go **surface → root**, you strip the prefix and _restore_ the dropped
consonant. The bug: the code restored `k` only when the leftover started with a
**consonant** (`mengritik` → `kritik`, leftover `ritik`), but the `k`-elision
case actually produces a **vowel**-initial leftover (`mengumpul` → leftover
`umpul` → restore → `kumpul`). The guard was inverted: it excluded exactly the
case it needed to handle. The fix was to restore `k` for anything _except_ a
leftover starting with `g`/`h` (the two genuinely non-eliding `meng-` forms,
`menggali` → `gali`, `menghitung` → `hitung`).

The linguistics isn't the lesson here; it's just why a careful person could get
the condition backwards and not notice.

---

## 4. Where the knowledge lived (the duplication, mapped)

The same allomorphy facts were hand-written in **three** spots:

| Location | Direction | Form |
|---|---|---|
| `stripMeN` / `stripPeN` (variation generator) | surface → root | two near-identical methods |
| `nasalCandidates` (segmenter) | surface → root | one parameterised function, richer return |
| `prefixWithMeng` (variation generator) | root → surface | keyed by the root's first letter |

The first two are _the same fact in the same direction_, just shaped slightly
differently for two callers. That is the real duplication. The third is the same
fact in the _opposite_ direction.

---

## 5. The sharpest lesson: a "consistency test" can't catch a shared bug

The codebase even had a test whose stated job was to stop the two copies from
**drifting** apart — an "anti-drift" / cross-check test. It looked responsible.
But it gave **false confidence**, for two compounding reasons:

1. It checked that the two implementations _agreed_ on a handful of examples. When
   both copies carried the **same** inverted guard, they agreed perfectly — both
   wrong, both green. A test for _consistency_ structurally cannot detect an error
   that has been copied into both sides. (This is the consistency-vs-correctness
   distinction from §2, made concrete.)

2. The failing example (`mengumpulkan` → `kumpul`) wasn't even in its example
   list — so it had no chance regardless.

The takeaway is general and worth internalising:

> A test that two copies _match each other_ is only as good as your assumption
> that at least one copy is right. If the knowledge has one source instead of two,
> a single _correctness_ test (does it match reality?) covers it, and the whole
> category of "they drifted / they share a bug" disappears.

The existence of an anti-drift test is itself a code smell: it's effort spent
compensating for duplication instead of removing it.

---

## 6. The refactor — and, just as important, what we did _not_ do

**Did:** extracted the surface → root facts into one declarative table,
`indonesian-nasal-rules.ts`, exporting a single `nasalCandidates()` that both
callers consume. The rules became _data_:

```ts
const NASAL_ALLOMORPHS = [
  { onset: 'ng', elided: 'k', restoreUnless: /^[gh]/ },     // the bug was one cell here
  { onset: 'ny', elided: 's', restoreUnless: null },        // always restore
  { onset: 'm',  elided: 'p', restoreUnless: /^[bf]/ },
  { onset: 'n',  elided: 't', restoreUnless: /^(?:[dcjz]|sy)/ },
  { onset: '',   elided: null, restoreUnless: null },        // bare me-/pe-
];
```

Note what this buys beyond "less code": the bug, if it recurred, would now be a
single wrong _value_ in a table you can read top-to-bottom and check against a
grammar — not logic buried in two `if/else` ladders. **Turning rules into data
makes them reviewable.** The anti-drift test was deleted and replaced with direct
unit tests of the table (correctness, not consistency).

**Deliberately did _not_ do** (this is the judgment part, and it matters as much
as the extraction):

- **Did not fold in the inverse `prefixWithMeng` (root → surface).** It encodes
  the same facts but carries real exemptions (`per-`, `pelajar-`) the strip
  direction doesn't. Forcing it into the same table would bend a clean structure
  to fit a messier function — trading one kind of mess for another.

- **Did not merge the broader affix lists** (suffixes, simple prefixes). They
  _overlap_ between the two files, but the two algorithms genuinely differ (one
  over-generates an unordered set for lookup; the other does an ordered
  minimal-path search and also handles circumfixes/reduplication the other
  doesn't). The shared text is incidental, not shared _knowledge_.

This is the discipline behind DRY that's easy to miss: **extract shared
_knowledge_, not merely shared-looking _text_.** Over-applying DRY couples things
that should stay independent and is its own well-known failure mode (sometimes
called "the wrong abstraction" — Sandi Metz: _"duplication is far cheaper than the
wrong abstraction"_). The skill is telling "same fact" apart from "similar code."

---

## 7. Transferable checklist

When you catch yourself fixing the same thing in two places:

1. **Name the knowledge.** What single fact is written down more than once?
2. **Is it really the same fact**, or just similar-looking code with different
   purposes? (If different, leave them alone.)
3. **If same:** can it become _data_ (a table) with one function over it? Data is
   easier to review than branching logic.
4. **Check your tests' job description.** Are you testing _correctness_ (matches
   reality) or merely _consistency_ (two things match each other)? The latter
   can't catch a shared mistake.
5. **Resist over-merging.** Stop at the genuinely shared core; let the divergent
   parts stay divergent.

---

## 8. Files involved (for future reference)

- `apps/web/src/app/home/dictionary/indonesian-nasal-rules.ts` — the new single source of truth.
- `apps/web/src/app/home/dictionary/indonesian-variation-generator.ts` — lookup; now consumes the table.
- `apps/web/src/app/home/dictionary/indonesian-segmenter.ts` — decomposition line; now consumes the table.
- `apps/web/MORPHOLOGY_AID.md` — design doc for the decomposition feature.
