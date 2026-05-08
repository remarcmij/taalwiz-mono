# Indonesian Dictionary & Stemmer

## Overview

The dictionary module provides word lookup functionality with morphological support for the Indonesian language. The `IndonesianStemmer` class generates all plausible base forms (variations) of a word so that dictionary API searches can match both inflected forms and dictionary entries.

## IndonesianStemmer

### Purpose

Indonesian uses a rich system of prefixes, suffixes, and circumfixes to modify root words. The dictionary API indexes various word forms directly (e.g., it has entries for both `membaca` and `baca`), but not all morphological variants are indexed—particularly passive forms with `di-` prefix.

The stemmer **increases the likelihood of finding a match** by generating alternative forms of a search query. Since the API searches for ANY of the provided variations, having more candidates improves coverage:

- **Forms the API will find directly**: `membaca`, `makanan`, `berbicara` (active/affixed forms are often indexed)
- **Forms the API may not find**: `diambil` (passive), some nominalized forms
- **Solution**: Generate both the original form AND base alternatives so at least one matches

**Key Design Principle**: Generate a set of plausible variations rather than a single canonical root. Extra candidates (false positives) just create additional API searches; missing the actual match (false negative) is the real problem.

### How It Works

The stemmer recursively strips affixes from a word, building a set of variations. All variations are sent to the API as a comma-separated list. **The API searches variations sequentially and stops at the first match** — remaining variations are ignored.

This means:
1. The order of variations matters
2. If an earlier variation matches a dictionary entry, the search succeeds immediately
3. Later variations only get searched if earlier ones don't match

Examples: 
- User types `diambil` (passive: "was taken")
- Stemmer generates: `[diambil, mengambil, ambil]`
- API searches in order:
  - `diambil` → not found (passive forms rarely indexed)
  - `mengambil` → found! ✓ (stops searching)
  - `ambil` → not searched (match already found)

- User types `membaca` (active: "to read")
- Stemmer generates: `[membaca, baca]`
- API searches:
  - `membaca` → found! ✓ (stops searching)
  - `baca` → not searched (match already found)

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

### Usage

```typescript
import { IndonesianStemmer } from './indonesian-stemmer';

const stemmer = new IndonesianStemmer();

// Get all variations
const variations = stemmer.getWordVariations('membaca');
// Result: ['membaca', 'baca']

// Send to API
const searchRequest = {
  word: variations.join(','),  // 'membaca,baca'
  lang: 'id',
  keyword: true
};
```

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
