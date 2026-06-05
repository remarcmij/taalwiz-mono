# Morphology aid

When a learner taps an inflected Indonesian word, the word-click modal already resolves it
to its dictionary root and shows `surface -> root` in the title (e.g. `menyapukan -> sapu`)
plus the definition. The **morphology aid** adds one small line that shows _how_ the word
breaks into morphemes:

```
menyapukan -> sapu
meN- + sapu + -kan
menyapukan, vegen(, strijken) met enz; vegen voor enz.
```

It is an **aid, not a quiz**: passive, on-demand, no scoring, no new interaction. It simply
annotates a lookup the user is already doing. (A quiz variant that asks the learner to
decompose a word themselves is deliberately deferred until we have worked out how it relates
to the in-article quiz and the SRS scheduler.)

This document explains how the aid is grounded in the Teeuw dictionary, because that
grounding is the whole point: it is what lets us show automated morphology without ever
making a claim a linguist could fault.

---

## 1. Teeuw is the single source of truth

We only ever display forms Teeuw attests. We never invent a word, even one that genuinely
exists in the wild. Two layers are stacked in each breakdown line, and only one of them is
ours:

- **The words** (the root, and in editorial cases the surface form too) and **the fact that
  one derives from the other** come from Teeuw. Authoritative, never guessed.
- **The affix cut** between them (`meN- + ... + -i`) is _our automated annotation_. It is
  rendered in muted grey precisely to mark it as the derived, machine-added layer, distinct
  from the authoritative dictionary text.

If a genuinely missing form would be needed, it is filled by curation through the `a+`
supplement mechanism (see section 6), never conjured by the code.

---

## 2. Where `base` (headword) vs `keyword` comes from

The aid's root-vs-derived test (section 3) rests entirely on the dictionary's
`base`/`keyword` structure. The short version: it is a mechanical encoding of Teeuw's own
**printed indentation** (a headword sits at the left margin; its derived run-on forms are
indented beneath it), and the compiler preserves it — the first `**bold**` word of a
blank-line-delimited block becomes the `base` (headword), and every later `**bold**` word in
that block becomes a `keyword` _under_ that base. So `keyword != base` means "derived form",
and it is editorial typography, not a parser heuristic.

The full algorithm (blank-line blocks, the `if (!_base)` guard, homonym numbering, the
`keyword` flag, worked examples) lives with the compiler it describes:
**[../compiler/TEEUW_PARSER.md, Part 1](../compiler/TEEUW_PARSER.md)**.

---

## 3. Root vs derived: read it off the topology, no part-of-speech needed

Teeuw records no part-of-speech, but it does not need to. Each lemma carries a keyword word
and a `base`, and that relationship alone tells us what we need:

- **keyword word == its `base`** -> this reading is a **root**. Show **no** breakdown.
- **keyword word != its `base`** -> this reading is a **derived form**. Break it down,
  labelling the affixes that bridge keyword -> base. The root (`base`) is handed to us by
  Teeuw, so the segmenter only has to name the bridge.

### Co-presentation, never disambiguation

A surface string can have several readings; the modal lists them all. The breakdown is a
property of each _reading_, not of the string, so ambiguous words resolve cleanly without
guessing. `beruang` returns two keyword readings:

| Reading | `base` | keyword vs base | Breakdown |
| --- | --- | --- | --- |
| bear (the animal) | `beruang` | equal | none (it is a root) |
| "to have money" | `uang` | different | `ber- + uang` |

We show both. The learner's reading context decides which is meant — that is the human's
job, and the one thing we must not fake.

---

## 4. Flat, never layered

The breakdown is **flat**: root plus affix labels in surface order (`meN- + per- + baik +
-i`). We do **not** render a derivation chain through intermediate forms
(`baik -> perbaiki -> memperbaiki`), because an intermediate like `perbaiki` is often **not**
a Teeuw keyword. Verified: under base `baik`, Teeuw lists `memperbaiki` but not `perbaiki`.
Asserting `perbaiki` would break section 1. Flat output only ever names the two attested
endpoints (root and, in editorial cases, the surface form) and labels the affixes between
them.

---

