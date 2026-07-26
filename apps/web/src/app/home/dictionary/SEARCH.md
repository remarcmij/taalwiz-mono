# Dictionary Search Flow

This document describes the complete search and display flow in the dictionary module, including focus management, suggestions, variation generation, and breadcrumb tracking.

## 1. Overview

The search feature allows users to find dictionary entries for Indonesian and Dutch words. Indonesian searches support morphological variation generation to find base forms when inflected words are entered. Results are displayed with related compound words grouped under their base forms, and recent searches are tracked in a breadcrumb list.

---

## 2. Search Field & Focus Management

**Files**: `dictionary.page.ts`, `dictionary.page.html`

### 2.1 Auto-focus on Entry

When the user navigates to the dictionary page:
1. **`ionViewDidEnter()` lifecycle hook**: On desktop, queries the searchbar input element and calls `.focus()` to auto-focus the field. On mobile (`this.#platform.is('mobile')`), it returns early instead — focusing there would risk popping the on-screen keyboard on every view-entry
2. On desktop, the user can immediately start typing without clicking the field

### 2.2 Focus Retention After Enter

After every Enter press — regardless of whether it found a suggestion, ran the fallback lookup, or did nothing because the field was empty — the keyup handler's mobile check decides what happens to focus:
- **Desktop**: nothing blurs the field, so it stays focused and the user can start typing the next search immediately
- **Mobile** (`this.#platform.is('mobile')`): `searchInputElement.blur()` is called, collapsing the on-screen keyboard

