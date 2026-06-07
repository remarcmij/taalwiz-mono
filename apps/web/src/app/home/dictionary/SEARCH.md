# Dictionary Search Flow

This document describes the complete search and display flow in the dictionary module, including focus management, suggestions, variation generation, and breadcrumb tracking.

## Overview

The search feature allows users to find dictionary entries for Indonesian and Dutch words. Indonesian searches support morphological variation generation to find base forms when inflected words are entered. Results are displayed with related compound words grouped under their base forms, and recent searches are tracked in a breadcrumb list.

---

## Search Field & Focus Management

**Files**: `dictionary.page.ts`, `dictionary.page.html`

### Auto-focus on Entry

When the user navigates to the dictionary page:
1. **`ionViewDidEnter()` lifecycle hook**: Queries the searchbar input element and calls `.focus()` to auto-focus the field
2. The user can immediately start typing without clicking the field

### Focus Retention After Search

After a successful search (on desktop only):
1. Focus is maintained in the search field so the user can type the next search immediately
2. **Mobile exception**: The blur is conditional on `this.#platform.is('mobile')` — on desktop, the searchbar stays focused; on mobile, the keyboard is dismissed after Enter
3. This is implemented in the `ionViewWillEnter()` keyup handler in the keyup event subscription

### Clear on Success, Preserve on Failure

After search results are returned:
- **Success** (results.bases.length > 0): The search field is cleared (`this.word.set('')`), ready for the next search
- **Failure** (no results): The search field retains the input (`this.word.set(currentTerm)`), allowing the user to edit and retry

---

## Autocomplete Suggestions

**Files**: `dictionary.page.ts`, `searchbar-dropdown.component.ts`

### Suggestion Fetching

1. **`ionViewWillEnter()` setup**: A `fromEvent` listener is attached to the searchbar's input element for keyup events
2. **Debounce**: A 250ms debounce ensures suggestion lookups are not made on every keystroke
3. **Switch to suggestions**: After debouncing, `getSuggestions(term)` is called via `switchMap`
4. **Result**: `suggestions` signal is updated, and the dropdown is shown if matches are found

> **Suggestions are a literal prefix match — no variation generator.** `#fetchSuggestionsAsync()` queries `findWordsStartingWith(term)` directly on the typed text. Both languages carry **equal weight**: target-language and native-language hits (up to 10 each) are merged, de-duplicated, and sorted alphabetically (case-insensitive), so Indonesian and Dutch suggestions **interleave** rather than listing all target matches first. The list is then capped at 10; the user narrows to one language simply by typing another letter or two. The variation generator is deliberately **not** applied to the suggestion list: generating variations of a partially-typed word surfaces alphabetical neighbours of stripped forms (e.g. typing `memperbai` strips `-i` to `memperba` and suggests unrelated `memperba*` words), which reads as a broken filter. Morphological resolution of inflected forms still happens on the **lookup path** (`#searchLocal`, via the variation generator) — reached by tapping a word, tapping a suggestion, or pressing Enter with no matching suggestion (see Path 2).

### Suggestion Selection

When the user clicks a suggestion or presses Enter with suggestions available:
1. `onItemClicked(suggestion)` is called
2. `this.#dictionaryService.lookup(suggestion)` is called, routing to the service

---

## Search Paths & Variation Generation

**Files**: `dictionary.service.ts`, `indonesian-variation-generator.ts`, `variation-generator.ts`

All dictionary searches run entirely offline against IndexedDB — there are no API calls during lookup. The compiled dictionary is synced to IDB on login (`DictSyncService`) and queried by `DictStoreService`.

The variation generator is pluggable via `langConfig.variationGenerator` (`VariationGenerator` interface in `variation-generator.ts`; currently `IndonesianVariationGenerator`). `DictionaryService.#searchLocal()` iterates over the variations returned by `langConfig.variationGenerator.getWordVariations()`, calling `DictStoreService.findByWordAndLang()` for each, and stops at the first variation that yields keyword-flagged lemmas.

### Path 1: Autocomplete Suggestion (with match)

