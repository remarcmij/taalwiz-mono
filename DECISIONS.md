# Decisions

A note to a future coding agent — me next session, or the next one. Each entry is a choice that looks like a bug, a gap, or an easy win and is not: it was considered and rejected, or tried and removed. Check here before "fixing" one of them.

Terse by design — the per-app `ARCHITECTURE.md` and the guides explain how the app works; this says why parts are *not* built the obvious way. Verify each entry against the code or compiler before acting on it; if it can't be verified, cut it rather than repeat it. Change anything here knowingly, and update the file.

---

## Dictionary

- **Never special-case a word in lookup or the segmenter** (`#fetchWordLemmas`, `segmentIndonesian`). The dictionary is the authority, and an odd-looking result from its own structure is content, not a bug. A content problem needs a content fix, not code.
- **The variation generator over-generates on purpose.** It emits many candidate forms and lets the dictionary reject the spurious ones — a non-word never validates — so it is allowed to be greedy. Don't make it precise. See [SEARCH.md](apps/web/src/app/home/dictionary/SEARCH.md).
- **Don't edit dictionary content.** The source is a separate private repo (`content/` is gitignored); the core files are Teeuw's text and the `teeuw.X+.md` supplements are a lexicographer's job, and a content edit made from here is lost at the next compile. Changing the compiler's tilde handling is different — that is ours; read [`TEEUW_SOURCE_FORMAT.md`](apps/compiler/TEEUW_SOURCE_FORMAT.md) §6 and §8 first.

## Product

- **No push notifications, reminders, or streaks.** Deliberate: nagging optimises engagement, not learning. The SRS surfaces due cards when the app opens, which is enough.
- **PWA only, no native app.** The web target is the only target — which is why the refresh token lives in `localStorage` (see Web app).
- **Explanation, not drilling.** The product explains *why* a word means what it does; it does not compete on drills. A drilling-mechanic feature is usually a no.
- **No teacher or institutional role.** A self-directed study aid; a teacher is just another peer.

## Morphology decomposition line

Read `apps/web/MORPHOLOGY_AID.md` first — these assume it.

- **It labels affixes; it does not analyse morphology.** The root comes from Teeuw (`base`); the code only names the affixes bridging surface → root. Don't make the segmenter guess roots on its own — that breaks the claim a linguist can trust it.
- **Prefer showing nothing to showing a wrong breakdown.** No clean path, or a tie between candidates, gives `null` and no line. A blank costs nothing; a confident error costs credibility with the exact audience this is for.
- **Show every reading; don't pick one.** `beruang` shows both "bear" (a root, no breakdown) and `ber- + uang` ("to have money"). Guessing which the context means is the one thing we must not fake — the learner's context does that.
- **Don't build an auto-generated affix drill** — a quiz that hands the learner affix tiles and grades them on assembling the word. Considered and dropped: it is drilling, not explanation, and it only bites on hidden-root cases that need hand-prepared content, which kills the auto-generation that was the whole point. The one quiz that exists is reveal-and-self-grade (`MorphologyModeService`), no scoring.
- **Compounds and reduplication are deferred, not missing.** The segmenter is single-root-anchored, so a two-root compound (`mencampuradukkan`) dead-ends; fixing it needs a dictionary lookup that breaks the segmenter's pure, synchronous property. `MORPHOLOGY_AID.md` §8.

## Vocabulary / SRS

- **Import always targets the active deck; there is no target picker.** A picker nudges toward per-lesson decks, which is the anti-pattern below. To import elsewhere, switch the active deck first.
- **One growing deck, not one per lesson.** Import each lesson into the same deck; SRS state accumulates and the daily new-card cap paces it. Pre-built cumulative files reset earlier lessons to new — don't.
- **Re-import is the sync, and it is idempotent** (upsert by `term:lang`): adds new words, refreshes backs, preserves the SRS schedule, never deletes. There is no clone or snapshot.
- **A locked deck blocks incidental bookmark edits, not import.** `addMany` is lock-guarded, `importMany` is not. Lock guards against an accidental un-bookmark, not against growth; study is never affected.
- **`lemmaIndex` is study state, not deck content** — so it stays editable on a locked deck.
- **No moderation of shared lists, deliberately.** A closed, trusted cohort plus named attribution is the control. Moderation means a privileged role, which contradicts "no teacher role".
- **Keep Anki `term;back` import/export.** It is the power-user escape hatch.

## Web app

- **`NoPreloading` is deliberate** (`main.ts`). The service worker already prefetches every lazy chunk and they are tiny, so a custom `PreloadingStrategy` buys nothing. `adminGuard` is `canActivate`, so it gates viewing, not downloading — non-admins do fetch admin chunks, which is known and accepted.
- **The refresh token in `localStorage` is an accepted trade-off.** The reasoning, the mitigation, and the offline-login trap it would spring are in `apps/web/ARCHITECTURE.md` §9 — read that before changing it.

## Content authoring

- **In article markdown, `*asterisk*` makes an Indonesian word tappable; `_underscore_` does not.** `FOREIGN_FRAGMENT_RE` matches asterisks only. Use underscores for Dutch/native emphasis, or the word becomes a dictionary lookup that never resolves.

## Naming

- **`IndonesianVariationGenerator` is not a stemmer.** It over-generates lookup candidates for recall; the precision counterpart is `indonesian-segmenter.ts`. "Stemmer" was a removed misnomer — don't reintroduce it.