This is implemented at the end of the Enter branch in the `ionViewWillEnter()` keyup subscription (see [3. Autocomplete Suggestions & the Keyup Pipeline](#3-autocomplete-suggestions--the-keyup-pipeline)).

### 2.3 Clear on Success, Preserve on Failure

After a lookup result arrives (the `#results$` tap in `dictionary.page.ts`):
- **Success** (`results.groups.length > 0`): `searchbarValue.set('')` clears the field, ready for the next search
- **Failure** (no results): `searchbarValue.set(results.target.word)` restores the *searched* word — not whatever the field happens to show right now. Most lookup paths (breadcrumb click, suggestion click, base click, in-text word click) never touch the searchbar at all, and even a typed Enter-lookup is async, so by the time a "not found" result lands the user may already be typing something else. Restoring from `results.target` keeps the redisplayed word consistent with the result actually being shown, rather than trusting the live field value.

---

## 3. Autocomplete Suggestions & the Keyup Pipeline

**Files**: `dictionary.page.ts` (`ionViewWillEnter`), `dictionary.service.ts` (`#fetchSuggestionsAsync`), `searchbar-dropdown.component.ts`

Suggestion fetching and Enter-key search are **the same pipeline**, not two separate features — one `keyup` listener, set up once per page-visit in `ionViewWillEnter` and torn down on `ionViewWillLeave` (`takeUntil(this.#leave$)`, so a cached-and-reopened Ionic tab doesn't stack a second live listener on the same input).

> **Suggestions are a literal prefix match — no variation generator.** `#fetchSuggestionsAsync()` queries `findWordsStartingWith(term)` directly on the typed text. Both languages carry **equal weight**: target-language and native-language hits (up to 10 each) are merged, de-duplicated, and sorted alphabetically (case-insensitive), so Indonesian and Dutch suggestions **interleave** rather than listing all target matches first. The list is then capped at 10; the user narrows to one language simply by typing another letter or two. The variation generator is deliberately **not** applied to the suggestion list. This was tried and rejected: generating variations of a partially-typed word surfaces alphabetical neighbours of stripped forms (e.g. typing `memperbai` strips `-i` to `memperba` and suggests unrelated `memperba*` words), which reads as a broken filter. Morphological resolution of inflected forms still happens on the **lookup path** (`#searchLocal`, via the variation generator) — reached by tapping a word, tapping a suggestion, or pressing Enter with no matching suggestion (see [4.2 Path 2: Manual Entry Without Autocomplete (no match)](#42-path-2-manual-entry-without-autocomplete-no-match)).

### 3.1 Pipeline shape

```
fromEvent(input, 'keyup')
  |> map        term = trimmed input value; isEnter = event.key === 'Enter'
  |> switchMap  branch on isEnter:
                  Enter:   suggestions$(term) immediately — no debounce
                  typing:  timer(250) -> suggestions$(term)
  |> takeUntil(leave$)
  |> subscribe  suggestions.set(...); if (isEnter) act on the result
```

Both branches resolve to the same shape, `{ isEnter, suggestions }`. `isEnter` is carried alongside the fetched suggestions specifically so the single `subscribe` at the bottom doesn't need to infer which branch a given emission came from — it's a local, visible fact at the one place that reads it.

### 3.2 Marble diagram: debounce and switchMap while typing

The user types "a", "i", "r" — three real keystrokes of a real word, each under 250ms after the last — then pauses:

```
time ─────────────────────────────────────────────────────────────▶

keyup$        a───i───r────────────────────(pause > 250ms)
              │   │   │
              │   │   └─ term: "air"
              │   └───── term: "ai"
              └───────── term: "a"

outer switchMap — one inner branch per keystroke; each new keystroke
unsubscribes ("✗") whatever inner branch is still running:

 "a"   ┬(timer 250)✗  cancelled: "i" arrives at +180ms
 "ai"  ┴┬(timer 250)✗  cancelled: "r" arrives at +170ms
 "air" ─┴───(timer 250)───suggestions$("air")───▶ { isEnter:false, 
  suggestions:[
    air(id), 
    air(nl), 
    airbag(nl), 
    airconditioning(nl), 
    airloji(id), 
    airport(id)
  ]}
  ↑ dropdown renders ~250ms after "r" (continues in Scenario A below)
```

**`switchMap` at the outer level is what makes the debounce safe.** Every keystroke starts a new inner observable, and `switchMap` unsubscribes the previous one the instant a new keystroke arrives. So "a" and "ai" above never reach their `timer(250)` — only "air" (the keystroke after which the user paused) survives long enough to fire. There is only ever one suggestion fetch in flight, and it is always for the most recent term.

### 3.3 Three scenarios: what happens when the user stops typing

From here there are three different ways a lookup actually gets triggered, and they don't all go through the same part of the pipeline.

#### 3.3.1 Scenario A — tapping a suggestion (no Enter)

Continuing the diagram above: once the dropdown renders, the user reads it and taps **"airloji"** — not the first entry. This is a plain Angular output binding in `dictionary.page.html`, `(suggestionClicked)="onSuggestionClicked($event)"` on `<app-searchbar-dropdown>`, and never touches `isEnter` at all:

```
dropdown: [
  air(id), 
  air(nl), 
  airbag(nl), 
  airconditioning(nl), 
  airloji(id),    user taps "airloji" ──▶ onSuggestionClicked(airloji(id))
  airport(id)
]
```

The keyup pipeline's only role in this scenario was the debounced fetch that built the dropdown; the tap itself bypasses `switchMap`/`isEnter` entirely, and the user's own eyes — not the merge-and-sort order — decide which suggestion is used.

#### 3.3.2 Scenario B — pressing Enter, which accepts the first suggestion

Same typed term, but this time the lookup is committed with Enter instead of a tap. The diagram shows the tightest timing — Enter right after "r", before the 250ms debounce above would even have rendered a dropdown:

```
keyup$        a───i───r─<enter>
                        │
                        └─term="air" — suggestions$("air") fetched immediately, no timer
                              ▶ { isEnter:true, 
                                  suggestions:[
                                    air(id), ─▶ onSuggestionClicked(air(id))
                                    air(nl), 
                                    airbag(nl), 
                                    airconditioning(nl), 
                                    airloji(id), 
                                    airport(id)
                                  ]}
```

Enter is an ordinary `keyup` event, so it goes through the same outer `switchMap` — cancelling whatever debounce/fetch was still pending — but its own branch skips `timer(250)` and calls `suggestions$` immediately. The debounce exists to avoid hammering IndexedDB on every keystroke while the user is still typing; it was never meant to gate Enter, which needs to feel instant and must reflect the term just committed to.

Enter can just as well arrive **after** the debounce has fired and the dropdown is already on screen — the user pauses, looks at the list, and hits Enter rather than tapping a row. The code makes no distinction: the Enter branch is unconditional, so it re-fetches `suggestions$` for the current term and acts on `suggestions[0]` of that fresh list. Because nothing has changed the term in the meantime, the re-fetch returns the same list the dropdown is showing, and `suggestions[0]` is the visible top row. The only cost is a redundant IndexedDB query; the outcome is identical to the pre-debounce case above, including the Indonesian-before-Dutch tie-break described next.

`suggestions[0]` here is the Indonesian `air`, not the Dutch one, and the reason is worth spelling out because it isn't alphabetical — the two entries are spelled identically, so `localeCompare` treats them as equal. The tie is actually broken by `Array.prototype.sort`'s **stability guarantee**: `#fetchSuggestionsAsync()` builds the merged array as `[...targetHits, ...nativeHits]` — target hits always precede native hits — and then calls `merged.sort(...)`, whose stability preserves that relative order for anything the comparator treats as equal, so the Indonesian entry wins every tie. If the user actually meant the Dutch `air`, blind Enter silently gives them the Indonesian one instead; only clicking the correct row (Scenario A) gets the intended one. See [3.5 Suggestion selection & the "first match" pick](#35-suggestion-selection--the-first-match-pick) for the general case.

#### 3.3.3 Scenario C — pressing Enter with no matching suggestion

Typing a `di-` passive form like "dibakar" and pressing Enter immediately produces no suggestion at all — Teeuw indexes the active `membakar`, not the passive `dibakar`, as a headword — so Enter falls through to the variation-generator fallback:

```
keyup$        d──i──b──a──k──a──r─<enter>
                                  │
                                  └─ term="dibakar" — suggestions$("dibakar") fetched immediately
                                        ▶ {isEnter:true, suggestions:[]}
                                           suggestions.length === 0 → fallback:
                                              #lookup(new WordLang("dibakar", "id"))
                                                 → variation generator: [dibakar, membakar, bakar, mbakar]
                                                 → IDB hit on "membakar" → results displayed
```

See [3.6 The fallback when no suggestion matches](#36-the-fallback-when-no-suggestion-matches) for why this fallback assumes the target language and, unlike Scenarios A and B, can never resolve a literal native-language word.

### 3.4 Why Enter re-fetches instead of reading the `suggestions` signal

The `suggestions` signal backing the dropdown lags the debounce by up to 250ms. When Enter arrives before that 250ms elapses — the tight timing shown in Scenarios B and C above — the signal at the moment it's pressed is either still empty (no debounce has fired yet for this term) or — mid-way through a longer typing session — still holding an earlier term's matches, not the term just typed. Both are wrong to act on:

- **Stale**: reusing `suggestions` would search using an earlier term's matches for a term the user has since changed.
- **Empty**: reusing `suggestions` before the first debounce ever fires falls straight through to [3.6 The fallback when no suggestion matches](#36-the-fallback-when-no-suggestion-matches) below — an empty array reads exactly like "no suggestion matched," even when one exists.

The empty case is what motivated fetching fresh rather than reading the signal: a native-language (Dutch) word like *"dozijn"* has no target-language variation match, so it can **only** be found through the literal suggestion lookup (Scenario A or B's path). If Enter read the stale/empty signal instead, typing "dozijn" and pressing Enter quickly — Scenario B's timing, but for a word whose suggestions were never fetched — would silently fail to find a word that is, in fact, in the dictionary.

When Enter arrives *after* the debounce the signal is in fact correct and could be read directly, but the branch doesn't special-case that: it can't cheaply distinguish "signal holds this term's matches" from "signal holds the previous term's matches," and the saving would be one IndexedDB query on an already-warm store. Re-fetching unconditionally is the simpler correct rule.

### 3.5 Suggestion selection & the "first match" pick

```typescript
if (suggestions.length > 0) {
  this.onSuggestionClicked(suggestions[0]);
} else if (this.searchbarValue()) {
  this.#lookup(new WordLang(this.searchbarValue(), langConfig.targetLang));
}
```

Clicking a suggestion in the dropdown and pressing Enter both end up calling `onSuggestionClicked`, but Enter picks `suggestions[0]` **blindly** — whatever ends up first in the freshly-fetched array, not whatever the user's eye landed on. "First" means first after `#fetchSuggestionsAsync`'s alphabetical merge of target- and native-language hits; it is not a relevance ranking. Two failure shapes follow from that:

- Two *differently*-spelled words (one Indonesian, one Dutch) matching the typed prefix: whichever sorts alphabetically first wins, even if the other is what the user meant.
- Two *identically*-spelled words in different languages (a real homograph, like `air` — see [3.3.2 Scenario B — pressing Enter, which accepts the first suggestion](#332-scenario-b--pressing-enter-which-accepts-the-first-suggestion) above): alphabetical sort can't break the tie, so it falls to `Array.prototype.sort`'s stability guarantee, which favours the target language because target hits are concatenated before native hits before sorting. The Indonesian entry always wins a homograph tie, never the Dutch one.

In practice this only surprises someone who typed and hit Enter fast enough to never see the rendered dropdown — a common pattern for a "type and go" search box. A user who waits for the list to render and clicks their intended entry sidesteps the ambiguity entirely; it only exists on the blind, Enter-only path.

### 3.6 The fallback when no suggestion matches

If the freshly-fetched suggestions come back empty, Enter falls back to a full variation-generator-backed lookup, `this.#lookup(new WordLang(term, langConfig.targetLang))` — **hardcoded to the target language (Indonesian)**. This is the path documented as [4.2 Path 2: Manual Entry Without Autocomplete (no match)](#42-path-2-manual-entry-without-autocomplete-no-match) below. Because it assumes Indonesian, this fallback can never resolve a literal native-language word on its own — that's only reachable through the suggestion match above, which is exactly why Enter has to check for a suggestion first rather than searching the typed text directly.

---

## 4. Search Paths & Variation Generation

**Files**: `dictionary.service.ts`, `indonesian-variation-generator.ts`, `variation-generator.ts`

All dictionary searches run entirely offline against IndexedDB — there are no API calls during lookup. The compiled dictionary is synced to IDB on login (`DictSyncService`) and queried by `DictStoreService`.

The variation generator is pluggable via `langConfig.variationGenerator` (`VariationGenerator` interface in `variation-generator.ts`; currently `IndonesianVariationGenerator`). `DictionaryService.#searchLocal()` iterates over the variations returned by `langConfig.variationGenerator.getWordVariations()`, calling `DictStoreService.findByWordAndLang()` for each, and stops at the first variation that yields keyword-flagged lemmas.

### 4.1 Path 1: Autocomplete Suggestion (with match)

1. User types → autocomplete finds match (e.g., "air")
2. User clicks suggestion or presses Enter with suggestions available
3. `lookup({word: 'air', lang: 'id'})` is called → `searchDictionary()` → `#searchLocal()`
4. Since `lang === 'id'`, variation generator produces variations: `["air"]` (already a base form)
5. `DictStoreService.findByWordAndLang('air', 'id')` queries the `by-lang-wordlower` IDB index (case-insensitively)
6. **Result**: Returns all lemmas for "air" including compound entries ("air abu", "air alas", etc.)

### 4.2 Path 2: Manual Entry Without Autocomplete (no match)

1. User types "dibakar" (or other word) → no literal-prefix suggestion matches (suggestions are not expanded into variations)
2. User presses Enter (on mobile this is the soft-keyboard Go/Search/Return key, which fires the same `key === 'Enter'` event)
3. The keyup handler detects Enter, finds `suggestions.length === 0`, and calls `this.#lookup(new WordLang(this.searchbarValue(), langConfig.targetLang))` — this is the fallback that runs the full variation-generator-backed lookup on the typed term
4. `#searchLocal()` calls `langConfig.variationGenerator.getWordVariations('dibakar')`:
   - `["dibakar", "membakar", "bakar", "mbakar"]`
   - "dibakar" = original (passive: "was burned")
   - "membakar" = active voice form (meN- + bakar, where 'b' initial → mem-)
   - "bakar" = bare root
   - "mbakar" = harmless over-generation: `membakar` with the **bare** `me-` stem sliced off (the "bare me-/pe- + nasal-initial root" candidate in `nasalCandidates()`, meant for genuinely nasal-initial roots like `menganga` → `nganga`). It matches nothing in IDB, so it costs one wasted lookup and no more (see [5.7 Failure modes and the best-effort contract](#57-failure-modes-and-the-best-effort-contract)).
5. Iterates variations, querying IDB for each:
   - `findByWordAndLang('dibakar', 'id')` → `[]` (passive forms rarely indexed)
   - `findByWordAndLang('membakar', 'id')` → lemmas found — **iteration stops**: "bakar" and "mbakar" remain unqueried.
6. **Result**: Returns all lemmas for "membakar" (the found base), including compounds, full definitions

### 4.3 Path 3: Recent Search / Breadcrumb Click

1. User clicks "dibakar" from the breadcrumb list (from a previous Path 2 search)
2. `lookup({word: 'dibakar', lang: 'id'})` is called → same path as Path 2
3. The variation generator produces variations and IDB search proceeds as in Path 2
4. **Result**: Same as Path 2 — full "membakar" entries returned

---

## 5. Indonesian Variation Generator

**File**: `indonesian-variation-generator.ts` (implements the `VariationGenerator` interface from `variation-generator.ts`)

> **The morphology and design rationale now live in the linguist-facing guide: [How search works](../../../../../docs/docs/how-search-works.md).** That page is the source of truth for the affix system (suffixes, prefixes, `meN-`/`peN-` nasalisation, circumfixes, reduplication), the "generate many candidates, let the dictionary be the judge" strategy, three worked examples, and why a stemmer is the wrong tool for lookup (but the right tool for a future content-search feature). This section keeps only the implementation details that matter when working on the code.

### 5.1 Lookup behaviour

The variation generator recursively strips affixes from a word, building a set of candidate forms in recursion (pre-order) order: the original first, then the forms reached by stripping affixes depth-first. It is **not** a ranked best-first list. There are two deliberate ordering choices, both placing a reconstructed active `meN-` form _before_ the bare root: a stripped `di-` passive yields its active (`diambil` emits `mengambil` before `ambil`), and a reduced `-kan`/`-i` form yields its active (`bacakan` emits `membacakan` before `baca`, preserving the `-kan` sense rather than collapsing to the root); see [5.3.2 Generation Order (worked trace)](#532-generation-order-worked-trace) below for the exact traversal. `DictionaryService.#searchLocal()` iterates this array, calling `DictStoreService.findByWordAndLang(w, lang)` for each, and **stops at the first variation that yields keyword-flagged lemmas** (`keyword === 1`). Remaining variations are not queried.

**Key design principle**: generate a set of plausible candidates rather than a single canonical root. Extra candidates (false positives) just cost one extra IDB lookup each; missing the actual match (a false negative) costs the user their answer.

### 5.2 Word Exemptions

Certain common words are not expanded into variations because they don't follow standard patterns or are already base forms:

- `aku` (I)
- `ilmu` (knowledge)
- `kamu` (you)
- `tamu` (guest)
- `temu` (meet)
- `dia` (he/she)
- `bukan` (not)
- `ini` (this)
- `nyanyi` (sing)
- `ngaji` (study/recite Islamic texts)

### 5.3 Implementation Details

#### 5.3.1 Recursive Variation Building

The variation generator walks a single ordered list of rules (`RULES`), recursing into the form(s) each matching rule produces. The rules come in three shapes — `strip` (peel an affix, recurse into the remainder), `synthesize` (reconstruct the active `meN-` form), and `nasal` (undo meN-/peN- assimilation via the shared `nasalCandidates()`) — declared as data and dispatched by a small `switch` in `getVariations`:

```
getVariations(word) {
  add(word)

  for (rule of RULES) {            // RULES is one ordered pipeline; order == lookup priority
    strip:      if word matches rule.pattern -> getVariations(remainder)
    synthesize: if !mePrefixed && word matches -> getVariations(prefixWithMeN(base))
    nasal:      for cand of nasalCandidates(word, rule.stem) -> getVariations(cand.remainder)
  }
}
```

This ensures that multi-affix words (e.g., `kebaikan` = `ke-` + `baik` + `-an`) eventually generate the root through multiple stripping steps.

#### 5.3.2 Generation Order (worked trace)

The output order is not a ranked "best first" list; it is the **pre-order traversal of the recursive stripping**, deduplicated by a `Set`. Each call does `variations.add(word)` _before_ walking the rules, so a node is recorded ahead of its children, and the `Set` preserves first-insertion order.

Tracing `getWordVariations('kepunyaanku')`:

```
kepunyaanku                              #1
├─ strip -ku ─────────► kepunyaan        #2
│   ├─ strip -an ─────► kepunya          #3
│   │   ├─ strip -nya ► kepu             #4
│   │   │   └─ strip ke- ► pu            #5
│   │   └─ strip ke- ──► punya           #6
│   ├─ strip ke- ─────► punyaan          #7
│   └─ strip ke-…-an ─► punya            (dup)
└─ strip ke- ─────────► punyaanku        #8
```

Output: `[kepunyaanku, kepunyaan, kepunya, kepu, pu, punya, punyaan, punyaanku]`.

Two things this makes clear, both easy to misread from the flat list:

1. **Nothing is added here; it is pure stripping.** `punya`, `punyaan`, and `punyaanku` are not the root with suffixes re-attached. They are the `ke-` prefix stripped off `kepunya`, `kepunyaan`, and `kepunyaanku` respectively, emitted as the recursion unwinds. There is **no rule anywhere in the generator that appends a suffix.** The bare root `punya` lands at position 6, _ahead_ of the longer `punyaan`/`punyaanku`, purely because of traversal order, not because it is treated as a low-priority fallback.

2. **The only affixes the generator ever _adds_ are `meN-`/`peN-` prefixes and restored dropped consonants**, in three places: rebuilding the active form after stripping `di-` (the `di- -> meN-` synthesis rule, via the shared `prefixWithMeN()`); reconstructing the active `meN-` form of a reduced `-kan`/`-i` word that does not start with `m` (the `-kan/-i -> meN-` synthesis rule, `prefixWithMeN()` again, which runs before the bare-root strips so it too is emitted first); and the `'k'+rest` / `'s'+rest` / `'p'+rest` / `'t'+rest` consonant restoration done by the shared `nasalCandidates()`. Both helpers live in `indonesian-nasal-rules.ts` — `prefixWithMeN()` (root -> surface) and `nasalCandidates()` (surface -> root) are the two inverse directions of the same meN- allomorphy. This prefix synthesis is the entire reason a passive like `dibakar` resolves to the indexed active `membakar` (and a reduced `bacakan` to `membacakan`).

So there are exactly **two deliberate ordering decisions** in the whole generator, and they are siblings: the `di-` synthesis rule (recursing into the rebuilt `meN-` form _before_ the bare root — its `alsoBare` recursion) and the `-kan`/`-i` synthesis rule (reconstructing the active `meN-` form, positioned ahead of the suffix strips that reach the bare root), each emitting the more-likely-wanted active form first. Everywhere else, the order is simply the sequence in which the strip rules happen to fire.

#### 5.3.3 Trace logging (dev aid)

Trace output is gated behind the `taalwiz.trace-variations` localStorage flag, read as a verbosity level so it is off (and zero-cost) by default. In the DevTools console:

```js
localStorage.setItem('taalwiz.trace-variations', '1'); // flat variations line only
localStorage.setItem('taalwiz.trace-variations', '2'); // + the recursion tree
localStorage.removeItem('taalwiz.trace-variations');   // disable
```

At level `1`, each target-language lookup logs the flat `word -> [...]` line (with the matched variation flagged `=`). At level `2`, `getWordVariations()` additionally prints the actual recursion (rule label ► produced form). Each form is numbered `#N` by its slot in the returned array; `(dup)` marks a repeat of a form already numbered higher up. A meN-/peN- nasal strip that restores an elided root consonant annotates it as `+<letter>` (e.g. `nasal men- +t ► terima`, `nasal mem- +p ► potong`), surfacing the `nasalCandidates()` restoration. For example `dibakar`:

```
dibakar  #1
├─ di- -> meN- ► membakar  #2
│  ├─ nasal mem- ► bakar  #3
│  └─ nasal me- ► mbakar  #4
└─ di- -> meN- (bare root) ► bakar  (dup)
→ [dibakar, membakar, bakar, mbakar]
```

This is the live counterpart of the [5.3.2 Generation Order (worked trace)](#532-generation-order-worked-trace) above — it makes over-generated forms like `mbakar` (the bare `me-` strip) and the dedup behaviour visible.

**Each new form is drawn at its true point of first creation.** The generator re-enters already-seen forms (a `di-`/`-kan/-i` synthesis rebuilds a longer form, which then strips back down), and a brand-new form can be _born_ inside one of those repeated branches. The trace records the full recursion and prunes at render time: a first-occurrence node shows all its children, but a repeated node is kept only when its subtree still introduces a new form — and then only the birth-bearing children are drawn. So the `#N` labels read straight down with no gaps. `berikan` shows this: `ikan` is first created by re-stripping a _repeated_ `berikan`, so it appears as `#15` under that branch (not later, at the top-level `ber-` strip, which is then a `(dup)`). It also shows the `ber-`/`be-` allomorph strip (`indonesian-ber-rules.ts`) firing alongside the plain `ber-` strip wherever the remainder is r-initial (`beri`, `berik`, `berikan` all qualify), each producing its own sibling candidate (`ri`, `rik`, `rikan`):

```
berikan  #1
├─ -kan/-i -> meN- ► memberikan  #2
│  ├─ strip -kan ► memberi  #3
│  │  ├─ strip -i ► member  #4
│  │  │  ├─ nasal mem- ► ber  #5
│  │  │  └─ nasal me- ► mber  #6
│  │  ├─ nasal mem- ► beri  #7
│  │  │  ├─ strip ber- (be-) ► ri  #8
│  │  │  └─ strip -i ► ber  (dup)
│  │  └─ nasal me- ► mberi  #9
│  │     └─ strip -i ► mber  (dup)
│  ├─ strip -an ► memberik  #10
│  │  ├─ nasal mem- ► berik  #11
│  │  │  ├─ strip ber- ► ik  #12
│  │  │  └─ strip ber- (be-) ► rik  #13
│  │  └─ nasal me- ► mberik  #14
│  ├─ nasal mem- ► berikan  (dup)
│  │  ├─ strip ber- ► ikan  #15
│  │  └─ strip ber- (be-) ► rikan  #16
│  │     ├─ strip -kan ► ri  (dup)
│  │     └─ strip -an ► rik  (dup)
│  └─ nasal me- ► mberikan  #17
│     ├─ strip -kan ► mberi  (dup)
│     └─ strip -an ► mberik  (dup)
├─ strip ber- ► ikan  (dup)
├─ strip ber- (be-) ► rikan  (dup)
├─ strip -kan ► beri  (dup)
└─ strip -an ► berik  (dup)
→ [berikan, memberikan, memberi, member, ber, mber, beri, ri, mberi, memberik, berik, ik, rik, mberik, ikan, rikan, mberikan]
```

The flat `word -> [...]` line (with the matched variation flagged `=`) is logged by `DictionaryService.#logVariations()` at level `1`; the tree above it needs level `2`. The full-recursion bookkeeping and the prune are paid only at level `2` — at lower levels the production path builds no trace nodes — and never change the returned variations.

#### 5.3.4 mePrefixed Flag

The `mePrefixed` parameter guards **both** `synthesize` rules (`if (mePrefixed) break`), not just the `di-` one: the `di- -> meN-` rule and the `-kan/-i -> meN-` rule. Once either has rebuilt an active `meN-` form, the flag stops the other synthesis rule from firing again inside that branch — without it, a passive/reduced form that matches both rule shapes could double-synthesize. See [5.3.2 Generation Order (worked trace)](#532-generation-order-worked-trace) above for where both synthesis sites actually fire.

#### 5.3.5 Multiple Candidate Restoration

When a consonant is dropped during affixation (e.g., `p` in `memotong` from `potong`), the variation generator generates both the stripped form (`otong`) and the restored form (`potong`). `#searchLocal()` queries IndexedDB for both, and if either matches, the lookup succeeds.

### 5.4 Testing

Automated tests are located in `indonesian-variation-generator.spec.ts` and cover word exemptions, suffix stripping, prefix stripping, meN- variants, peN- variants, circumfixes, reduplication, multi-affix words, deduplication, and the documented examples from this document.

#### 5.4.1 Running the Tests

Run the Vitest test suite for the Angular app:

```bash
# One-time run
pnpm --filter web run test

# Or with watch mode for development
pnpm --filter web run test:watch
```

The test file uses a helper function `variations(word)` to generate variation generator output and validates the results with `.toEqual()` and `.toContain()` assertions.

#### 5.4.2 Manual Verification

You can also verify the variation generator manually in the browser console:

```typescript
const variationGenerator = new IndonesianVariationGenerator();
const vars = variationGenerator.getWordVariations('membaca');
console.log(vars.includes('baca'));  // true
console.log(vars.includes('membaca'));  // true
```

Key test cases:
- `membaca` should include `baca`
- `mengambil` should include `ambil`
- `diambil` should include `ambil` and `mengambil`
- `makanan` should include `makan`
- `berbicara` should include `bicara`
- `kebaikan` should include `baik`
- `perjalanan` should include `jalan`
- `penulis` should include `tulis`

#### 5.4.3 Tracing a Lookup Against the Compiled Dictionary

To see the full generate-and-test sequence against the **production** compiled Teeuw index (not just the generator in isolation), run the compiler's trace tool:

```bash
pnpm --filter compiler run trace dibakar kepunyaanku diinstal
```

It reuses the production variation generator and the compiled dictionary, so its per-candidate hit/miss output is exactly what the app does at runtime. This is the tool that produces the worked examples in the [guide](../../../../../docs/docs/how-search-works.md#worked-examples).

### 5.5 Critical Affixes for Coverage

The affixes that matter most for coverage are `di-` (passive forms are common but often not indexed, so the rebuilt active `meN-` form is the real win), `meN-` itself, `-an`, `ber-`, and `peN-`. Particle suffixes (`-kah`, `-lah`, `-tah`, `-pun`) and personal clitics (`-ku`, `-mu`, `-nya`) are stripped because they are grammatical markers that obscure the semantic word. See the [guide](../../../../../docs/docs/how-search-works.md) for the full affix breakdown.

### 5.6 Scope: productive morphology only (why there is no infix rule)

The generator deliberately handles only **productive** affixation (`di-`, `meN-`, `ber-`, `ter-`, `per-`, `se-`, `ke-`, `-kan`, `-i`, `-an`, the circumfixes, clitics, and full reduplication). It has **no rule for infixes** (`-em-`, `-el-`, `-er-`), and that is correct by design, not an oversight.

Infixation is unproductive: only a closed, limited set of infixed forms exists, they are no longer felt to contain an affix, and so dictionaries list them as separate headwords from their bases (Sneddon, _Indonesian: A Comprehensive Grammar_, §1.36). Teeuw is no exception — `gerigi`, `seruling`, `telapak`, `telunjuk`, `gemetar` are each indexed as their own keywords, alongside their bases `gigi`, `suling`, `tapak`, `tunjuk`, `getar`.

The consequence for lookup: a typed infixed form **self-hits on candidate #1** (the original, unmodified word), so no stripping is ever needed to resolve it. A `-em-` stripping rule would only emit junk candidates (e.g. `getar` from `gemetar`) that the already-found `gemetar` keyword made unnecessary. The same reasoning covers lexicalised partial reduplication (`lelaki`, `tetangga`, `sesama`): a closed set, listed directly, resolved on #1.

This sharpens the division of labour: **productive morphology is generated** (its forms are too numerous for a dictionary to list), **unproductive morphology is indexed** (the closed set is listed outright). The boundary the generator draws is exactly the boundary productivity has already drawn in the dictionary, which is why there is no gap between them.

### 5.7 Failure modes and the best-effort contract

The generator is a **best-effort** helper, not a guarantee. Because `#searchLocal()` validates every candidate against the dictionary, a generated non-word that matches nothing is free — it costs one extra IndexedDB lookup and no more. Validation leaves exactly two failure modes it cannot catch:

1. **Silent miss** — the correct keyword is never generated, so there is nothing to validate and the user gets "no result." This is acceptable: it degrades gracefully to manual lookup (the user finds the base form themselves, as with a paper dictionary). Within the generator's scope (productive morphology) these are rare; the unproductive cases are indexed and self-hit (see [5.6 Scope: productive morphology only (why there is no infix rule)](#56-scope-productive-morphology-only-why-there-is-no-infix-rule)).

2. **Wrong hit** — a generated candidate is a real but _unrelated_ keyword, reached before the intended one. Teeuw confirms "yes, that's a word" and the wrong entry is returned. This is the only way the generator can actively mislead, and it is the one failure the best-effort contract does **not** excuse: a best-effort tool may return nothing, but it must not confidently return the wrong thing.

Wrong hits are bounded by two facts, though not eliminated:

- **The original typed form is always candidate #1.** Teeuw is root-organised and indexes many derivations as sublemma-keywords, so most inflected forms a learner actually types are themselves keywords and self-hit on #1 with the correct entry, before any stripped candidate is queried.
- **The `di-` and `-kan`/`-i` → active `meN-` ordering** (the rebuilt active form is emitted before the bare root) puts the more-likely-wanted form first.

The residual risk lives in **over-stripping with weak guards** (`-i` strips any final _i_ from a 2-character-plus stem; `-an`/`-kan` similar — see Limitation 1 below). If a typed form is _not_ itself indexed and an over-strip coincidentally lands on an unrelated keyword before the correct one, the result is a confidently-wrong entry. Tighter length/shape guards on strips would shrink this surface (see Future Improvements). The over-generation noise itself is harmless; only this coincidental-real-word case is not.

#### 5.7.1 Minimum candidate length (the 2-char floor)

Recursion into a **produced** candidate is floored at 2 characters (`MIN_CANDIDATE_LENGTH` in `indonesian-variation-generator.ts`): a 0- or 1-char form is dropped outright, never added to the result Set nor traced. This kills pure leakage like the empty string (nasal-stripping `meng` → ``) and single letters (`k`, `ng`) that the deeper recursion used to emit — most visibly for a monomorphemic word such as `kemudian`, whose spurious decomposition through the unrelated `kemudi`/`mengemudi` family bottomed out in `''`/`k`/`ng`. The forms are harmless to lookup (they match nothing) but look broken in the trace, so they are suppressed at the source.

The floor is **2, not higher**, and this is load-bearing: genuine 2-letter roots that carry derivations exist in Teeuw — `am` (`mengamkan`, _pada amnya_), `es` (`menges`, _esnya_), `ia` (`mengiakan`, `beria`, _ianya_) — so a derived/clitic form must still be able to reduce to its 2-letter root. A floor of 3 would silently break those lookups. The typed word itself bypasses the floor (it is always candidate #1), so even a sub-2-char query still self-hits; only derived candidates are floored.

#### 5.7.2 Which nonsense candidates actually get queried

A tempting overstatement is "the nonsense forms are never searched." Not quite. `#searchLocal()` stops at the **first** keyword hit, so candidates _after_ the winner are never queried — but a nonsense candidate sitting _before_ the winner does get its one (empty) IndexedDB lookup. The over-generation is free either way (a non-word matches nothing), but "free" means "costs one wasted lookup," not "skipped."

Only one ordering pattern actually places nonsense ahead of a valid root: the `meN-` strip of a root whose initial consonant **elides** (p/t/s/k). `nasalCandidates()` emits the bare remainder before the consonant-restored root, so the un-restored vowel-initial fragment lands one slot earlier:

| typed | candidate order | nonsense ahead of the valid root |
| --- | --- | --- |
| `menulis` | `[menulis, ulis, tulis, nulis]` | `ulis` (#2) before `tulis` (#3) |
| `memotong` | `[memotong, otong, potong, motong]` | `otong` before `potong` |
| `mengirim` | `[mengirim, irim, kirim, ngirim]` | `irim` before `kirim` |

In practice these `meN-` forms are themselves sublemma-keywords, so the typed word **self-hits on #1** and `ulis`/`otong`/`irim` are never queried (e.g. `menulis -> ['=menulis', 'ulis', 'tulis', 'nulis']` — only `menulis` is looked up). The fragment only reaches IndexedDB when the typed form is _not_ indexed, in which case it misses and the search moves on to the real root one slot later.

The two other junk sources are always emitted **after** the valid root, so they are never queried ahead of it: the consonant-restored form of a true vowel-initial root (`mengambil → kambil`, after the valid `ambil`) and the bare-stem `slice(2)` form (`membakar → mbakar`, `menulis → nulis`, pushed last).

### 5.8 Limitations & Design Tradeoffs

1. **Over-stripping**: Some generated variations may not be real words (e.g., `terbang` → `bang`). This is acceptable because false variations just create extra IndexedDB lookups; they don't break lookups. The lookup simply won't find a match for them.

2. **Ambiguous restoration**: When consonants are dropped during affixation (e.g., `potong` + `meN-` → `memotong`), we generate multiple candidates (`potong`, `otong`). Not all may be valid, but the IndexedDB lookup will find valid matches if they exist.

3. **No single canonical root**: The variation generator generates a set of plausible forms rather than morphologically analyzing to a unique root. This is simpler to implement and works well for dictionary lookup without requiring advanced linguistic analysis.

4. **Indonesian-specific**: This variation generator is tailored for Indonesian morphology and won't work for other languages.

5. **Dictionary-dependent**: The variation generator's effectiveness depends on what forms are indexed in the compiled dictionary (synced to IndexedDB). If the dictionary doesn't have certain base forms, variation generation to them won't help. Conversely, if it indexes many inflected forms, minimal variation generation may suffice.

6. **Variation order matters**: Since `#searchLocal()` stops searching after the first match, the order in which variations are generated affects both accuracy and performance. More commonly-indexed forms should ideally appear earlier. For example, for `diambil`, generating `mengambil` before `ambil` is beneficial because active forms are more likely to be indexed than passive base forms.

### 5.9 Future Improvements

- **Expand word exemptions list based on user feedback** — Common words that don't follow standard morphological patterns (e.g., `aku`, `ilmu`, `bukan`) are currently hardcoded; this list can grow as users encounter words that produce incorrect or unnecessary variations.

- **Add more sophisticated consonant restoration heuristics** — The current restoration rule (in the shared `nasalCandidates()`, `indonesian-nasal-rules.ts`) uses a guard `/^[gh]/` on the stripped remainder to decide whether to attempt `k`-restoration for `meng-` prefixes. It restores `k` for both vowel-initial rests (`mengumpul` → `rest='umpul'` → `kumpul`, since `meng-` elides a root-initial `k`) and consonant-initial rests (`mengritik` → `rest='ritik'` → `kritik`), and blocks it only for `g`/`h`-initial rests (the genuinely non-eliding allomorphs, `menggali` → `gali`). This over-generates a harmless spurious form for true vowel-initial roots (`mengambil` → `kambil`, which matches no entry). More sophisticated heuristics could improve precision by: (i) tighter consonant-dropping guards to exclude cases like `mengkritik` (malformed input), and (ii) tighter shape guards on the elision restoration. (A blanket minimum-length filter is _not_ a viable lever beyond the 2-char floor already in place — see [5.7.1 Minimum candidate length (the 2-char floor)](#571-minimum-candidate-length-the-2-char-floor). Raising it to ≥ 3 would drop genuine 2-letter roots that derive, e.g. `am`/`es`/`ia`, so it cannot be tightened without losing real lookups.)

- **Add configurable stripping depth to trade recall for precision** — Currently the variation generator recursively strips all possible affixes. For some use cases, stopping after stripping just the most common affixes (e.g., person markers, `-nya`, tense markers) might improve precision by avoiding over-generated false positives, at the cost of lower recall for heavily affixed words.

> **Why this module is not, and should not become, a stemmer** (Nazief–Adriani / Sastrawi) is covered in the [guide](../../../../../docs/docs/how-search-works.md#why-not-a-stemmer): in short, a stemmer commits to a single root, whereas this module also generates the sideways forms (passive `dibakar` → active `membakar`) the dictionary actually indexes. The real home for a stemmer is a future free-text content search, not lookup.

---

## 6. Results Display & Grouping

**Files**: `dictionary.service.ts`, `dictionary.page.html`, `lemma.component.ts`

### 6.1 Result Structure

The service returns a `LookupResult`:

```typescript
interface LookupGroup {
  base: WordLang;  // The group's base word
  lemmas: Lemma[]; // All lemmas under that base
}

class LookupResult {
  groups: LookupGroup[] = []; // One entry per unique base, ordered by reorderLookupResult

  // The word originally typed/searched. Required and readonly, so no reader
  // needs a null check: a result, found or not, is always about some word.
  constructor(readonly target: WordLang) {}
}
```

### 6.2 Grouping by Base

All lemmas in the lookup response are grouped by their `baseWord`:

```typescript
// In makeLookupResult:
const groupsByKey = new Map<string, LookupGroup>();
for (const lemma of response.lemmas) {
  const base = new WordLang(lemma.baseWord, lemma.baseLang); // key e.g. "membakar:id"
  let group = groupsByKey.get(base.key);
  if (!group) {
    group = { base, lemmas: [] };
    groupsByKey.set(base.key, group);
    newResult.groups.push(group);
  }
  group.lemmas.push(lemma);
}
```

If the lookup returns 10 lemmas all with `baseWord: "membakar"` and `baseLang: "id"`, there will be one group in `groups` — `{ base: WordLang("membakar", "id"), lemmas: [...all 10] }`.

### 6.3 Display in Template

The template iterates `visibleGroups()` — not `results.groups` directly. `visibleGroups()` (`dictionary.page.ts`) is a `computed` that filters `results.groups` down to groups with at least one lemma visible at the current detail tier (see [9.2 Keyword Flag](#92-keyword-flag) below), so a group whose only content is hidden below the current tier never renders an empty card. For each group in `visibleGroups()`, the template displays:
1. **Card header** (only for first group, `isFirst`): Shows the base word as the main heading
2. **Card content**: Renders `app-lemma` component with `group.lemmas`
3. **Button**: Shows the base word again (allows clicking to re-search that base)

---

## 7. Recent Searches & Breadcrumb List

**Files**: `dictionary.page.ts`, `dictionary.page.html`, `search-history.service.ts`

### 7.1 Storage

Search history is owned by `SearchHistoryService`, which persists it to Capacitor `Preferences` (key `taalwiz.search-history`) so it survives reloads. The service keeps up to `MAX_HISTORY` (50) entries, each `{ word, lang, searchedAt }`, most-recent first.

Every `add()` call awaits an internal `#ready` promise (resolved once `#loadFromPreferences()` finishes) before touching `history`. This closes a startup race: an `add()` fired before the async preference load populated the signal would otherwise compute its "existing history" from an empty array and persist just the one new entry, silently wiping everything previously stored — a real bug this used to hit on cold start.

A new lookup result reaches history through `#recordHistory()`, called from the `#results$` tap (`dictionary.page.ts`):

```typescript
#recordHistory(results: LookupResult): void {
  const suppressHistoryAdd = this.#breadcrumbClicked;
  this.#breadcrumbClicked = false;
  if (results.groups.length > 0 && !suppressHistoryAdd) {
    this.#addRecentSearch(results.target);
  }
}
```

`results.target` is the **typed word** (not the found base) — user types "dibakar" → stored as "dibakar", even though the results are for "membakar".

#### 7.1.1 Breadcrumb clicks don't re-add to history

`onBreadcrumbClicked()` sets `#breadcrumbClicked = true` immediately before calling `#lookup()`; `#recordHistory()` reads and clears that flag on the very next result. This means clicking an *existing* breadcrumb entry is treated as back-navigation within the trail, not a fresh search: the word stays in its current position in the breadcrumb list instead of jumping back to the most-recent (rightmost) slot. Every other lookup path — typing + Enter, clicking a suggestion, clicking a base, tapping a word in-text, picking from the history modal — leaves the flag `false` and records normally.

### 7.2 Most-Recent-First Ordering

`SearchHistoryService.add()` deduplicates and promotes to the front:

```typescript
add(word: string, lang: string): void {
  void this.#ready.then(() => {
    const entry: HistoryEntry = { word, lang, searchedAt: new Date().toISOString() };
    const filtered = this.history().filter((e) => !(e.word === word && e.lang === lang));
    const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
    this.history.set(updated);
    this.#save(updated);
  });
}
```

**Behavior**:
- Any existing entry for the same word+lang is removed and the word is re-inserted at the front, so re-searching a word **does** move it to the most-recent position (unless that search came from a breadcrumb click — see above).
- New words are prepended.
- The stored history is capped at 50 entries (oldest dropped).

### 7.3 Breadcrumb Display

The `recentSearches` signal is a `computed` derived from the stored history — it takes the first `MAX_RECENT_SEARCHES` (3) entries and `reverse()`s them, so the breadcrumb shows up to 3 words oldest-on-the-left, most-recent-on-the-right. A separate `hasMoreHistory` computed is `true` when more than 3 entries are stored, driving the header button that opens the full `HistoryModalComponent`.

### 7.4 Visibility

The breadcrumb list is only visible when there are 2+ recent searches:

```html
@if (recentSearches().length > 1) {
  <ion-breadcrumbs>...</ion-breadcrumbs>
}
```

### 7.5 Bold Styling (Current Word)

The breadcrumb word that matches the currently displayed results is shown in bold:

```html
[ngClass]="{'active-breadcrumb': wordLang.key === currentTarget()?.key}"
```

`currentTarget` is a `computed`, not something set imperatively — it derives straight from the `results` signal:

```typescript
protected currentTarget = computed(() => this.results()?.target ?? null);
```

`results` itself is `toSignal(this.#results$)`, so `currentTarget` recomputes automatically whenever a new lookup lands; there's no separate assignment to keep in sync. So if the user searched "dibakar" and the results are for "membakar" entries, "dibakar" in the breadcrumb is bold.

---

## 8. Example Flow: Complete Walkthrough

### 8.1 Scenario: User types "dibakar" and presses Enter (no autocomplete match)

1. **Keystroke detection**: The `ionViewWillEnter()` keyup listener sees no literal suggestion for "dibakar" (`suggestions.length === 0` on the freshly-fetched, Enter-branch array — see [3. Autocomplete Suggestions & the Keyup Pipeline](#3-autocomplete-suggestions--the-keyup-pipeline))
2. **Enter handling**: `this.#lookup(new WordLang('dibakar', 'id'))` is called → `DictionaryService.lookup()` → `searchDictionary()`
3. **Variation generation**: `langConfig.variationGenerator.getWordVariations('dibakar')` generates `["dibakar", "membakar", "bakar", "mbakar"]` (the trailing `mbakar` is harmless over-generation; see [4.2 Path 2: Manual Entry Without Autocomplete (no match)](#42-path-2-manual-entry-without-autocomplete-no-match))
4. **IDB lookup**: `#searchLocal()` iterates variations:
   - `findByWordAndLang('dibakar', 'id')` → `[]` (passive forms rarely indexed)
   - `findByWordAndLang('membakar', 'id')` → **found** — returns lemmas with `word: "membakar"`, `baseWord: "bakar"`
5. **Result processing**:
   - `makeLookupResult()` groups by baseWord: `groups[0].base = {word: "bakar", lang: "id"}`
   - BUT all lemmas have actual `word: "membakar"` — the 10+ entries for "membakar" (main def + compounds)
   - `results.target = {word: "dibakar", lang: "id"}` (the typed word)
   - This `LookupResult` is pushed through `#lookupResult$`, which `#results$` filters/taps and `results = toSignal(this.#results$)` turns into a signal — everything downstream (steps 6-9) is a `computed` or a tap reacting to that one signal update, not separate imperative steps
6. **Breadcrumb update**: the `#results$` tap calls `#recordHistory(results)`, which (since this wasn't a breadcrumb click, so `#breadcrumbClicked` is `false`) calls `#addRecentSearch({word: "dibakar", lang: "id"})`, adding "dibakar" to recent searches
7. **Bold styling**: `currentTarget`, a `computed(() => this.results()?.target ?? null)`, now evaluates to `{word: "dibakar", lang: "id"}` — "dibakar" in the breadcrumb renders bold
8. **Clear field**: the same tap calls `searchbarValue.set('')`, clearing the search field
9. **Display**: Template shows all 10+ lemmas for "membakar" grouped under the "bakar" base
10. **Subsequent search**: User types "air" and presses Enter
    - This time the Enter branch's fresh suggestion fetch **does** find a literal match for "air"
    - `onSuggestionClicked({word: "air", lang: "id"})` is called directly (not the no-suggestion fallback) → `lookup()` → `searchDictionary()` → `#searchLocal()`
    - Variation generator generates `["air"]`
    - IndexedDB returns all lemmas for "air"
    - Breadcrumb now shows: "dibakar" (dimmed) / "air" (bold)
11. **Click breadcrumb**: User clicks "dibakar" in breadcrumb
    - `onBreadcrumbClicked()` sets `#breadcrumbClicked = true`, then calls `#lookup({word: "dibakar", lang: "id"})`
    - Routes through `searchDictionary()` → `#searchLocal()` again (same as step 2)
    - Returns the same "membakar" entries (full results)
    - `#recordHistory()` sees `#breadcrumbClicked === true`, clears it, and **skips** re-adding "dibakar" to history — it stays in its current breadcrumb position rather than jumping to the most-recent slot
    - "dibakar" is bold again (same `currentTarget` computation as step 7)

---

## 9. IndexedDB Lookup Notes

**File**: `dict-store.service.ts` (read-only) — the schema and `transformDict()` live in `dict-db.ts`; the import itself runs off the main thread in `dict-import.worker.ts` as a single atomic readwrite transaction. Search reads remain on the main thread against the shared `taalwiz-dict` database. See [ARCHITECTURE.md → Dictionary](../../../../ARCHITECTURE.md#7-dictionary-offline-first) for the full sync flow and worker rationale.

### 9.1 Variation Iteration

`DictionaryService.#searchLocal()` iterates the variation generator's variation array and calls `DictStoreService.findByWordAndLang(w, lang)` for each. It stops at the first variation that returns keyword-flagged lemmas (`keyword === 1`).

```typescript
// `result` starts as the empty "not found" LookupResult(target).
for (const w of words) {
  const lemmas = await this.#dictStore.findByWordAndLang(w, target.lang);
  if (lemmas.some((l) => l.keyword === 1)) {
    foundWord = w;
    result = makeLookupResult({ word: w, lang: target.lang, lemmas }, target);
    break;
  }
}
```

`foundWord` is the matched *variation*, which nothing on the result records — `groups[].base` is the lemma's base and `target` is the word searched — so it is kept for the dev trace (`#logVariations`, see [5.3.3 Trace logging (dev aid)](#533-trace-logging-dev-aid)).

### 9.2 Keyword Flag

`DictStoreService.findByWordAndLang()` accepts an optional `keywordOnly` boolean:
- `keywordOnly=true`: returns only lemmas where `keyword === 1` (used by the word-click-modal)
- `keywordOnly=false` (default): returns all lemmas regardless of keyword

The dictionary page search passes `keywordOnly=false`, so the store returns _all_ lemmas
that mention the word, including its appearances as a usage inside other headwords
(`ékor` inside `ékor angin`).

`Lemma.keyword` is **required**, so every read is a plain `=== 1`. The absent-value default
lives at the single write boundary instead: `CompiledWord.keyword` is optional (the downloaded
JSON is untrusted at runtime — nothing validates an asset against the interface), and
`transformDict` writes `wordDef.keyword ?? 1`. Defaulting to 1 means a malformed asset degrades
to "shown" rather than "silently hidden from search"; the SQLite builder
(`compiler/src/db/build-databases.ts`) defaults the same direction for the same reason.

The type is `0 | 1`, not `boolean`, because it is a **stored IndexedDB field**: booleans are not
valid IDB keys, so a boolean could never join a compound index — ruling out a future
`['lang', 'wordLower', 'keyword']` that would push the `keywordOnly` filter into the index
instead of the post-fetch `.filter()`. SQLite has no boolean type either (`is_keyword INTEGER`).
A real `isKeyword: boolean` would need a mapping layer at the store boundary, costing the
`DictRecord = Lemma & { wordLower }` identity; `0 | 1` is two-valued without one.

**Display-time detail tiers.** Fetching everything but *showing* a chosen level of detail is
a view concern, kept out of the store so the full set stays available. The dictionary page
has a global two-tier control (`DictionaryPage.detailLevel`, default `keywords`) driven by a
header **more/less button** (desktop shortcut: **F2**, via a `@HostListener('document:keydown.f2')`
on `DictionaryPage` that acts whenever there are results and works even while the searchbar has
focus, since F2 emits no character into it). The button **toggles** `keywords` ⇄ `all`, its label
tracking the tier (`more` at `keywords`, `less` at `all`). The toggle is **non-persistent**: a
new search resets the tier to `keywords` (`results$` in `dictionary.page.ts`), so every lookup
starts collapsed. The button is shown whenever there are results:

- `keywords` — the entry's own senses **and** its derived sub-headwords (`berékor`, `mengékor`
  under `ékor`); the default view
- `all` — adds the italic example usages and cross-reference cards

One input is a per-line **`lineKind`** (`'headword' | 'derived' | 'usage'`) computed at
**import time**, not from the rendered text. `dict-db.ts` `classifyLine()` reads the parser's
structured keyword roles in `words[]` — a line with no source-language `keyword === 1` word is
a `usage`; one whose source keyword is the entry's `base` is a `headword`; any other source
keyword makes it `derived`. The common `headword` is omitted from the stored record (read back
as the default), like `isSupplement`.

But `lineKind` is relative to the line's **own** base, which is not enough on its own: the
"kumanga" line is kumanga's *headword* line that merely *contains* `barang kumanga` as a usage,
so for a `barang` search it is a cross-reference, not a headword. So `lemmaVisibleAt(lemma, level)`
(`lemma/lemma.model.ts`) ranks each line **relative to the searched word**, combining `lineKind`
with two signals the record already carries — `keyword` (is the searched word the keyword on
this line?) and `word === baseWord` (does the line belong to the word's own entry?). It ranks
each line 0/1/2; `LEVEL_RANK` maps the `keywords` tier to depth 1 (so ranks 0 **and** 1 both
show there) and `all` to depth 2:

- `keyword === 1` → rank 0: the searched word is itself the keyword (its own sense, or a
  derived form searched directly like `memukul`). Shown at `keywords`.
- else `lineKind === 'derived'` **and** `word === baseWord` → rank 1: a derivative of the
  word's own entry. Also shown at `keywords`.
- else → rank 2: a usage, or the word inside another headword (`barang` in `barang kumanga`,
  where `baseWord` is `kumanga`). Shown only at `all`.

`LemmaComponent.displayLemmas` filters lines by `lemmaVisibleAt`, and `DictionaryPage.visibleBases()`
drops a base with no line visible at the current tier — so a cross-reference card (`kumanga`,
`palen`) appears only at `all`, and never renders empty below it.

> Because `lineKind` is computed at import, it only populates after a dictionary re-sync;
> records imported by an older build have no `lineKind` and fall back to `headword`.

### 9.3 Case- and Accent-Insensitive Keys

Lookups are case- **and accent-insensitive**. Each stored record carries a `wordLower` field — the `word` run through `foldKey()` (`dict-db.ts`), which NFD-decomposes, drops combining diacritics (`\p{Mn}`), and lowercases. It is added in `transformDict()`, and both query methods match against the `by-lang-wordlower` compound index `[lang, wordLower]` after folding the query with the same `foldKey()`. The original `word` is preserved (with its casing and accents) for display.

This matters for proper nouns: the dictionary stores headwords with their natural casing (e.g. `Belanda`, the keyword-flagged entry for "the Netherlands"). Without case folding, a lowercase query like `belanda` could never exact-match the capitalized key, so the search would fail even though the word exists. (IndexedDB compares string keys by UTF-16 code unit, and `'B'` sorts before `'b'`.) Accent folding matters for Stevens, whose headwords carry an acute accent as a pronunciation aid (`boléh`): typing `boleh` folds to the same key and finds it.

The IDB schema (version 4) defines a single index, `by-lang-wordlower`. Both lookup methods use it, so there are no unused indexes to maintain — keeping per-record write cost low during the bulk import of the full dictionary (~260k word records for Teeuw, ~570k for Stevens).

### 9.4 Exact Match

The IDB query uses `IDBKeyRange.only([lang, foldKey(word)])` on the `by-lang-wordlower` compound index — exact match on `lang` plus the folded (case- and accent-stripped) word. There is no prefix or regex matching at this layer. This is why variation generation is necessary on the client side before querying IDB.

Prefix queries (autocomplete suggestions) fold the prefix with `foldKey()` and use `IDBKeyRange.bound([lang, start], [lang, start + '￿'])` on the same index via `DictStoreService.findWordsStartingWith()`. Results are deduplicated by `wordLower`, so `Belanda` and `belanda` collapse to one suggestion.

---

## 10. Edge Cases & Gotchas

### 10.1 Inflected Words Not in Autocomplete

If a user types an inflected word like "dibakar" that is NOT in the autocomplete index (unlikely, but possible):
- Autocomplete returns no suggestions
- User presses Enter → `searchDictionary()` → `#searchLocal()` is called
- The variation generator produces variations including "membakar" (active form)
- IndexedDB lookup finds "membakar" and returns results ✓

If the user had typed "dibakar" and it WAS in autocomplete:
- User would click the suggestion
- Same route: `lookup()` → `searchDictionary()` → `#searchLocal()` → full results ✓

### 10.2 Word Exists Only as a Compound

Example: "sampah" (trash) might not have its own entry but appears as "membakar sampah" (burn trash) under the "membakar" entry.

If a user searches "sampah":
- Autocomplete might not suggest it (if not indexed as standalone)
- `#searchLocal()` runs the variation generator for "sampah"
- Variation generator strips affixes (none apply to "sampah")
- IndexedDB lookup for "sampah" → not found
- Returns empty results

This is expected behavior — only words (or their variants) indexed in the dictionary are found.

### 10.3 Recent Searches: Stored Word vs. Found Word

The breadcrumb stores **the typed word** (e.g., "dibakar"), not the found base (e.g., "membakar"). This means:

- User sees what they typed in the breadcrumb ✓
- Clicking the breadcrumb re-runs the variation generator and finds the correct base again ✓
- No inconsistency where "membakar" gets bold-highlighted but the breadcrumb shows "dibakar"

### 10.4 A Native-Language Word Only Resolves Through a Literal Suggestion

The no-suggestion Enter fallback (`#lookup(new WordLang(term, langConfig.targetLang))`) always assumes the typed term is target-language (Indonesian) and runs it through the Indonesian variation generator. It has no native-language (Dutch) counterpart. So a word like *"dozijn"* (Dutch, no Indonesian variation match) can **only** be found if the suggestion fetch — which queries both languages — actually returns it before Enter falls through to that fallback. See [3.4 Why Enter re-fetches instead of reading the `suggestions` signal](#34-why-enter-re-fetches-instead-of-reading-the-suggestions-signal) for why this must be a fresh fetch rather than the (possibly stale or empty) dropdown signal.

### 10.5 Enter Picks the Alphabetically-First Suggestion, Not the Best One

When suggestions exist, Enter always calls `onSuggestionClicked(suggestions[0])` — the first entry in the target+native alphabetically-merged array, not a relevance-ranked "best match." A user who types a prefix matching both an Indonesian and a Dutch word and hits Enter before the dropdown renders gets whichever sorts first alphabetically, which may not be the word they meant. Waiting for the dropdown and clicking the intended suggestion avoids this; only the blind type-and-Enter pattern is affected. See [3.5 Suggestion selection & the "first match" pick](#35-suggestion-selection--the-first-match-pick).

---

## 11. Future Improvements

1. **Expand word exemptions**: Some words don't follow standard patterns and are currently hardcoded
2. **Smarter consonant restoration**: Current rules generate some phonetically implausible candidates
3. **Free-text article search (inverted index)**: A future content-search feature would call for a single-root stemmer such as Nazief–Adriani or Sastrawi (see the [guide](../../../../../docs/docs/how-search-works.md#why-not-a-stemmer) for why a stemmer fits content search but not dictionary lookup)
4. **Configurable stripping depth**: Trade recall for precision by limiting affix stripping
5. **Store detailed search metadata**: Track which variation was found, for more intelligent breadcrumb handling
