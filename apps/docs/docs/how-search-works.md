# How Search Works

This page explains how Taalwiz resolves an Indonesian word a learner types into the
dictionary search box, with a focus on the morphology.

::: info Audience
This page is written for **linguists**. It assumes a reading knowledge of Indonesian
(Malay) affixational morphology and uses standard terminology without glossing it. It is
**not** end-user help: a regular user needs none of this to use the dictionary, they just
type a word and read the result. Implementation notes for developers live with the code.
:::

## The problem

Indonesian is richly affixing. A single base such as _bakar_ ("burn") surfaces in
running text as _membakar_, _dibakar_, _membakarkan_, _terbakar_, _pembakaran_, and
more. A learner reading a sentence meets the affixed form, not the base, and types
exactly what they see. The dictionary behind the search is Teeuw's
_Indonesisch-Nederlands Woordenboek_, digitised from the 1996 print edition. Its
**headwords** are mostly bases, with common derivations listed beneath each headword as
**sublemmas** rather than as headwords of their own. Teeuw lists many affixed forms, but not every possible one.

So the search has a gap to bridge: from the affixed form the user typed to some form the
dictionary actually lists, whether a headword or a sublemma.

That gap is **bounded**, because Teeuw's omissions are principled. His introduction
states that forms with a wholly predictable meaning are left out: the passive _di-_
form (_dipukul_) is almost always absent, the adjectival superlative (_terbesar_) is
omitted, and reduplications are recorded only when their meaning does not follow from
the base. That predictable class is exactly what an affix-stripper can reconstruct, so
the forms Teeuw dropped to save paper are the very ones the generator regenerates on
demand (strip _ter-_ from _terbesar_ to reach _besar_; strip _di-_ from _dipukul_, and
rebuild the active _memukul_, both of which he kept). The irregular forms he _did_
record are reached by trying the typed string first. Teeuw's omission rule and the
candidate generator are thus complementary halves of one design, arrived at three
decades apart: what a lexicographer leaves out as predictable is what a stripper can
safely put back.

## From printed dictionary to a searchable index

This page draws on two domains of terminology and keeps them distinct: the lexicography of
Teeuw's printed dictionary, in his own Dutch and its standard English equivalents, and the
engineering of the app's search index. Table 1 below lines them up.

In the **print dictionary**, Teeuw is organised by **headword**, mostly a base (root).
Derived forms get no headword of their own: they sit beneath the headword as
**sublemmas**, bold sub-entries with their own glosses. A word cited in passing that is
defined under its own headword elsewhere is a **cross-reference**.

In the **digitised index** the app actually searches, each of those bold forms, the
headword _and_ every sublemma, becomes a keyword: an independently searchable string.
A successful match surfaces grouped under its base, the headword/root that anchors the
group, which is also the morphological base the derivations are built on.

| Teeuw (Dutch) | Standard (English) | Taalwiz index |
| --- | --- | --- |
| _hoofdtrefwoord_ (een _grondwoord_) | headword (a base) | a keyword, and the base that anchors the group |
| _afleiding_ | sublemma (nested derivation) | a keyword under that base |
| _verwijzing_ (_verwijspijl_ →) | cross-reference (defined elsewhere) | resolves to a keyword (which may itself be a base) |

<small>**Table 1.** Terminology.</small>

So when this page says a candidate "matches a keyword," that keyword may be a headword or
a sublemma; either way the entry surfaces under its base. The _kepunyaanku_ example below
walks the whole chain: print → index → lookup.

Teeuw's own terminology lines up with the engineering names almost one-for-one: his
_trefwoord_ ("lookup word") is the direct ancestor of the index's keyword, and his
_grondwoord_ ("root word") of its base. In his frontmatter Teeuw is explicit that the
headwords (_hoofdtrefwoorden_) are "in the first place the so-called _grondwoorden_," with
derivations (_afleidingen_) listed beneath them and cross-references (_verwijzingen_, often
marked with an arrow _verwijspijl_ →) pointing from an apparent form to the real base.

## The core idea: generate candidates, let the dictionary judge

