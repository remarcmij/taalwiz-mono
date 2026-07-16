# Decisions

Why Taalwiz is the way it is — and, more often, why it is **not** some other way.

**Who this is for.** First a coding agent; second the developer it works with. It is *not* onboarding — a new human should start with the per-app `ARCHITECTURE.md` and the guides, which say how the app works. This file says why parts of it are not built the obvious way: decisions that look like bugs or gaps until you know the history. An agent reconstructs that history from the codebase in a single session; a newcomer cannot, and will find this file terse to the point of opaque. That is by design — it began as notes an agent kept to carry context between sessions, and it stays in that register: conclusions, not narrative.

**How to use it.** Before changing something that looks wrong, check it is not a settled decision below — several were tried, rejected, and removed, or reversed once already. When a human questions a design choice, cite the entry so they get the "why not" without having lived it. That second use means each entry must be quotable to a human and still land, so keep it self-explaining, not cryptic.

**Verify, don't trust.** No agent changes code here on its own — a human is always in the loop, approving. But an agent reads an entry as fact and proposes acting on it, and an approving human may not catch an error, so a wrong entry here is more dangerous than a wrong line of prose a human would pause over. Treat every entry as a claim to check against the code or the compiler. Where a claim cannot be checked, cut it rather than repeat it.

Nothing here is permanent. Change any of it — but change it knowingly, and update this file when you do.

---
## 1. The dictionary

The dictionary is a precise digital rendition of an external authoritative source. That source is considered canonical. The rendition is best-effort.

**The dictionary is the authority, and the code never second-guesses it.** Where its own structure produces an odd-looking result — a word cross-filed under both its headword and its root, a modern sense under an older base — that is an accepted consequence, not a bug.

> **Never patch core lookup or the segmenter for a one-off entry.** Special-casing individual words inside `#fetchWordLemmas` or `segmentIndonesian` is how a dictionary engine rots. A content problem warrants a content fix.

The same authority runs the other way through the search: the variation generator deliberately **over-generates** candidate forms and lets the dictionary reject the spurious ones. That is only sound because the dictionary is the authority — an over-strip that isn't a real headword simply never validates, so the generator is allowed to be greedy. Don't make it precise. See [SEARCH.md](apps/web/src/app/home/dictionary/SEARCH.md).

**Dictionary content is out of bounds by default.** It is not in this repo (`content/` is gitignored; the source lives in a separate private repository), and it is not ours to edit — the core files are Teeuw's text, the `teeuw.X+.md` supplements are a lexicographer's job, and a content fix made from here is lost at the next compile anyway. If a change genuinely requires editing content, that is an explicit instruction from the developer, not something to undertake on your own.

What *is* ours is the software behind it. If you change the compiler's tilde handling, read [`apps/compiler/TEEUW_SOURCE_FORMAT.md`](apps/compiler/TEEUW_SOURCE_FORMAT.md) §6 and §8 for the semantics first; §7 explains why the supplements are hands-off.

---

## 2. Product philosophy

