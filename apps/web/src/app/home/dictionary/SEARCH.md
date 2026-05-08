# Dictionary Search Flow

This document describes the complete search and display flow in the dictionary module, including focus management, suggestions, stemming, and breadcrumb tracking.

## Overview

The search feature allows users to find dictionary entries for Indonesian and Dutch words. Indonesian searches support morphological stemming to find base forms when inflected words are entered. Results are displayed with related compound words grouped under their base forms, and recent searches are tracked in a breadcrumb list.

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
2. **Debounce**: A 250ms debounce ensures API calls are not made on every keystroke
3. **Switch to suggestions**: After debouncing, `getSuggestions(term)` is called via `switchMap`
4. **Result**: `suggestions` signal is updated, and the dropdown is shown if matches are found

### Suggestion Selection

When the user clicks a suggestion or presses Enter with suggestions available:
1. `onItemClicked(suggestion)` is called
2. `this.#dictionaryService.lookup(suggestion)` is called, routing to the service

---

## Search Paths & Stemming

**Files**: `dictionary.service.ts`, `indonesian-stemmer.ts`

### Path 1: Autocomplete Suggestion (with match)

1. User types → autocomplete finds match (e.g., "air")
2. User clicks suggestion or presses Enter with suggestions available
3. `lookup({word: 'air', lang: 'id'})` is called
4. Since `lang === 'id'`, it routes to `lookupVariations('air')` in the service
5. Stemmer generates variations: `["air"]` (already a base form, no affixes to strip)
6. API is called: `word="air"`, `lang="id"`, no keyword flag
7. API splits on commas (only one term) and searches for exact match `{word: "air", lang: "id"}`
8. **Result**: Returns all lemmas for "air" including compound entries ("air abu", "air alas", etc.)

### Path 2: Manual Entry Without Autocomplete (no match)

1. User types "dibakar" (or other word) → no suggestions match
2. User presses Enter
3. The keyup handler detects Enter, finds `suggestions.length === 0`, and calls `lookupVariations(currentTerm)`
4. Stemmer generates variations: `["dibakar", "membakar", "bakar"]`
   - "dibakar" = original (passive: "was burned")
   - "membakar" = active voice form (meN- + bakar, where 'b' initial → mem-)
   - "bakar" = bare root
5. Variations are joined and sent to API: `word="dibakar,membakar,bakar"`, `lang="id"`, no keyword flag
6. API splits on commas and tries each in order:
   - Searches for `{word: "dibakar", lang: "id"}` → not found (passive forms rarely indexed)
   - Searches for `{word: "membakar", lang: "id"}` → **found!** Returns all lemmas for "membakar"
   - "bakar" is not tried (API stops at first match per README design)
7. **Result**: Returns all lemmas for "membakar" (the found base), including compounds, full definitions

### Path 3: Recent Search / Breadcrumb Click

1. User clicks "dibakar" from the breadcrumb list (from a previous Path 2 search)
2. `lookup({word: 'dibakar', lang: 'id'})` is called
3. Since `lang === 'id'`, routes to `lookupVariations('dibakar')` (same as Path 2)
4. Stemmer generates variations and API search proceeds as in Path 2
5. **Result**: Same as Path 2 — full "membakar" entries returned

---

## Indonesian Stemmer

**File**: `indonesian-stemmer.ts`

### Purpose

Indonesian uses a rich system of prefixes, suffixes, and circumfixes to modify root words. The dictionary API indexes various word forms directly (e.g., it has entries for both `membaca` and `baca`), but not all morphological variants are indexed—particularly passive forms with `di-` prefix.

The stemmer **increases the likelihood of finding a match** by generating alternative forms of a search query. This is essential for user experience:

- When a user searches for an **inflected word** like `dibakar` (passive: "was burned"), the stemmer generates variations including `membakar` (active form, more likely indexed)
- The API searches these variations in order and **stops at the first match**, returning full results for that matched form
- Without stemming, `dibakar` would return zero results, forcing the user to guess the base form manually

**Key Design Principle**: Generate a set of plausible variations rather than a single canonical root. Extra candidates (false positives) just create additional API searches; missing the actual match (false negative) is the real problem.

**API Search Behavior**: The variations are sent comma-separated (e.g., `word="dibakar,membakar,bakar"`). The API splits on commas and tries each in order, returning full results for the first variant that matches. Remaining variations are not searched.

### How It Works