Taalwiz does **not** try to analyse an inflected word down to its one "true" base. Instead it
generates a _set_ of plausible candidate forms by recursively stripping affixes,
then looks each candidate up in turn and stops at the first one the dictionary
lists as a keyword (a headword or a sublemma). In information-retrieval terms this is a generate-and-test
(over-generate-and-filter) strategy rather than morphological analysis: the generator
favours recall, and the dictionary supplies precision.

This is deliberately not a stemmer. A stemmer commits to a single root; if that one guess is
wrong the lookup fails, and even when it is right it points only at the base, never at the
indexed derivations Taalwiz can land on directly. Taalwiz instead casts a wider net and lets the **dictionary
be the judge of what is real**. Some generated candidates are not Indonesian words at
all. That is fine: a non-word simply finds nothing and the search moves on to the next
candidate. A false candidate costs one extra lookup; a missing candidate costs the
user their answer. The design optimises against the second, more expensive failure.

The generator emits its candidates in a fixed order set by its recursion, not by any
ranking it computes, and with no notion of which form is a base, or whether a form is a valid Indonesian word at all. The one part that matters
for lookup: the original form is tried first, in case it is already a keyword. After that
it strips affixes recursively until exhausted. Where it _builds_ a form rather than strips
one, it is reconstructing the active _meN-_ form, most visibly from a stripped _di-_ passive
(_dibakar_ → _membakar_, example 1), which the dictionary often lists. The candidates are well-formed
derivations intermixed with non-words; empirically, the forms most likely to be keywords
surface before the long shots.

Because the lookup stops at the first hit, this ordering means that on a successful
search the later, less plausible candidates (including any non-words) are often never
queried at all.

## A note on Indonesian morphology

The generator knows the regular affix system. The parts most relevant to lookup:

| Type | Examples | Function |
| --- | --- | --- |
| Suffixes | _-kan_, _-i_, _-an_ | _-kan_: causative/instrumental/benefactive; _-i_: locative/repetitive; _-an_: forms nouns |
| Bound pronouns (suffixed) | _-ku_, _-mu_, _-nya_ | object of an active verb, possessor, or passive agent |
| Particles | _-lah_, _-kah_, _-pun_, _-tah_ | mood, focus, concessive |
| Simple prefixes | _di-_, _ber-_, _ter-_, _ke-_, _se-_, _per-_ | _di-_ passive, _ber-_ intransitive verb, _ter-_ accidental/abilitative, _ke-_ ordinal/collective, _se-_ "one/same", _per-_ causative |
| Nasal prefixes | _meN-_, _peN-_ | _meN-_ active verb; _peN-_ or _pe-_ noun for the person or instrument of the action |
| Circumfixes | _ke-...-an_, _per-...-an_, _peN-...-an_ | _ke-...-an_ abstract noun, _per-...-an_ process/place noun, _peN-...-an_ action noun |
| Reduplication | _anak-anak_ &rarr; _anak_ | plurality, iteration, derivation |

<small>**Table 2.** Affixes most relevant to lookup.</small>

The linguistically interesting part is the **nasal prefix _meN-_** (and its noun
counterpart _peN-_). The capital _N_ stands for the nasal element, which surfaces as
_me-_, _mem-_, _men-_, _meng-_ or _meny-_ depending on the base's first sound. For one
class of bases, those beginning with a voiceless consonant (_p, t, s, k_), that initial
consonant is **lost** when the prefix attaches:

| Base initial | Realisation of _meN-_ | Example | Base |
| --- | --- | --- | --- |
| vowel | _meng-_ | _mengambil_ | _ambil_ |
| _b_, _f_ | _mem-_ | _membaca_ | _baca_ |
| _d_, _c_, _j_ | _men-_ | _mendapat_ | _dapat_ |
| _g_, _h_ | _meng-_ | _menggaris_ | _garis_ |
| _l_, _r_, _m_, _n_, _w_, _y_ | _me-_ | _melakukan_ | _lakukan_ |
| **_p_** (lost) | _mem-_ | _memotong_ | _potong_ |
| **_t_** (lost) | _men-_ | _menulis_ | _tulis_ |
| **_s_** (lost) | _meny-_ | _menyapu_ | _sapu_ |
| **_k_** (lost) | _meng-_ | _mengarang_ | _karang_ |

