# Decisions

Why Taalwiz is the way it is — and, more often, why it is **not** some other way.

`ARCHITECTURE.md` (per app) says *what* the code does and *how*. This file records the *why not*: choices that were considered, tried, or repeatedly proposed and deliberately rejected. These are not visible in the code, because either not implemented or tried, rejected and removed.

**If you are a new contributor — human or coding agent — read this before "fixing" anything below.** Several entries may look like bugs or gaps and are neither. Each one cost real time to reach; some were reversed once already. Re-opening them without new information is most likely a waste of time: "been there, done that".

Nothing here is permanent. Change any of it — but change it knowingly, and update this file when you do.

---

## 1. The dictionary and its encoding

The part with lasting value is the **encoding system**, not the transcription alone: a markdown format that tracks the printed page closely enough that transcribing is a matter of appearance rather than linguistics, the compiler that turns it into a searchable index, and the conventions the app is built on — `**`/`*` marking target-language words (which is what makes a word tappable), and the variation generator that resolves inflected forms back to a Teeuw-attested root.

That is the expensive part to rediscover. The hand-digitisation took years, but redoing it today would still mean scanning the pages by hand while the markup conversion could be largely AI-assisted, as the Stevens dictionary was. The format and the machinery around it could not be recovered the same way: they encode judgments about what the page means. Working out why the printed swung dash re-anchors to a compound, and what that implies for the markup, took a full day of measurement against the corpus — and that is one symbol.

So neither the app nor the source is "just replaceable". Favour changes that keep the source faithful, self-describing and extensible, and that keep the format's rules explainable on one page.

The dictionary markdown is **not in this repo** (`content/` is gitignored; it lives in a separate private repository). Any correction found via tooling here must be propagated to that source, or it is lost at the next compile.

The format itself is specified in [`apps/compiler/TEEUW_SOURCE_FORMAT.md`](apps/compiler/TEEUW_SOURCE_FORMAT.md) — read §6 before touching anything tilde-related. Two decisions worth knowing are recorded there: `~` resolves to the nearest preceding bold word (a bold compound **does** capture it — "kurang terima kasih"), and `^` resolves to the headword, re-encoding a position that printed Teeuw marks by layout and flattening destroys. Both markers mean the same in the Stevens source; the two dictionaries share one convention deliberately.

### Teeuw is the judge

When Teeuw's own data structure produces a rendering quirk, that is an **accepted consequence, not a bug**. Its editorial choices are real content: cross-filing a word under both its own headword and its root, filing a modern sense under an older base. The app reflects them faithfully rather than second-guessing them in code. Verification is against the printed edition, not against intuition.

Two confirmed cases, both **no action**:

- `berhenti` shows its gloss twice — it is filed under both `base="berhenti"` and `base="henti"`.
- `kalian` decomposes to `kali + -an` and surfaces the "multiplication" sense, because Teeuw files it under `kali`.

The `kalian` case was addressed, but note **where**: a `teeuw.k+.md` supplement entry plus a hard-coded SRS card back. That is the rule:

> **Override levers are the per-letter supplement files (`teeuw.X+.md`, flagged `isSupplement`) and SRS card backs — never a patch to core lookup or the segmenter for a one-off entry.**

Special-casing individual words inside `#fetchWordLemmas` or `segmentIndonesian` is how a dictionary engine rots. The supplement mechanism exists precisely so that content problems get content fixes. See `apps/compiler/TEEUW_PARSER.md` (Part 2).

"The judge" means the *page*, not the notation. Print is internally inconsistent in at least one place: under `titik berat` it writes `meletakkan ~ berat`, using `~` for the headword inside a sublemma where its own convention makes `~` the compound. Read the word the entry means, not the symbol it used.

### Accepted boundary: tilde drift under a single-word derivation

A `~` under a bold **compound** used to be a systematic hazard; that class is closed (see §1's pointer to the format guide — the marker that fixed it has since been replaced by an inline `^`, and ~330 wrong expansions were corrected against print along the way).

What was **not** exhaustively swept is the same shape under a **single-word bold derivation**: roughly 11k `~` lines where a derivation legitimately governs its own sub-references and is almost always right, but where a headword's list resuming after a derivation would need an explicit `^`. Spot fixes have been applied where found (`persuratkabaran`, `kesertamertaan`, `kewalikotaan`, `berubah`). The bucket as a whole is a **recorded, accepted boundary, not unfinished work.** Do not re-open it as a cleanup task.

If you do go near it: the compiler is the only reliable oracle. Simulating the tilde rules from the source text is deceptively hard — the parenthesis double-pass, and a bare sense-number line re-tokenising its own tilde word, both change what `~` resolves to in ways a regex over the markdown will not predict. Instrument the compiler and measure; four separate estimates made that way were wrong before the measured ones were right.

---

## 2. Product philosophy

**No push notifications, review reminders, or streaks.** This is a product decision, not a missing feature. Reminder mechanics optimise for engagement metrics rather than learning, and read as nagging to a motivated adult learner (Duolingo's streaks are the explicit anti-pattern). The SRS already does the useful part: it surfaces due cards when the user opens the app. Do not propose these.

**PWA only. No native app.** Partly a consequence of the above — notifications were the main thing that would have justified app-store packaging. Capacitor is present, but the web target is the only target, which is why Capacitor Preferences is effectively `localStorage` here (see `apps/web/ARCHITECTURE.md` §9).

**Explanation, not drilling.** This is the product's edge and it settles feature arguments. Taalwiz explains *why* a word means what it means; it does not try to out-drill an app with a hundred engineers. When a proposed feature is a drilling mechanic, the answer is usually no.

**A self-directed study aid, not a classroom or curriculum tool.** There is deliberately **no teacher or institutional role** anywhere in the model. A teacher is just another peer.

---

## 3. Morphology aid (the decomposition line)

Full write-up: `apps/web/MORPHOLOGY_AID.md`.

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
