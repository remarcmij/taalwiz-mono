# Turning control flow into data: a table-driven refactor (safely)

_2026-06-08. Context: rewriting the dictionary's variation generator from a
hand-written `if`-ladder into a data-driven rule pipeline, without changing its
behaviour. Companion to [the duplicated-knowledge note](2026-06-08-shared-morphology-rules.md)._

---

## 1. The idea: code vs. data

The variation generator had grown, over ~10 years, into a long sequence of
`if (word matches X) { recurse(stripped) }` blocks — one per affix. That's
**control flow**: the rules are expressed _as code_. The alternative is to
express the rules _as data_ — a list of rule objects — and write one small,
generic **engine** that interprets them.

```
// control flow (rules ARE the code)            // data-driven (rules are DATA an engine reads)
if (m = word.match(/^ter(.{2,})$/))            const RULES = [
  recurse(m[1]);                                  { label: 'ter-', pattern: /^ter(.{2,})$/ },
if (m = word.match(/^ber(.{2,})$/))               { label: 'ber-', pattern: /^ber(.{2,})$/ },
  recurse(m[1]);                                  ...
// ...17 more                                    ];
                                                 for (const r of RULES) { ...one generic step... }
```

Why prefer data here?

- **You can _see_ the whole ruleset at a glance** — it's a list, not 150 lines
  of branching. "Which affixes do we handle?" is answered by reading data.
- **It's explainable to non-developers.** A table of `{ label, pattern }` is
  close to a grammar reference; the branching code is not. The table can even
  _become_ the source for generated docs or an in-app explanation.
- **Adding/reordering a rule is editing a list**, not surgery on control flow.

This is a classic, named technique: **table-driven methods** (Steve McConnell,
_Code Complete_) — replace complicated logic with a lookup over data. Related
ideas you'll meet: the **interpreter pattern** (data describes what to do, an
engine executes it) and **"data over code."** Compilers, parsers, and
state machines lean on it heavily.

It is _not_ always better. Tables shine when you have **many rules of a few
uniform shapes**. If every rule is a special case, a table just hides the logic
inside opaque callbacks and you've gained nothing (see §4).

---

## 2. The decisive precondition: name the shapes

The refactor only became clean once we identified that all ~21 rules reduce to
**three shapes**:

1. **Simple strip** — match a regex, recurse into the remainder (capture group 1).
   Carries state through unchanged. (~18 rules — the bulk.)
2. **Synthesis** — _not_ a strip: build a longer form (the active `meN-` form)
   to make a passive/reduced word resolve to its indexed active form. Gated on a
   state flag, and flips that flag on. (2 rules.)
3. **Nasal strip** — delegate to the shared allomorphy table, which returns 0..n
   candidates. (2 rules.)

In TypeScript this is a **discriminated (tagged) union**: each rule has a `kind`
field, and the engine `switch`es on it. The type system then guarantees the
engine handles every shape, and that each shape's fields are used correctly.

> The taxonomy _is_ the design. Once the shapes were named, the engine wrote
> itself: ~25 lines, one `case` per shape. Most of the value of a table-driven
> rewrite is in finding the small set of shapes, not in the mechanical
> conversion.

A subtlety worth internalising: **"three shapes" and "one ordered list" are
orthogonal.** The _shape_ is a property of each rule (its type); the _order_ is
a property of the pipeline (the array). We encoded shape in the union and order
in the array — two independent axes. (This is why "separate tables, one per
shape" was _not_ quite the right structure here — see §3.)

---

## 3. The trap that shaped the structure: order is load-bearing

It's tempting to keep three separate arrays (one per shape) and run them in
turn: all strips, then all synthesis, then all nasal. **That would have changed
the output**, because the rules' relative order is _load-bearing_ (see the
companion note for the term): the result is collected in a `Set`, and the Set's
**insertion order is the dictionary lookup priority**. Two deliberate decisions
depend on it — the synthesis rules must emit the active `meN-` form _before_ the
bare root is reached, so the more-likely-wanted form is tried first.