<small>**Table 3.** Realisation of _meN-_ by the base's initial sound.</small>

The dropped-consonant rows are why analysis is ambiguous in the _reverse_ direction.
Seeing _menulis_, you cannot tell from the surface alone whether the base began with
_t_ (it did: _tulis_) or was vowel-initial (_ulis_, which would also yield a form
starting _men-..._). The generator does not try to decide. It emits **both** the
bare-stripped form and the consonant-restored form, and lets the dictionary confirm
which one exists.

## Worked examples

The three examples below trace how Taalwiz performs real lookups, from simple to complex. The first two carry
a sequence diagram showing the variation generator producing candidates and the indexed dictionary
accepting or rejecting each one in order.

### 1. A passive form: _dibakar_

The user reads _dibakar_ ("was burned") and types it in the search field or taps it in displayed content. The passive _di-_ form is not an indexed
Teeuw keyword, but the generator rebuilds the active _membakar_, which is.

```mermaid
sequenceDiagram
    autonumber
    actor U as Learner
    participant S as Search
    participant G as Variation generator
    participant D as Teeuw dictionary

    U->>S: look up "dibakar"
    S->>G: generate variations
    Note over G: strip di- to base "bakar",<br/>rebuild active (b takes mem-) = "membakar",<br/>also emit "bakar" and the non-word "mbakar"
    G-->>S: [dibakar, membakar, bakar, mbakar]
    S->>D: "dibakar"?
    D-->>S: no match
    S->>D: "membakar"?
    D-->>S: match: keyword, base "bakar"
    Note over S: stop at first hit,<br/>remaining "bakar" and<br/>"mbakar" are never queried
    S-->>U: entry shown under base "bakar"
```

<small>**Figure 1.** Looking up _dibakar_.</small>

The point: the generator produced four candidates, one of them ("mbakar") not a word.
It did no harm. The active form was found on the second lookup and the rest were never
needed.

### 2. Stopping at a sublemma, not the base: _kepunyaanku_

The user types _kepunyaanku_ ("my possession"), which is _ke-_ + _punya_ ("to own") +
_-an_ + the possessive clitic _-ku_. This one is worth following end to end, because it
shows how Teeuw's printed layout becomes the index the search queries.

In print, _punya_ is a headword set at the left margin; its derivations are nested
beneath it, indented:

![The printed Teeuw entry for _punya_](images/teeuw-punya.png)

<small>**Figure 2.** The printed Teeuw entry for _punya_.</small>

The digitised source preserves that layout. The headword comes first; the bold run-on
forms are its sublemmas; the italic forms are examples and cross-references:

```text
**punya**, 1 hebben, bezitten;
*saya ~ uang itu*, ik heb dat geld;
... (further senses and examples) ...
**punyaku**(, **punyamu**), van mij(, jou) ...;
**berpunya**, 1 eigenaar hebben ...;
**mempunyai, mengempunyai** O, bezitten ...;
**kepunyaan**, bezit, eigendom, toebehoren.
```

The compiler reads that whole block (the text between two blank lines) into a single base with many keywords:

| In the source | Parsed as | A search target? |
| --- | --- | --- |
| `**punya**`, the headword | base _punya_ | yes, as the base itself |
| `**punyaku**`, `**berpunya**`, `**mempunyai**`, `**kepunyaan**` … | keywords under base _punya_ | yes, each one |
| `*saya ~ uang itu*`, `*yg ~*` … | examples and cross-references | no (references resolve to their own keyword) |

<small>**Table 4.** One print block, parsed into the index.</small>