1. User types → autocomplete finds match (e.g., "air")
2. User clicks suggestion or presses Enter with suggestions available
3. `lookup({word: 'air', lang: 'id'})` is called → `searchDictionary()` → `#searchLocal()`
4. Since `lang === 'id'`, variation generator produces variations: `["air"]` (already a base form)
5. `DictStoreService.findByWordAndLang('air', 'id')` queries the `by-lang-wordlower` IDB index (case-insensitively)
6. **Result**: Returns all lemmas for "air" including compound entries ("air abu", "air alas", etc.)

### Path 2: Manual Entry Without Autocomplete (no match)

1. User types "dibakar" (or other word) → no literal-prefix suggestion matches (suggestions are not expanded into variations)
2. User presses Enter (on mobile this is the soft-keyboard Go/Search/Return key, which fires the same `key === 'Enter'` event)
3. The keyup handler detects Enter, finds `suggestions.length === 0`, and calls `this.lookup(new WordLang(this.word(), langConfig.targetLang))` — this is the fallback that runs the full variation-generator-backed lookup on the typed term
4. `#searchLocal()` calls `langConfig.variationGenerator.getWordVariations('dibakar')`:
   - `["dibakar", "membakar", "bakar"]`
   - "dibakar" = original (passive: "was burned")
   - "membakar" = active voice form (meN- + bakar, where 'b' initial → mem-)
   - "bakar" = bare root
5. Iterates variations, querying IDB for each:
   - `findByWordAndLang('dibakar', 'id')` → `[]` (passive forms rarely indexed)
   - `findByWordAndLang('membakar', 'id')` → lemmas found — **iteration stops**
6. **Result**: Returns all lemmas for "membakar" (the found base), including compounds, full definitions

### Path 3: Recent Search / Breadcrumb Click

1. User clicks "dibakar" from the breadcrumb list (from a previous Path 2 search)
2. `lookup({word: 'dibakar', lang: 'id'})` is called → same path as Path 2
3. The variation generator produces variations and IDB search proceeds as in Path 2
4. **Result**: Same as Path 2 — full "membakar" entries returned

---

## Indonesian Variation Generator

**File**: `indonesian-variation-generator.ts` (implements the `VariationGenerator` interface from `variation-generator.ts`)

> **The morphology and design rationale now live in the linguist-facing guide: [How search works](../../../../../docs/docs/guide/how-search-works.md).** That page is the source of truth for the affix system (suffixes, prefixes, `meN-`/`peN-` nasalisation, circumfixes, reduplication), the "generate many candidates, let the dictionary be the judge" strategy, three worked examples, and why a stemmer is the wrong tool for lookup (but the right tool for a future content-search feature). This section keeps only the implementation details that matter when working on the code.

### Lookup behaviour