The stemmer recursively strips affixes from a word, building a set of variations. The variations are ordered strategically to maximize match likelihood:

1. **Original form first**: The input word as-is (might be indexed directly)
2. **Active/common forms next**: Generated active voice or common inflections (more likely indexed)
3. **Base/rare forms last**: Stripped roots and uncommon variants (fallback only)

All variations are sent to the API as a comma-separated list.

**Examples of variation ordering**:

- User types `diambil` (passive: "was taken")
- Stemmer generates: `["diambil", "mengambil", "ambil"]`
  - `diambil`: original (rarely indexed)
  - `mengambil`: active voice form (commonly indexed) ← **API finds this first**
  - `ambil`: bare root (fallback)
- Result: API finds `mengambil` and returns all its entries

- User types `membaca` (active: "to read")
- Stemmer generates: `["membaca", "baca"]`
  - `membaca`: common form, indexed directly ← **API finds this**
  - `baca`: bare root (not needed)
- Result: API finds `membaca` and returns all its entries

### Affixes Handled

#### Suffixes (akhiran)

| Affix | Purpose | Example |
|-------|---------|---------|
| `-nya` | Possessive/definite article | `rumahnya` → `rumah` |
| `-ku` | 1st person possession | `rumahku` → `rumah` |
| `-mu` | 2nd person possession | `rumahmu` → `rumah` |
| `-kau` | Alternative 2nd person | `rumahkau` → `rumah` |
| `-kah` | Question particle | `dimana` → `mana`, `dimanakah` → `mana` |
| `-lah` | Emphatic particle | `berikutlah` → `berikut` |
| `-tah` | Rhetorical particle | `siapa` → `siapa`, `siapatahlah` → `siapa` |
| `-pun` | Also/even particle | `siapapun` → `siapa` |
| `-kan` | Causative/benefactive | `bukakan` → `buka`, then me- variants |
| `-i` | Locative/repetitive | `bukui` → `buku`, then me- variants |
| `-an` | Nominalization | `makanan` → `makan`, `perjalanan` → `jalan` |

#### Prefixes (awalan)

| Prefix | Purpose | Example |
|--------|---------|---------|
| `ku-` | 1st person active | `kuambil` → `ambil` |
| `kau-` | 2nd person active | `kauambil` → `ambil` |
| `mu-` | 2nd person (variant) | `muambil` → `ambil` |
| `di-` | Passive voice | `diambil` → `ambil`, `mengambil` (active variant) |
| `ter-` | Accidental/passive/superlative | `terbang` → `bang` |
| `ber-` | Stative/active verb, plural | `berbicara` → `bicara`, `berjalan` → `jalan` |
| `se-` | One/each/with | `sehari` → `hari` |
| `ke-` | Nominalization prefix | `ketua` → `tua` |
| **`meN-` variants** | Active transitive verb | See below |
| **`peN-` variants** | Agentive noun | See below |

#### meN- Prefix Variants (Active Voice)

The `meN-` prefix adapts based on the initial consonant of the root. The stemmer strips all forms and restores dropped consonants where possible:

| Initial | Prefix + Root | Stripped | Restored |
|---------|---------------|----------|----------|
| Vowel | `meng` + `ambil` | `meng ambil` → `ambil` | N/A |
| `b`, `f` | `mem` + `baca` | `membaca` → `baca` | N/A |
| `p` | `mem` + `potong` (p dropped) | `memotong` → `otong` | Try `potong` |
| `d`, `c`, `j`, `z` | `men` + `dapat` | `mendapat` → `dapat` | N/A |
| `t` | `men` + `tulis` (t dropped) | `menulis` → `ulis` | Try `tulis` |
| `s` | `meny` + `sapu` (s dropped) | `menyapu` → `apu` | Try `sapu` |
| `g`, `h` | `meng` + `garis` | `menggaris` → `garis` | N/A |
| `k` | `meng` + `kritik` (k dropped) | `mengritik` → `ritik` | Try `kritik` |
| `l`, `r`, `m`, `n`, `w`, `y` | `me` + `lakukan` | `melakukan` → `lakukan` | N/A |

Examples:
- `membaca` → `baca`
- `mengambil` → `ambil`
- `menulis` → `tulis` or `ulis`
- `menyapu` → `sapu` or `apu`
- `memotong` → `potong` or `otong`

#### peN- Prefix Variants (Agentive/Instrumental Nouns)

The `peN-` prefix follows the same phonological rules as `meN-`:

| Example | Stripped | Restored |
|---------|----------|----------|
| `penulis` (writer) | `ulis` | `tulis` |
| `pembaca` (reader) | `baca` | N/A |
| `pengambil` (taker) | `ambil` | N/A |
| `penyapu` (sweeper) | `apu` | `sapu` |

#### Circumfixes (kombinasi awalan + akhiran)

Circumfixes are prefix-suffix combinations that frame the root:

| Circumfix | Purpose | Example |
|-----------|---------|---------|
| `ke-...-an` | Abstract noun state | `kebaikan` → `baik`, `kehidupan` → `hidup` |
| `per-...-an` | Place/process noun | `perjalanan` → `jalan`, `perbedaan` → `beda` |
| `pe-...-an` | Process/result noun | `penulisan` → `tulis`, `pembacaan` → `baca` |

#### Reduplication (Pengulangan)

Repeated words are reduced to the singular form:

| Example | Stripped |
|---------|----------|
| `anak-anak` | `anak` |
| `rumah-rumah` | `rumah` |
| `siswa-siswi` | `siswa` or `siswi` |

### Word Exemptions

Certain common words are not stemmed because they don't follow standard patterns or are already base forms:

- `aku` (I)
- `ilmu` (knowledge)
- `kamu` (you)
- `tamu` (guest)
- `temu` (meet)
- `dia` (he/she)
- `bukan` (not)
- `ini` (this)

### Implementation Details

#### Recursive Variation Building

The stemmer uses a recursive approach to strip affixes in sequence:

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

#### mePrefixed Flag

The `mePrefixed` parameter prevents generating duplicate `meN-` variants when stripping `di-`. When `di-` is stripped and converted to `meN-`, the flag marks that we've already generated the active voice form, avoiding redundant variations.

#### Multiple Candidate Restoration

When a consonant is dropped during affixation (e.g., `p` in `memotong` from `potong`), the stemmer generates both the stripped form (`otong`) and the restored form (`potong`). The dictionary API searches for both, and if either matches, the lookup succeeds.

### Testing

Manual verification can be done by checking that expected base forms appear in the variations array:

```typescript
const stemmer = new IndonesianStemmer();
const vars = stemmer.getWordVariations('membaca');
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

### Critical Affixes for Coverage

Some affixes are more important for dictionary lookup coverage:

| Affix | Why Important | Example |
|-------|---------------|---------|
| `di-` | Passive forms are common in Indonesian but often not indexed; active form (`meN-`) alternative increases match likelihood | `diambil` → generate `mengambil`, `ambil` |
| `meN-` | Active transitive verbs are heavily used; generating base form improves matches | `membaca` → generate `baca` |
| `-an` | Nominalized forms may not be indexed; base noun often is | `makanan` → generate `makan` |
| `ber-` | Active verbs; base form has higher indexing likelihood | `berbicara` → generate `bicara` |
| `peN-` | Agentive nouns; less likely to be indexed than the verb | `penulis` → generate `tulis` |

Particle suffixes (`-kah`, `-lah`, `-tah`, `-pun`) and personal clitics (`-ku`, `-mu`, `-nya`) are stripped because they're grammatical markers that obscure the semantic word.

### Limitations & Design Tradeoffs

1. **Over-stripping**: Some generated variations may not be real words (e.g., `terbang` → `bang`). This is acceptable because false variations just create extra API calls; they don't break lookups. The API simply won't find a match for them.

2. **Ambiguous restoration**: When consonants are dropped during affixation (e.g., `potong` + `meN-` → `memotong`), we generate multiple candidates (`potong`, `otong`). Not all may be valid, but the dictionary API will find valid matches if they exist.

3. **No single canonical root**: The stemmer generates a set of plausible forms rather than morphologically analyzing to a unique root. This is simpler to implement and works well for dictionary lookup without requiring advanced linguistic analysis.

4. **Indonesian-specific**: This stemmer is tailored for Indonesian morphology and won't work for other languages.

5. **API-dependent**: The stemmer's effectiveness depends on what forms are actually indexed in the dictionary API. If the API doesn't have certain base forms, stemming to them won't help. Conversely, if the API indexes many inflected forms, minimal stemming may suffice.

6. **Variation order matters**: Since the API stops searching after the first match, the order in which variations are generated affects both accuracy and performance. More commonly-indexed forms should ideally appear earlier. For example, for `diambil`, generating `mengambil` before `ambil` is beneficial because active forms are more likely to be indexed than passive base forms.

### Future Improvements

- **Expand word exemptions list based on user feedback** — Common words that don't follow standard morphological patterns (e.g., `aku`, `ilmu`, `bukan`) are currently hardcoded; this list can grow as users encounter words that stem incorrectly or unnecessarily.

- **Add more sophisticated consonant restoration heuristics** — The current restoration rules are conservative approximations. For example, `meng-` always generates `k`+rest for consonant-initial roots, but this produces phonetically implausible candidates like `kambil` (from `mengambil`) or `kecek` (from `mengecek`) — `k` is only dropped when the root itself begins with `k`. Since the API silently ignores non-matching variants at negligible cost, this over-generation is tolerable today. More precise heuristics would reduce noise and improve the likelihood that valid restored forms appear earlier in the variation list (which matters because the API stops at the first match). Examples: (i) tighter consonant-dropping guards — only restore `k` when the remaining letters could plausibly form a root starting with `k` (i.e., exclude `g/h/ng/ny` which are never preceded by dropped `k`), and (ii) minimum base-form length — filter out very short stripped forms (< 4 chars) that are almost never valid roots.

- **Integrate a proper Indonesian morphological analyzer if performance becomes critical** — "Performance" here means **match quality** (recall/precision), not execution speed. The rule-based approach may miss unusual but valid base forms that a full analyzer would identify, or fail to generate the canonical form the dictionary indexes. Known options: **Nazief–Adriani** (1996, the classic Indonesian stemming algorithm) or **ECS (Enhanced Confix Stripping)**, the basis of the **`@sastrawi/sastrawi`** npm package (JavaScript port of the Sastrawi PHP stemmer). Sastrawi validates against a ~29,000-word root dictionary and returns a single canonical root. The trigger would be observable lookup failures on correctly-spelled Indonesian words that the current stemmer fails to resolve.

- **Add configurable stripping depth to trade recall for precision** — Currently the stemmer recursively strips all possible affixes. For some use cases, stopping after stripping just the most common affixes (e.g., person markers, `-nya`, tense markers) might improve precision by avoiding over-generated false positives, at the cost of lower recall for heavily affixed words.

### Why Order Matters

The variations are generated in a specific order because the API searches them sequentially and **stops at the first match**. The order is designed to:
1. Try the original form first (might be indexed as-is)
2. Try more common forms next (e.g., active voice before passive)
3. Try less common forms last (e.g., bare roots)

This maximizes the likelihood that the first match is the best match.

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

All lemmas in the API response are grouped by their `baseWord`:

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

If the API returns 10 lemmas all with `baseWord: "membakar"` and `baseLang: "id"`, there will be one entry in `bases` (the `WordLang` "membakar") and one entry in `lemmas["membakar:id"]` with all 10 lemmas.

### Display in Template

For each base in `results.bases`, the template displays:
1. **Card header** (only for first base, `isFirst`): Shows the base word as the main heading
2. **Card content**: Renders `app-lemma` component with all lemmas for that base
3. **Button**: Shows the base word again (allows clicking to re-search that base)

---

## Recent Searches & Breadcrumb List

**Files**: `dictionary.page.ts`, `dictionary.page.html`

### Storage

The `recentSearches` signal stores an array of `WordLang` objects. When a successful search completes in the `results$` observable tap:

1. `this.addRecentSearch(results.targetBase!)` is called
2. `results.targetBase` is the **typed word** (not the found base)
   - Example: User types "dibakar" → stored as "dibakar" (even though results are for "membakar")

### Insertion Order Preservation

The `addRecentSearch()` method implements insertion-order preservation:

```typescript
addRecentSearch(wordLang: WordLang) {
  this.recentSearches.update((values) => {
    // If word already in list, return unchanged (preserves position)
    if (values.some((v) => v.key === wordLang.key)) {
      return values;
    }
    // New word: append to end
    const newValues = [...values, wordLang];
    // Cap at MAX_RECENT_SEARCHES (4)
    if (newValues.length > MAX_RECENT_SEARCHES) {
      newValues.shift();
    }
    return newValues;
  });
}
```

**Behavior**:
- Clicking an existing breadcrumb word does NOT move it to the end — it stays in place
- Only new words are appended
- When the list reaches 4, the oldest word is dropped

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
2. **Enter handling**: `lookupVariations('dibakar')` is called
3. **Stemming**: Generates `["dibakar", "membakar", "bakar"]`
4. **API call**: `GET /api/v1/dictionary/find/dibakar,membakar,bakar/id`
   - API splits on comma, tries "dibakar" → not found
   - Tries "membakar" → **found**
   - Returns lemmas with `word: "membakar"`, `baseWord: "bakar"`
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
    - `lookup({word: "air", lang: "id"})` → `lookupVariations("air")`
    - Stemmer generates `["air"]`
    - API searches and returns 50+ lemmas for "air"
    - Breadcrumb now shows: "dibakar" (dimmed) / "air" (bold)
11. **Click breadcrumb**: User clicks "dibakar" in breadcrumb
    - `lookup({word: "dibakar", lang: "id"})` is called
    - Routes to `lookupVariations("dibakar")` again (same as step 2)
    - Returns same "membakar" entries (full results)
    - "dibakar" is now bold again

---

## API Behavior Notes

**File**: `apps/api/src/dictionary/dictionary.service.ts`

### Comma-Separated Words

The API **always** splits the `:word` parameter on commas and tries each variant in order, regardless of the `keyword` query flag. This is a built-in fallback mechanism.

```typescript
const words = paramsDto.word.split(',');
for (const word of words) {
  const lemmas = await this.findWordHelper(word, ...);
  if (lemmas.length) {
    return { word, lang, lemmas, haveMore: false }; // Stop on first match
  }
}
```

### Keyword Flag

The `keyword` query flag only affects filtering by the `keyword: boolean` field in the Lemma schema:
- `keyword=1`: Returns only lemmas where `keyword: true` (keyword-flagged entries only)
- `keyword=0`: Returns only lemmas where `keyword: false` (non-keyword entries only)
- `keyword=undefined` (omitted): Returns all lemmas regardless of keyword flag

The dictionary search **does not use the keyword flag** (it's undefined/omitted). This ensures all lemmas are returned, including compound-word entries that may be non-keyword flagged.

The `keyword` flag is used elsewhere, e.g., in the word-click-modal feature, which intentionally filters to keyword-flagged lemmas only.

### Exact Match Search

The database query is always an exact match on `{ word, lang }`:

```typescript
const query = Lemma.find({ word, lang, keyword: ... })
  .sort('word order')
  .select('-order -attr -groupName -keyword -_topic');