So the rules live in **one ordered list**, assembled from named sub-groups:

```ts
const RULES = [
  ...CLITIC_STRIPS,      // shape 1
  ...SYNTHESIS_RULES,    // shape 2  <- must sit here, before the bare-root strips
  ...AFFIX_STRIPS,       // shape 1
  ...NASAL_STRIPS,       // shape 3
  ...REDUPLICATION,      // shape 1
];
```

Shape-1 rules appear in three of the groups — proof that grouping purely by
shape would have reordered them. The named groups document intent; the single
flattened array preserves behaviour.

Lesson: **before you regroup or reorder anything, ask what depends on the
current order.** Here it was lookup priority; elsewhere it might be side effects,
short-circuiting, or precedence. If the answer is "something observable," the
order is part of the spec, not an accident.

---

## 4. What we deliberately left as code

We did _not_ force the two synthesis rules into the same uniform shape as the
strips. They genuinely differ (forward generation, a gating flag, a "recurse
into the bare base too?" option that differs between the two). Cramming them in
would have meant every rule row carrying optional callbacks and flags — dragging
the complexity back into the "table" and defeating the point.

This is the same judgment as the companion note: **model the real shapes; don't
flatten everything into one fake-uniform structure.** A discriminated union with
three honest variants beats one bloated variant pretending to be uniform.

---

## 5. The technique that made it safe: a characterization test first

Refactoring means **changing structure without changing behaviour.** The risk is
silently changing behaviour. The defence used here, _before_ touching the code:

1. Wrote a **characterization (a.k.a. golden / approval) test** — capture the
   _exact current output_ (here, full arrays, **order included**) for a dozen
   inputs spanning every rule shape and the order-sensitive cases.
2. Generated the baseline by running it against the known-good code
   (`vitest -u`, which writes the values into the test as inline snapshots).
3. Committed that as a checkpoint.
4. Refactored. Re-ran. **Byte-identical output = behaviour preserved**, proven
   mechanically rather than by eyeballing.

The name to know: **characterization test** (Michael Feathers, _Working
Effectively with Legacy Code_) — a test that pins down what the code _currently
does_ (not what it _should_ do), so you can refactor under it. It doesn't judge
correctness; it freezes behaviour. (Tie-in to the companion note's
consistency-vs-correctness point: a characterization test is deliberately a
_consistency_ check — "did I preserve behaviour?" — which is exactly the right
question for a refactor, and the wrong one for a bug fix.)

A small bonus from writing it: the snapshot surfaced an output I didn't
understand (`mengumpul` → `...kumpul, mpul, ngumpul`). Chasing it down revealed
that `kumpul` matches the `ku-` pronoun-prefix strip and produces a spurious
`mpul` — a real, pre-existing over-generation the lookup tolerates. **The golden
test taught me the system before I changed it.** That's a feature, not a
distraction: if you can't explain the current output, you're not ready to
refactor it.

---

## 6. Transferable checklist

When tempted to turn a tangle of `if`s into a table:

1. **Can you name a small set of shapes** the rules fall into? If not, a table
   won't help — stop.
2. **Encode shape in types** (a discriminated union), order in the array — keep
   the two axes separate.
3. **Find what depends on order/precedence** before regrouping. Preserve it.
4. **Don't over-uniformise.** Leave genuinely special rules as their own shape
   (or as code).
5. **Pin behaviour with a characterization test first**, generate its baseline
   against the current code, then refactor until the baseline is unchanged.
6. **Update the prose docs** that referenced the old structure (line numbers,
   "the X block") — they go stale silently.

---

## 7. Files

- `apps/web/src/app/home/dictionary/indonesian-variation-generator.ts` — the rule tables + engine.
- `apps/web/src/app/home/dictionary/indonesian-variation-generator.spec.ts` — the characterization snapshots (`describe('output order ...')`).
- `apps/web/src/app/home/dictionary/SEARCH.md` — search/generator design doc (updated).
