# Known Issues — Indonesian Stemmer Review

> Review date: 2026-05-09  
> File reviewed: `indonesian-stemmer.ts`

## Definite Bugs

### 1. `prefixWithMeng` mishandles words beginning with plain `k` (not `kh`)

**Location:** `prefixWithMeng` (line 240)

The `else if` branch tests `/^(?:g|h|kh)/`, which **never matches** words starting with bare `k` (e.g. `kritik`, `kerja`, `kata`). As a result those words fall through to `return word` and no `me-` variant is generated.

**Impact:**
- Passive forms like `dikritik` fail to generate the active variant `mengritik`.
- The `-kan`/`-i` reverse-affixation block (lines 144-150) also returns the wrong result for `k*` roots.

**Fix:**
Include `k` in the consonant regex so it enters the `meng` logic:

```typescript
} else if (word.match(/^(?:g|h|kh|k)/)) {
  if (word.match(/^k[^h]/)) {
    return 'meng' + word.substring(1);
  }
  return 'meng' + word;
}
```

**Status:** Open

---

### 2. Missing `-kan` / `-i` suffix stripping

**Location:** No handler exists (suffix section only covers `-nya`, `-ku`, `-kau`, `-mu`, `-an`, `-kah`, `-lah`, `-tah`, `-pun`)

The SEARCH.md table documents these suffixes:

| Suffix | Example | Expected stem | Current result |
|--------|---------|---------------|----------------|
| `-kan` | `bukakan` | `buka` | Falls through `-an` strip → `bukak` |
| `-i` | `ajari` | `ajar` | Never stripped |

Because the root is never recovered:
- `bukakan` will not generate `membuka`.
- `ajari` will not generate `mengajar`.

**Fix:** Add strippers before the `-an` rule (line 98):

```typescript
match = word.match(/^(.{2,})kan$/);
if (match) {
  this.getVariations(match[1], variations, mePrefixed);
}
match = word.match(/^(.{2,})i$/);
if (match) {
  this.getVariations(match[1], variations, mePrefixed);
}
```

**Status:** Open

---

## Minor Issues / Code Smell

### 3. Redundant `per` / `pelajar` handling during `di-` stripping

**Location:** lines 68-70

`prefixWithMeng` already returns `mem` + `word` for `per`/`pelajar` roots because those words match the `^p` branch and fail the negative `!...^(?:per|pelajar)/` test. The extra manual call in the `di-` block therefore adds a duplicate string into the `Set` with no functional benefit.

**Recommended action:** Remove lines 68-70 for clarity.

**Status:** Open

---

### 4. `meng` k-restoration generates implausible forms for some roots

**Location:** `stripMeN` / `stripPeN`, `peng` branches (lines 162-168, 194-200)

- For **vowel-initial** roots (`mengambil` → rest=`ambil` — starts with `a`), the guard `/^[aeiouagh]/` **blocks** `k`-restoration, so `kambil` is **not** generated. This contradicts SEARCH.md line 346, which says these candidates are produced.
- Conversely, for **consonant-initial** roots (`mengkritik` → rest=`kritik` — starts with `k`), the guard allows restoration, producing `kkritik`. This is phonetically impossible.

The docs describe the current behavior as "over-generation is tolerable," but in practice the stemmer is *more conservative* on vowels and *more destructive* on consonants than the docs imply.

**Recommended actions:**
1. Update SEARCH.md (line 346) to accurately document the guard behavior.
2. Consider tightening the guard to `!rest.match(/^[aeiougkmh]/)` or similar to both allow `k` on plausible roots and block double `k`.

**Status:** Open (documentation/code mismatch)

---

### 5. Some `meN`- and `peN`-stripped roots beginning with `ny` / `ng` are lost

**Location:** `stripMeN` and `stripPeN`

- `menyanyi` (root `nyanyi`) → yields only `anyi` and `sanyi`; `nyanyi` is never restored.
- `mengaji` (root `ngaji`) → yields only `aji`; `ngaji` is never restored.

Without a root dictionary, these are genuinely ambiguous (restoration would require adding `n` as a fallback for any vowel-initial rest after `meng`). If the API already indexes these forms, they work because the original form is sent first. If only the bare root is indexed, lookup will fail.

**Workaround:** Add common `ny*` / `ng*` roots (`nyanyi`, `ngaji`) to `WordExemptions` so the stemmer passes them through untouched.

**Status:** Open (known limitation)

---

## Quick-Fix Checklist

- [ ] Fix `prefixWithMeng` to include bare `k` roots.  
- [ ] Add `-kan` and `-i` suffix strippers before the `-an` rule.  
- [ ] Remove manual `per`/`pelajar` handling in `di-` stripping block.  
- [ ] Update SEARCH.md restoration description (line 346) to match actual guard behavior.  
- [ ] Consider adding `nyanyi`, `ngaji`, or other frequent `ny*`/`ng*` roots to `WordExemptions`.  