**No push notifications, review reminders, or streaks.** This is a product decision, not a missing feature. Reminder mechanics optimise for engagement metrics rather than learning, and read as nagging to a motivated adult learner (Duolingo's streaks are the explicit anti-pattern). The SRS already does the useful part: it surfaces due cards when the user opens the app. Do not propose these.

**PWA only. No native app.** Partly a consequence of the above — notifications were the main thing that would have justified app-store packaging. Capacitor is present, but the web target is the only target, which is why Capacitor Preferences is effectively `localStorage` here (see `apps/web/ARCHITECTURE.md` §9).

**Explanation, not drilling.** This is the product's edge and it settles feature arguments. Taalwiz explains *why* a word means what it means; it does not try to out-drill an app with a hundred engineers. When a proposed feature is a drilling mechanic, the answer is usually no.

**A self-directed study aid, not a classroom or curriculum tool.** There is deliberately **no teacher or institutional role** anywhere in the model. A teacher is just another peer.

---

## 3. Morphology aid (the decomposition line)

**Read `apps/web/MORPHOLOGY_AID.md` first — the entries below assume it.**

**It is an affix-labeller, not a morphological analyser.** This distinction is the whole safety argument and it is easy to erode by accident. Teeuw already groups derived forms under an editorial root (the `base` field), so the segmenter operates on a *(surface form, Teeuw-confirmed root)* pair: **the root is authoritative, not guessed**, and the machine only names the affixes bridging surface to root. A change that makes the segmenter guess roots independently breaks the claim that a linguist can trust it. Don't.

**Silence is safe.** No derivation path, or a material tie between candidates, returns `null` and the line simply doesn't appear. Being quiet costs nothing; being confidently wrong costs the app's credibility with exactly the audience it is pitched at.

**Co-present, don't disambiguate.** A breakdown is a property of a *lemma*, not of the surface string. `beruang` shows both readings: "bear" (a root, no breakdown) and `ber- + uang` ("to have money"). Suppressing the contextually-irrelevant reading requires guessing context — the one thing we must not fake. The learner's reading context does that job. Revisit only if co-presentation proves annoying in practice.

**Dropped: the graded tile/word-bank quiz.** Not deferred — dropped, after a concrete walk-through. Words with visible affixes are trivial to order; the only genuinely hard case is hidden-root nasal allomorphy (`menyapu` → `sapu`), which only has teeth if every distractor is a real, familiar word; the cases that truly force the rule (`memerah` from `perah` vs `merah`) are rare and need hand-prepared content, which kills the auto-generation appeal that motivated it. And it is drilling, not explanation (§2). **Do not re-brainstorm this.**

**Quiz variant A is the only quiz form**: a reveal-and-self-grade toggle (`MorphologyModeService`), no scoring and no scheduler — deliberately not a third review loop alongside the SRS.

**Deferred, with known reasons** (`MORPHOLOGY_AID.md` §8): layered display (rejected on correctness grounds), reduplication, and compounds. Compounds dead-end because the segmenter is single-root-anchored: `mencampuradukkan` is `meN- + campur + aduk + -kan`, but Teeuw files it under base `campur`, so the residual `campuraduk` never reaches the root. Fixing it needs an `isRoot()` dictionary predicate, which breaks the segmenter's pure, synchronous, no-dictionary-access property. Same machinery as reduplication — design them together or not at all.

---

## 4. Vocabulary and SRS

**Import is the one primitive.** Both sources — pasted text and a public list — import **into the active deck**, the same model as bookmarking. There is deliberately **no deck-to-deck import** and **no target picker**: the picker existed and was removed, because it nudged users toward per-lesson decks (below). To use a different deck, make it active first.

**One growing deck.** The intended course workflow is incremental: create a deck, import lesson 1, import lesson 2 into the *same* deck next week. Accumulation happens on top of existing SRS state, paced by the daily new-card cap, and the scheduler interleaves. Per-lesson decks are possible but discouraged — decks here are flat and independent, with no Anki-style shared-parent interleaving. Pre-built cumulative files are the anti-pattern: they reset lesson 1 to new every week.

**Clone is retired; re-import is the re-sync.** Cloning a public list produced a snapshot, and deck-level re-sync via `clonedFrom` turned out to be incompatible with the merge model. Both are gone. Import is idempotent, upserting by `term:lang`: new words are added, changed backs refreshed, **SRS scheduling preserved**, and nothing is ever deleted — an author's deletions deliberately do not propagate to importers.

**Lock has a specific, narrow meaning.** A locked deck rejects **incidental per-word edits** (bookmark/un-bookmark from any surface — the accidental un-bookmark that motivated the feature) but **allows deliberate bulk import**. Hence the API split: `addMany` is lock-guarded, `importMany` is lock-exempt. Locking guards a curated deck against accidents, not against growth. Studying a locked deck is always fine; lock never touches SRS review.

**Lemma-index override is study state, not content** — which is why it stays editable on a locked deck, unlike a typed `back`.

**No moderation of shared lists, by design.** Each deployment is a closed, trusted cohort (e.g. one department). Quality control is peer review, and full-name attribution ("Shared by …") makes sharers accountable. Adding moderation means adding a privileged role, which contradicts §2.

**Anki compatibility is the escape hatch.** `term;back` files mean power users can leave. Keep it.

---

## 5. Web app

**`NoPreloading` is deliberate** (`apps/web/src/main.ts`). The service worker's `app` asset group prefetches `/*.js` — every hashed lazy chunk — once the app stabilises, so router preloading only matters in a narrow window before the SW activates. The chunks are tiny (heaviest ~7 kB) against the framework/Ionic graph that loads regardless.

- Don't propose a custom `PreloadingStrategy` ("preload all except admin"): it saves ~10 kB the SW re-fetches anyway, and adds maintenance. Rejected once already.
- Note `adminGuard` uses `canActivate`, which blocks *viewing*, not *downloading*. Only `canMatch`/`canLoad` gate preloading. Non-admins do download admin chunks; this is known.
- The only real lever is SW-level (`installMode: lazy` in `ngsw-config.json`), declined because it weakens first-load offline and can't target admin specifically — esbuild names chunks `chunk-[hash].js`. Revisit only if admin grows heavy.

**Refresh-token storage in `localStorage` is an accepted trade-off**, with the reasoning, the mitigation sketch, and the offline-auto-login trap that mitigation would spring, all recorded in `apps/web/ARCHITECTURE.md` §9. Read that before touching it.

---

## 6. Content authoring

**Asterisk emphasis is a tappable target word; underscore emphasis is not.** `FOREIGN_FRAGMENT_RE` in `apps/api/src/util/markup.ts` matches `*…*` / `**…**` only, wrapping the fragment in a lookup span. Underscore emphasis passes through to `marked` untouched.

So in article markdown: use `*…*` **only** for Indonesian (target-language) words meant to be tappable, and `_…_` for emphasis on Dutch/native text, labels and instructions — otherwise a Dutch word becomes a dictionary lookup that will never resolve.

---

## 7. Documentation audiences

Two dictionary-search documents exist on purpose, and they are not duplicates:

- `apps/web/src/app/home/dictionary/SEARCH.md` — for **developers and coding agents** who need to change the search code safely. Its linguistics goes exactly as deep as is needed to justify a code decision (why there is no infix rule; why the synthesis ordering is what it is). Keep that "why" here. Do not restructure it toward a linguist audience, and do not migrate its explanations into the guide.
- `apps/docs/docs/guide/how-search-works.md` — the **linguist-facing** artifact, which SEARCH.md links to.

The variation-generator-with-dictionary-as-validator design is original to this project and predates its documentation. Note the naming: `IndonesianVariationGenerator` is **not** a stemmer — it deliberately *over-generates* unordered, unlabelled lookup candidates for recall. The precision-oriented counterpart is the separate `indonesian-segmenter.ts` (§3). The old "stemmer" name was a misnomer and was removed; don't reintroduce it.