## 5. Two tiers of confidence (both safe)

The aid shows a breakdown in two situations, rendered identically:

1. **Editorial.** Teeuw lists the surface form itself as a keyword sublemma (`memperbaiki`,
   `pemukul`, `keindahan`). Both ends are attested; the segmenter only labels the affixes.
2. **Productive.** Teeuw _deliberately omits_ a fully-regular inflection because it is
   predictable: the `di-` passive (`dipukul`), the `ter-` superlative (`terbesar`),
   pronominal clitics (`-ku`, `-mu`, `-nya`). Here the root is attested and the affix is a
   closed-class rule. The **principled absence is itself the licence** to label it.

The only nuance to keep straight: in the editorial tier the _whole surface form_ is
Teeuw-attested; in the productive tier only the _root_ is, and the surface form is our
regular-inflection analysis over that attested root. Both are defensible; the second is a
slightly weaker footing, not an unsafe one.

---

## 6. Gaps go through `a+`, not automation

If a derivational form is genuinely missing from Teeuw and worth having, that is an
**editorial decision** made through the `teeuw.a+.md` supplement files (compiled into the
same chapter JSON, flagged `isSupplement`, rendered amber/underlined in the dictionary). The
segmenter never invents such a form. In fact, the segmenter quietly _wanting_ an unattested
intermediate is a useful signal: it is a candidate list for the curator to consider adding to
`a+` — the linguist-collaboration hook, with no "help us improve" nagging. See
[../compiler/TEEUW_PARSER.md, Part 2](../compiler/TEEUW_PARSER.md).

---

## 7. The segmenter

`apps/web/src/app/home/dictionary/indonesian-segmenter.ts` exports:

```ts
segmentIndonesian(surface: string, root: string): SegmentResult | null
```

It is a pure, synchronous, root-anchored search: given the surface word and the **known**
root (the lemma's `baseWord`), it peels recognised affixes from both ends until the form
equals the root, then returns the morphemes in surface order. Key properties:

- **It never invents a root.** The root is a fixed input; if no affix path reaches it, the
  function returns `null` and the modal shows no line.
- **Nasal allomorphy** (meN-/peN-) is reconstructed so the path lands exactly on the root
  (e.g. `menyapu` -> `sapu`, restoring the elided `s`). When a root consonant is restored, a
  `ruleNote` is emitted; the modal offers a small chevron that reveals it
  ("meN- before s: surfaces as meny-, and the root's initial s drops"). This is the headline
  teaching payload: it explains why `menyapukan` does not visibly contain its root `sapu`.
- **Labels use the archiphoneme** `meN-`/`peN-`, not the surface allomorph `mem-`/`meny-`.
- **Ambiguity is silence.** Among successful paths it prefers the fewest-morpheme analysis;
  if a genuine tie remains between materially different breakdowns, it returns `null`. (The
  known-root anchor makes such ties very rare in practice.)
- **Casing is meaningful.** The surface is lowercased (it is tapped text), but the root keeps
  its dictionary casing. A capitalised base is a proper noun, e.g. `Besar` (the calendar
  month) versus `besar` ("big"); a lowercase surface cannot derive from it, so `terbesar`
  yields a breakdown over the `besar` reading but **not** over the `Besar` one. The side
  effect is that genuine derivations of proper nouns (e.g. `mengindonesiakan` from
  `Indonesia`) get no breakdown either, which is acceptable: silence is safe, and such forms
  are rare.

The nasal rules are a hand-port of the production lookup `IndonesianVariationGenerator`
(`indonesian-variation-generator.ts`), which over-generates candidate forms for dictionary
lookup; the two must not drift, which `indonesian-segmenter.spec.ts` guards with a
cross-check test.

---

## See also

- [../compiler/TEEUW_PARSER.md](../compiler/TEEUW_PARSER.md) — the markdown to JSON parsing
  (Part 1: base/keyword/homonym) and the `a+` supplement mechanism (Part 2, the gap channel).
- `apps/compiler/INTERNALS.md` — the compiler pipeline overview and markup table.
- `apps/web/ARCHITECTURE.md` — the dictionary subsystem and the word-click modal.