So _kepunyaan_ is not a headword: it is a **sublemma**, stored as a keyword whose base is
_punya_. That is the form the search lands on. (The encoding rules are spelled out in the
compiler's `TEEUW_PARSER.md`.)

The generator knows none of this. It mechanically strips affixes, running its
rules to exhaustion. For _kepunyaanku_ it produces, in order: _kepunyaanku_, _kepunyaan_,
_kepunya_, _kepu_, _pu_, _punya_, _punyaan_, _punyaanku_. Every one of these comes from
_stripping_, never from appending a suffix: _punyaan_ and _punyaanku_ look as though _-an_
or _-anku_ had been added to the root, but they are just _kepunyaan_ and _kepunyaanku_ with
the _ke-_ prefix peeled off as the recursion backtracks. So this is not a march toward a base: the bare root _punya_
lands at position 6, ahead of two of the nonsense forms rather than at the end. The
generator does not stop when it happens to produce a real word. What stops early is the
_lookup_: _kepunyaan_, candidate 2, is a keyword, so the search halts there, long before
the rest are reached.

```mermaid
sequenceDiagram
    autonumber
    actor U as Learner
    participant S as Search
    participant G as Variation generator
    participant D as Teeuw dictionary

    U->>S: look up "kepunyaanku"
    S->>G: generate variations
    Note over G: emit the input unchanged first,<br/>then strip affixes by rule, with no notion of a base
    G-->>S: [kepunyaanku, kepunyaan, ... punya (6), ... punyaanku]
    S->>D: "kepunyaanku"?
    D-->>S: no match
    S->>D: "kepunyaan"?
    D-->>S: match: keyword, base "punya", sublemma "kepunyaan"
    Note over S: stop at candidate 2.<br/>The "punya" candidate (6) is never queried
    S-->>U: entry shown as sublemma "kepunyaan" under base "punya"
```

<small>**Figure 3.** Looking up _kepunyaanku_.</small>

The point: the search stops at _kepunyaan_, a **sublemma**, and the entry surfaces under
its base _punya_, without the lookup ever querying the bare _punya_ candidate that the
generator did produce. Of the
eight candidates only two are queried (_kepunyaanku_, then _kepunyaan_); the rest, the
real base and the nonsense alike, are never looked up.

### 3. A word the dictionary does not contain: _diinstal_

Finally, the user types _diinstal_ ("was installed"), from the loanword _instal_. The
generator does everything right: it strips _di-_ to _instal_, rebuilds the active
_menginstal_, and emits the non-word _nginstal_. But Teeuw was published in 1996 and
predates this borrowing, so none of the four candidates (_diinstal_, _menginstal_,
_instal_, _nginstal_) is a keyword. Each is queried in turn and rejected, and the search
returns no result. This is also what happens on a **typo**: the forms are well-shaped, but
there is nothing for them to match.

The dictionary is the final authority, and its verdict here is simply that the word is not
in Teeuw. A generator that had "analysed" its way to a confident single base would report
the same emptiness, only after more work.

## Why not a stemmer?

A stemmer (for Indonesian, the classic Nazief and Adriani algorithm, or the Enhanced
Confix Stripping method behind the Sastrawi library) reduces a word to a single
canonical base. It is the natural tool for some jobs, but **dictionary lookup is not
one of them**, for two reasons:

1. Teeuw already returns the canonical base on every successful hit, so reducing the
   query to a base first adds little.
2. The generator produces not only the base but **sideways forms** a stemmer never
   would: from passive _dibakar_ it offers active _membakar_, a keyword the dictionary
   lists in its own right and often the form a learner most needs. A stemmer aiming at a
   single base would skip straight past it.

There _is_ a natural home for a real stemmer in Taalwiz, but it is a different feature:
**free-text search over article content**. To search a body of text, you normalise both
the query and every word in the text to a shared base key, so that a search for
_memukul_ matches an article containing _dipukul_. That is the textbook stemming use
case (many-to-many matching at scale), and it is genuinely distinct from resolving one
typed word against one dictionary. Until that feature exists, the candidate generator
is the right tool.

## Further reading

- James Neil Sneddon, K. Alexander Adelaar, Dwi Noverini Djenar and Michael C. Ewing,
  _Indonesian: A Comprehensive Grammar_ (2nd ed., Routledge, 2010). The reference grammar
  for the affix descriptions and terminology on this page.
- B. Nazief and M. Adriani, _Confix-Stripping: Approach to Stemming Algorithm for Bahasa
  Indonesia_ (Faculty of Computer Science, University of Indonesia, 1996), and the
  Enhanced Confix Stripping (ECS) method implemented by the Sastrawi stemmer, both
  discussed under [Why not a stemmer?](#why-not-a-stemmer).