```

There is no prefix search or regex matching at this endpoint. The word must match exactly. This is why stemming is necessary on the client side.

---

## Edge Cases & Gotchas

### 1. Inflected Words Not in Autocomplete

If a user types an inflected word like "dibakar" that is NOT in the autocomplete index (unlikely, but possible):
- Autocomplete returns no suggestions
- User presses Enter → `lookupVariations()` is called
- Stemmer generates variations including "membakar" (active form)
- API finds "membakar" and returns results ✓

If the user had typed "dibakar" and it WAS in autocomplete:
- User would click the suggestion
- Same route: `lookup()` → `lookupVariations()` → full results ✓

### 2. Word Exists Only as a Compound

Example: "sampah" (trash) might not have its own entry but appears as "membakar sampah" (burn trash) under the "membakar" entry.

If a user searches "sampah":
- Autocomplete might not suggest it (if not indexed as standalone)
- `lookupVariations("sampah")` generates variations
- Stemmer strips affixes (none apply to "sampah")
- API searches for "sampah" → not found
- Returns empty results

This is expected behavior — only words (or their variants) indexed in the dictionary are found.

### 3. Recent Searches: Stored Word vs. Found Word

The breadcrumb stores **the typed word** (e.g., "dibakar"), not the found base (e.g., "membakar"). This means:

- User sees what they typed in the breadcrumb ✓
- Clicking the breadcrumb re-runs the stemmer and finds the correct base again ✓
- No inconsistency where "membakar" gets bold-highlighted but the breadcrumb shows "dibakar"

---

## Future Improvements (from README.md)

1. **Expand word exemptions**: Some words don't follow standard patterns and are currently hardcoded
2. **Smarter consonant restoration**: Current rules generate some phonetically implausible candidates
3. **Integrate a full morphological analyzer**: If performance/accuracy becomes critical, use Nazief–Adriani or Sastrawi
4. **Configurable stripping depth**: Trade recall for precision by limiting affix stripping
5. **Store detailed search metadata**: Track which stemmed variant was found, for more intelligent breadcrumb handling
