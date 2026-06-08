# From one bug to a single source of truth: a session retrospective

_2026-06-08. A synthesis note tying together the two topic notes from the same
session ([shared morphology rules](2026-06-08-shared-morphology-rules.md) and
[the table-driven refactor](2026-06-08-table-driven-refactor.md)). Where those
explain individual techniques, this one steps back and asks: what did the whole
arc actually achieve, and what's the transferable shape of it?_

---

## The arc

It started as a bug report, not a refactor: tapping `mengumpulkan` did not
resolve to its root `kumpul`. The fix was a single inverted character class
(`/^[aeiouagh]/` where it should have been `/^[gh]/`). But pulling that thread
revealed the same bug living in a **second** file, and from there the work grew,
deliberately and in checkpoints, into:

- a shared single-source-of-truth module for meN-/peN- allomorphy (both directions),
- a table-driven rewrite of a 10-year-old recursive `if`-ladder,
- a characterization test that made the rewrite provably behaviour-preserving,
- and the retirement of a test that had been giving false confidence.

The important framing: **the bug earned the refactor.** I didn't go looking for
things to tidy; a real defect exposed a structural weakness, and fixing the
weakness was the proportionate response. That ordering is worth preserving as a
habit — refactors that start from "this offends me" age worse than ones that
start from "this just bit us."

---

## What was actually achieved (beyond "cleaner code")

1. **Implicit knowledge became explicit.** Rules that were encoded *as control
   flow* (the shape of the `if`s) became *data* (rows in a table) an engine reads.
   You can now see the whole ruleset at a glance.

2. **The analysis forced a useful taxonomy.** Making it table-driven was only
   possible after naming the three rule *shapes* (simple strip / synthesis /
   nasal). Most of the value was in the categorisation, not the mechanical
   conversion. The taxonomy *is* the design.

3. **Duplication was eliminated structurally, not policed.** Three hand-written
   copies of the allomorphy collapsed into one module. Drift is now impossible
   because there is nothing to drift from — strictly better than a test that
   *watches* for drift.

4. **The mental model of testing got upgraded.** The old "anti-drift" test
   checked that two copies *agreed*, and stayed green while both were wrong.
   **Consistency is not correctness.** A test that two things match each other
   cannot catch a mistake copied into both. We replaced it with correctness tests
   plus a *legitimate* consistency check (forward/inverse round-trip) that is only
   trustworthy because each side is independently verified.

5. **The rewrite was done under proof.** A characterization (golden) test froze
   the exact current output first; the refactor counted as correct only when the
   output stayed byte-identical. Demonstrated, not eyeballed.

6. **Two axes that looked like one got separated:** a rule's *shape* (its type)
   versus the pipeline's *order* (the array). Recognising that order was
   *load-bearing* — it is the dictionary lookup priority — is what prevented a
   "tidy" regrouping from silently changing behaviour.

7. **Restraint was a first-class decision.** We deliberately did *not* merge the
   forward and inverse tables, *not* merge the affix lists, *not* cram every rule
   into one uniform shape. Knowing where to stop is as much the skill as the
   extraction. ("Extract shared knowledge, not shared-looking text.")

8. **Hidden logic became inspectable and testable.** A private, unverifiable
   helper became an exported, table-driven function with a test per case.

9. **The system taught us before we changed it.** A surprising snapshot value
   (`mpul`) got traced, not assumed, and revealed a spurious strip the lookup
   tolerates. Rule of thumb: *if you can't explain the current output, you're not
   ready to refactor it.*

10. **The reasoning was captured, and the vocabulary named.** Named concepts
    (surface→derivation, load-bearing, code smell, characterization test,
    discriminated union, allomorph/archiphoneme) are reusable in a way that
    ad-hoc intuition is not. These notes are part of the deliverable.

11. **The code is now legible to a non-developer** — close to a grammar reference,
    and a plausible source for generated docs. That aligns the implementation with
    Taalwiz's actual thesis: it wins on *explanation*.

---

## The one-sentence version

> We converted knowledge trapped in control flow and duplicated by hand into a
> single, explicit, testable source of truth — and upgraded our sense of what a
> test is actually proving.

---

## The honest caveat

This was a *local* win on one subsystem. The same two smells — implicit knowledge
in control flow, and consistency masquerading as correctness — almost certainly
exist elsewhere in the codebase. The lasting value isn't this one cleanup; it's
the sharpened lens for spotting the next instance, and the worked example of how
to deal with it safely (bug → characterization test → extract → prove unchanged).

---

## Transferable recipe

When a bug makes you fix "the same thing" twice:

1. Stop — that's a duplicated-knowledge smell. Name the single fact.
2. Pin current behaviour with a characterization test before touching anything.
3. Extract the fact to one source; delete the copies.
4. Ask whether the remaining logic has a small set of *shapes* — if so, make it
   data (a table) with a tiny engine; if not, leave it.
5. Find what depends on order/precedence and preserve it.
6. Replace any "do the copies agree?" test with "is each independently correct?".
7. Don't over-merge. Stop at the genuinely shared core.
8. Update the prose docs that referenced the old structure.
9. Write down *why*, and name the concepts.