The variation generator recursively strips affixes from a word, building a set of candidate forms in recursion (pre-order) order: the original first, then the forms reached by stripping affixes depth-first. It is **not** a ranked best-first list. There are two deliberate ordering choices, both placing a reconstructed active `meN-` form _before_ the bare root: a stripped `di-` passive yields its active (`diambil` emits `mengambil` before `ambil`), and a reduced `-kan`/`-i` form yields its active (`bacakan` emits `membacakan` before `baca`, preserving the `-kan` sense rather than collapsing to the root); see [Generation Order (worked trace)](#generation-order-worked-trace) below for the exact traversal. `DictionaryService.#searchLocal()` iterates this array, calling `DictStoreService.findByWordAndLang(w, lang)` for each, and **stops at the first variation that yields keyword-flagged lemmas** (`keyword === 1`). Remaining variations are not queried.

**Key design principle**: generate a set of plausible candidates rather than a single canonical root. Extra candidates (false positives) just cost one extra IDB lookup each; missing the actual match (a false negative) costs the user their answer.

### Word Exemptions

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

### Implementation Details

#### Recursive Variation Building

The variation generator uses a recursive approach to strip affixes in sequence:

```
getVariations(word) {
  add(word)
  
  // Try each affix pattern
  if matches -nya suffix:
    getVariations(word_without_nya)
  
  if matches ber- prefix:
    getVariations(word_without_ber)
  
  if matches meN- prefix:
    getVariations(word_without_meN)
    if consonant was dropped:
      getVariations(word_with_consonant_restored)
  
  // ... etc for all patterns
}
```

This ensures that multi-affix words (e.g., `kebaikan` = `ke-` + `baik` + `-an`) eventually generate the root through multiple stripping steps.

#### Generation Order (worked trace)

The output order is not a ranked "best first" list; it is the **pre-order traversal of the recursive stripping**, deduplicated by a `Set`. Each call does `variations.add(word)` _before_ recursing (`getVariations`, line 26), so a node is recorded ahead of its children, and the `Set` preserves first-insertion order.

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

2. **The only affixes the generator ever _adds_ are `meN-`/`peN-` prefixes and restored dropped consonants**, in three places: rebuilding the active form after stripping `di-` (`prefixWithMeng`, in the `di-` block); reconstructing the active `meN-` form of a reduced `-kan`/`-i` word that does not start with `m` (`prefixWithMeng` again, in the block immediately after the `di-` rule, so it too is emitted before the bare root); and the `'k'+rest` / `'s'+rest` / `'p'+rest` / `'t'+rest` consonant restoration inside `stripMeN`/`stripPeN`. This prefix synthesis is the entire reason a passive like `dibakar` resolves to the indexed active `membakar` (and a reduced `bacakan` to `membacakan`).

So there are exactly **two deliberate ordering decisions** in the whole generator, and they are siblings: the `di-` rule (recursing into the rebuilt `meN-` form, line 62, _before_ the bare root, line 65) and the `-kan`/`-i` rule (reconstructing the active `meN-` form _before_ the suffix is stripped to the bare root), each emitting the more-likely-wanted active form first. Everywhere else, the order is simply the sequence in which the strip rules happen to fire.

#### mePrefixed Flag

The `mePrefixed` parameter prevents generating duplicate `meN-` variants when stripping `di-`. When `di-` is stripped and converted to `meN-`, the flag marks that we've already generated the active voice form, avoiding redundant variations.

#### Multiple Candidate Restoration

When a consonant is dropped during affixation (e.g., `p` in `memotong` from `potong`), the variation generator generates both the stripped form (`otong`) and the restored form (`potong`). `#searchLocal()` queries IndexedDB for both, and if either matches, the lookup succeeds.

### Testing

Automated tests are located in `indonesian-variation-generator.spec.ts` and cover word exemptions, suffix stripping, prefix stripping, meN- variants, peN- variants, circumfixes, reduplication, multi-affix words, deduplication, and the documented examples from this document.

#### Running the Tests

Run the Vitest test suite for the Angular app:

```bash
# One-time run
pnpm --filter web run test

# Or with watch mode for development
pnpm --filter web run test:watch
```

The test file uses a helper function `variations(word)` to generate variation generator output and validates the results with `.toEqual()` and `.toContain()` assertions.

#### Manual Verification

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

#### Tracing a Lookup Against the Compiled Dictionary

To see the full generate-and-test sequence against the **production** compiled Teeuw index (not just the generator in isolation), run the compiler's trace tool:

```bash
pnpm --filter compiler run trace dibakar kepunyaanku diinstal
```

It reuses the production variation generator and the compiled dictionary, so its per-candidate hit/miss output is exactly what the app does at runtime. This is the tool that produces the worked examples in the [guide](../../../../../docs/docs/guide/how-search-works.md#worked-examples).

### Critical Affixes for Coverage

The affixes that matter most for coverage are `di-` (passive forms are common but often not indexed, so the rebuilt active `meN-` form is the real win), `meN-` itself, `-an`, `ber-`, and `peN-`. Particle suffixes (`-kah`, `-lah`, `-tah`, `-pun`) and personal clitics (`-ku`, `-mu`, `-nya`) are stripped because they are grammatical markers that obscure the semantic word. See the [guide](../../../../../docs/docs/guide/how-search-works.md) for the full affix breakdown.

### Scope: productive morphology only (why there is no infix rule)

The generator deliberately handles only **productive** affixation (`di-`, `meN-`, `ber-`, `ter-`, `per-`, `se-`, `ke-`, `-kan`, `-i`, `-an`, the circumfixes, clitics, and full reduplication). It has **no rule for infixes** (`-em-`, `-el-`, `-er-`), and that is correct by design, not an oversight.

Infixation is unproductive: only a closed, limited set of infixed forms exists, they are no longer felt to contain an affix, and so dictionaries list them as separate headwords from their bases (Sneddon, _Indonesian: A Comprehensive Grammar_, §1.36). Teeuw is no exception — `gerigi`, `seruling`, `telapak`, `telunjuk`, `gemetar` are each indexed as their own keywords, alongside their bases `gigi`, `suling`, `tapak`, `tunjuk`, `getar`.

The consequence for lookup: a typed infixed form **self-hits on candidate #1** (the original, unmodified word), so no stripping is ever needed to resolve it. A `-em-` stripping rule would only emit junk candidates (e.g. `getar` from `gemetar`) that the already-found `gemetar` keyword made unnecessary. The same reasoning covers lexicalised partial reduplication (`lelaki`, `tetangga`, `sesama`): a closed set, listed directly, resolved on #1.

This sharpens the division of labour: **productive morphology is generated** (its forms are too numerous for a dictionary to list), **unproductive morphology is indexed** (the closed set is listed outright). The boundary the generator draws is exactly the boundary productivity has already drawn in the dictionary, which is why there is no gap between them.

### Failure modes and the best-effort contract

The generator is a **best-effort** helper, not a guarantee. Because `#searchLocal()` validates every candidate against the dictionary, a generated non-word that matches nothing is free — it costs one extra IndexedDB lookup and no more. Validation leaves exactly two failure modes it cannot catch:

1. **Silent miss** — the correct keyword is never generated, so there is nothing to validate and the user gets "no result." This is acceptable: it degrades gracefully to manual lookup (the user finds the base form themselves, as with a paper dictionary). Within the generator's scope (productive morphology) these are rare; the unproductive cases are indexed and self-hit (see [Scope](#scope-productive-morphology-only-why-there-is-no-infix-rule)).

2. **Wrong hit** — a generated candidate is a real but _unrelated_ keyword, reached before the intended one. Teeuw confirms "yes, that's a word" and the wrong entry is returned. This is the only way the generator can actively mislead, and it is the one failure the best-effort contract does **not** excuse: a best-effort tool may return nothing, but it must not confidently return the wrong thing.

Wrong hits are bounded by two facts, though not eliminated:

- **The original typed form is always candidate #1.** Teeuw is root-organised and indexes many derivations as sublemma-keywords, so most inflected forms a learner actually types are themselves keywords and self-hit on #1 with the correct entry, before any stripped candidate is queried.
- **The `di-` and `-kan`/`-i` → active `meN-` ordering** (the rebuilt active form is emitted before the bare root) puts the more-likely-wanted form first.

The residual risk lives in **over-stripping with weak guards** (`-i` strips any final _i_ from a 2-character-plus stem; `-an`/`-kan` similar — see Limitation 1 below). If a typed form is _not_ itself indexed and an over-strip coincidentally lands on an unrelated keyword before the correct one, the result is a confidently-wrong entry. Tighter length/shape guards on strips would shrink this surface (see Future Improvements). The over-generation noise itself is harmless; only this coincidental-real-word case is not.

### Limitations & Design Tradeoffs

1. **Over-stripping**: Some generated variations may not be real words (e.g., `terbang` → `bang`). This is acceptable because false variations just create extra IndexedDB lookups; they don't break lookups. The lookup simply won't find a match for them.

2. **Ambiguous restoration**: When consonants are dropped during affixation (e.g., `potong` + `meN-` → `memotong`), we generate multiple candidates (`potong`, `otong`). Not all may be valid, but the IndexedDB lookup will find valid matches if they exist.

3. **No single canonical root**: The variation generator generates a set of plausible forms rather than morphologically analyzing to a unique root. This is simpler to implement and works well for dictionary lookup without requiring advanced linguistic analysis.

4. **Indonesian-specific**: This variation generator is tailored for Indonesian morphology and won't work for other languages.

5. **Dictionary-dependent**: The variation generator's effectiveness depends on what forms are indexed in the compiled dictionary (synced to IndexedDB). If the dictionary doesn't have certain base forms, variation generation to them won't help. Conversely, if it indexes many inflected forms, minimal variation generation may suffice.

6. **Variation order matters**: Since `#searchLocal()` stops searching after the first match, the order in which variations are generated affects both accuracy and performance. More commonly-indexed forms should ideally appear earlier. For example, for `diambil`, generating `mengambil` before `ambil` is beneficial because active forms are more likely to be indexed than passive base forms.

### Future Improvements

- **Expand word exemptions list based on user feedback** — Common words that don't follow standard morphological patterns (e.g., `aku`, `ilmu`, `bukan`) are currently hardcoded; this list can grow as users encounter words that produce incorrect or unnecessary variations.

- **Add more sophisticated consonant restoration heuristics** — The current restoration rules use a guard `/^[aeiouagh]/` on the stripped remainder (`rest`) to decide whether to attempt `k`-restoration for `meng-` prefixes. This correctly blocks restoration for vowel-initial rests (e.g., `mengambil` → `rest='ambil'` → no `kambil` generated), and allows it for consonant-initial rests (e.g., `mengritik` → `rest='ritik'` → `kritik` is generated). More sophisticated heuristics could improve precision by: (i) tighter consonant-dropping guards to exclude cases like `mengkritik` (malformed input), and (ii) minimum base-form length filters to exclude very short stripped forms (< 4 chars) that are almost never valid roots.

- **Add configurable stripping depth to trade recall for precision** — Currently the variation generator recursively strips all possible affixes. For some use cases, stopping after stripping just the most common affixes (e.g., person markers, `-nya`, tense markers) might improve precision by avoiding over-generated false positives, at the cost of lower recall for heavily affixed words.

> **Why this module is not, and should not become, a stemmer** (Nazief–Adriani / Sastrawi) is covered in the [guide](../../../../../docs/docs/guide/how-search-works.md#why-not-a-stemmer): in short, a stemmer commits to a single root, whereas this module also generates the sideways forms (passive `dibakar` → active `membakar`) the dictionary actually indexes. The real home for a stemmer is a future free-text content search, not lookup.

---

## Results Display & Grouping

**Files**: `dictionary.service.ts`, `dictionary.page.html`, `lemma.component.ts`

### Result Structure

The service returns a `LookupResult`:

```typescript
class LookupResult {
  targetBase: WordLang | null;        // The word originally typed/searched
  bases: WordLang[] = [];              // Unique base words found (ordered by reorderLookupResult)
  lemmas: Record<string, ILemma[]> = {}; // Grouped by base.key
  haveMore = false;                   // Pagination flag
}
```

### Grouping by Base

All lemmas in the lookup response are grouped by their `baseWord`:

```typescript
// In makeLookupResult:
for (const lemma of response.lemmas) {
  const base = new WordLang(lemma.baseWord, lemma.baseLang);
  const { key } = base; // "membakar:id"

  if (!newResult.lemmas[key]) {
    newResult.lemmas[key] = [];
    newResult.bases.push(base);
  }
  newResult.lemmas[key].push(lemma);
}
```

If the lookup returns 10 lemmas all with `baseWord: "membakar"` and `baseLang: "id"`, there will be one entry in `bases` (the `WordLang` "membakar") and one entry in `lemmas["membakar:id"]` with all 10 lemmas.

### Display in Template

For each base in `results.bases`, the template displays:
1. **Card header** (only for first base, `isFirst`): Shows the base word as the main heading
2. **Card content**: Renders `app-lemma` component with all lemmas for that base
3. **Button**: Shows the base word again (allows clicking to re-search that base)

---

## Recent Searches & Breadcrumb List

**Files**: `dictionary.page.ts`, `dictionary.page.html`, `search-history.service.ts`

### Storage

Search history is owned by `SearchHistoryService`, which persists it to Capacitor `Preferences` (key `taalwiz.search-history`) so it survives reloads. The service keeps up to `MAX_HISTORY` (50) entries, each `{ word, lang, searchedAt }`, most-recent first.

When a successful search completes in the `results$` observable tap, `this.addRecentSearch(results.targetBase!)` is called, which delegates to `historyService.add(word, lang)`. `results.targetBase` is the **typed word** (not the found base):

- Example: User types "dibakar" → stored as "dibakar" (even though results are for "membakar")

### Most-Recent-First Ordering

`SearchHistoryService.add()` deduplicates and promotes to the front:

```typescript
add(word: string, lang: string): void {
  const entry = { word, lang, searchedAt: new Date().toISOString() };
  const filtered = this.history().filter((e) => !(e.word === word && e.lang === lang));
  const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
  this.history.set(updated);
  this.#save(updated);
}
```

**Behavior**:
- Any existing entry for the same word+lang is removed and the word is re-inserted at the front, so re-searching a word **does** move it to the most-recent position.
- New words are prepended.
- The stored history is capped at 50 entries (oldest dropped).

### Breadcrumb Display

The `recentSearches` signal is a `computed` derived from the stored history — it takes the first `MAX_RECENT_SEARCHES` (4) entries and `reverse()`s them, so the breadcrumb shows up to 4 words oldest-on-the-left, most-recent-on-the-right. A separate `hasMoreHistory` computed is `true` when more than 4 entries are stored.

### Visibility

The breadcrumb list is only visible when there are 2+ recent searches:

```html
@if (recentSearches().length > 1) {
  <ion-breadcrumbs>...</ion-breadcrumbs>
}
```

### Bold Styling (Current Word)

The breadcrumb word that matches the currently displayed results is shown in bold:

```html
[ngClass]="{'active-breadcrumb': wordLang.key === currentTarget()?.key}"
```

The `currentTarget` signal is set in the `results$` observable tap:
```typescript
this.currentTarget.set(results.targetBase);
```

So if the user searched "dibakar" and the results are for "membakar" entries, "dibakar" in the breadcrumb is bold.

---

## Example Flow: Complete Walkthrough

### Scenario: User types "dibakar" and presses Enter (no autocomplete match)

1. **Keystroke detection**: The `ionViewWillEnter()` keyup listener fires, debounces, finds no suggestions
2. **Enter handling**: `searchDictionary(new WordLang('dibakar', 'id'))` is called
3. **Variation generation**: `langConfig.variationGenerator.getWordVariations('dibakar')` generates `["dibakar", "membakar", "bakar"]`
4. **IDB lookup**: `#searchLocal()` iterates variations:
   - `findByWordAndLang('dibakar', 'id')` → `[]` (passive forms rarely indexed)
   - `findByWordAndLang('membakar', 'id')` → **found** — returns lemmas with `word: "membakar"`, `baseWord: "bakar"`
5. **Result processing**:
   - `makeLookupResult()` groups by baseWord: `bases[0] = {word: "bakar", lang: "id"}`
   - BUT all lemmas have actual `word: "membakar"` — the 10+ entries for "membakar" (main def + compounds)
   - `results.targetBase = {word: "dibakar", lang: "id"}` (the typed word)
6. **Breadcrumb update**: `addRecentSearch({word: "dibakar", lang: "id"})` adds "dibakar" to recent searches
7. **Bold styling**: `currentTarget = {word: "dibakar", lang: "id"}` — "dibakar" in breadcrumb is bold
8. **Clear field**: `word.set('')` clears the search field
9. **Display**: Template shows all 10+ lemmas for "membakar" grouped under the "bakar" base
10. **Subsequent search**: User types "air" and presses Enter
    - No autocomplete match (assume "air" exists in autocomplete and user clicks it)
    - `lookup({word: "air", lang: "id"})` → `searchDictionary()` → `#searchLocal()`
    - Variation generator generates `["air"]`
    - IndexedDB returns all lemmas for "air"
    - Breadcrumb now shows: "dibakar" (dimmed) / "air" (bold)
11. **Click breadcrumb**: User clicks "dibakar" in breadcrumb
    - `lookup({word: "dibakar", lang: "id"})` is called
    - Routes through `searchDictionary()` → `#searchLocal()` again (same as step 2)
    - Returns same "membakar" entries (full results)
    - "dibakar" is now bold again

---

## IndexedDB Lookup Notes

**File**: `dict-store.service.ts` (read-only) — the schema and `transformDict()` live in `dict-db.ts`; the import itself runs off the main thread in `dict-import.worker.ts` as a single atomic readwrite transaction. Search reads remain on the main thread against the shared `taalwiz-dict` database. See [ARCHITECTURE.md → Dictionary](../../../../ARCHITECTURE.md#7-dictionary-offline-first) for the full sync flow and worker rationale.

### Variation Iteration

`DictionaryService.#searchLocal()` iterates the variation generator's variation array and calls `DictStoreService.findByWordAndLang(w, lang)` for each. It stops at the first variation that returns keyword-flagged lemmas (`keyword === 1`). This mirrors the "stop at first match" design that was previously handled server-side.

```typescript
for (const w of words) {
  const lemmas = await this.#dictStore.findByWordAndLang(w, target.lang);
  if (lemmas.some((l) => (l.keyword ?? 1) === 1)) {
    return makeLookupResult({ word: w, lang: target.lang, lemmas, haveMore: false });
  }
}
```

### Keyword Flag

`DictStoreService.findByWordAndLang()` accepts an optional `keywordOnly` boolean:
- `keywordOnly=true`: returns only lemmas where `keyword === 1` (used by the word-click-modal)
- `keywordOnly=false` (default): returns all lemmas regardless of keyword

The dictionary page search passes `keywordOnly=false`, so all lemmas are returned including compound-word entries.

### Case-Insensitive Keys

Lookups are case-insensitive. Each stored record carries a `wordLower` field (the lowercased `word`, added in `transformDict()`), and both query methods match against the `by-lang-wordlower` compound index `[lang, wordLower]`. The original `word` is preserved for display.

This matters for proper nouns: the dictionary stores headwords with their natural casing (e.g. `Belanda`, the keyword-flagged entry for "the Netherlands"). Without case folding, a lowercase query like `belanda` could never exact-match the capitalized key, so the search would fail even though the word exists. (IndexedDB compares string keys by UTF-16 code unit, and `'B'` sorts before `'b'`.)

The IDB schema (version 4) defines a single index, `by-lang-wordlower`. Both lookup methods use it, so there are no unused indexes to maintain — keeping per-record write cost low during the bulk import of the full dictionary (~270k word records).

### Exact Match

The IDB query uses `IDBKeyRange.only([lang, word.toLowerCase()])` on the `by-lang-wordlower` compound index — exact match on `lang` plus the lowercased word. There is no prefix or regex matching at this layer. This is why variation generation is necessary on the client side before querying IDB.

Prefix queries (autocomplete suggestions) lowercase the prefix and use `IDBKeyRange.bound([lang, start], [lang, start + '￿'])` on the same index via `DictStoreService.findWordsStartingWith()`. Results are deduplicated by `wordLower`, so `Belanda` and `belanda` collapse to one suggestion.

---

## Edge Cases & Gotchas

### 1. Inflected Words Not in Autocomplete

If a user types an inflected word like "dibakar" that is NOT in the autocomplete index (unlikely, but possible):
- Autocomplete returns no suggestions
- User presses Enter → `searchDictionary()` → `#searchLocal()` is called
- The variation generator produces variations including "membakar" (active form)
- IndexedDB lookup finds "membakar" and returns results ✓

If the user had typed "dibakar" and it WAS in autocomplete:
- User would click the suggestion
- Same route: `lookup()` → `searchDictionary()` → `#searchLocal()` → full results ✓

### 2. Word Exists Only as a Compound

Example: "sampah" (trash) might not have its own entry but appears as "membakar sampah" (burn trash) under the "membakar" entry.

If a user searches "sampah":
- Autocomplete might not suggest it (if not indexed as standalone)
- `#searchLocal()` runs the variation generator for "sampah"
- Variation generator strips affixes (none apply to "sampah")
- IndexedDB lookup for "sampah" → not found
- Returns empty results

This is expected behavior — only words (or their variants) indexed in the dictionary are found.

### 3. Recent Searches: Stored Word vs. Found Word

The breadcrumb stores **the typed word** (e.g., "dibakar"), not the found base (e.g., "membakar"). This means:

- User sees what they typed in the breadcrumb ✓
- Clicking the breadcrumb re-runs the variation generator and finds the correct base again ✓
- No inconsistency where "membakar" gets bold-highlighted but the breadcrumb shows "dibakar"

---

## Future Improvements

1. **Expand word exemptions**: Some words don't follow standard patterns and are currently hardcoded
2. **Smarter consonant restoration**: Current rules generate some phonetically implausible candidates
3. **Free-text article search (inverted index)**: A future content-search feature would call for a single-root stemmer such as Nazief–Adriani or Sastrawi (see the [guide](../../../../../docs/docs/guide/how-search-works.md#why-not-a-stemmer) for why a stemmer fits content search but not dictionary lookup)
4. **Configurable stripping depth**: Trade recall for precision by limiting affix stripping
5. **Store detailed search metadata**: Track which variation was found, for more intelligent breadcrumb handling
