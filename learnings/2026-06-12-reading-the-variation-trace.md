# When "give" generates "fish": reading a variation trace

_2026-06-12. Three lookups in the Indonesian dictionary — `ikan`, `berikan`,
`memberikan` — and what their variation-generator traces reveal. A reading note,
not a code note: the morphology lives in
[SEARCH.md](../apps/web/src/app/home/dictionary/SEARCH.md) and the
[How Search Works](../apps/docs/docs/how-search-works.md) guide._

---

## Turning the trace on

The tree is off by default and printed only when the `taalwiz.trace-variations`
localStorage flag is set, read as a verbosity level. In the browser DevTools
console:

```js
localStorage.setItem('taalwiz.trace-variations', '1'); // flat variations line only
localStorage.setItem('taalwiz.trace-variations', '2'); // + the tree
localStorage.removeItem('taalwiz.trace-variations');   // disable
```

At level `2`, every dictionary lookup prints its tree (and the flat
`word -> [...]` list) to the console; level `1` logs just the flat list. The flag
is read from `localStorage`, so it persists across reloads until you remove it.

---

## How to read a tree

The generator turns a typed word into a list of candidate forms, then looks each
up in the dictionary, stopping at the first real hit. The trace draws that as a
tree: each line is `<rule> ► <form>  <#N>`, where `#N` is the form's place in the
final candidate list. `(dup)` marks a form already produced higher up. The flat
`word -> [...]` line below each tree is the same list in lookup order, with the
form that actually matched flagged `=`.

A meN-/peN- nasal strip that **restores a dropped root consonant** annotates it as
`+<letter>`. The prefix assimilates to the root's first sound and often swallows
it (`me` + `terima` → `menerima`), so recovering the root means putting that
letter back:

```
menerima  #1
├─ nasal men- ► erima  #2
├─ nasal men- +t ► terima  #3
│  └─ strip ter- ► ima  #4
└─ nasal me- ► nerima  #5
```

`nasal men- +t ► terima` is the line that recovers the real root — and the `+t`
is the only reason `terima` appears at all. (For the common p/t/s/k-initial roots
the `+<letter>` line is usually the one that hits; it is not a correctness flag,
though — `mengambil → meng- +k ► kambil` restores a `k` that matches nothing.)

---

## 1. `ikan` — a word that needs no morphology

```
ikan  #1
→ [ikan]
```

`ikan` ("fish") is already a dictionary keyword, and no affix rule applies, so
the only candidate is the word itself. The simplest possible case: type a root,
get the root.

## 2. `berikan` and `memberikan` — same family, same candidates

```
berikan  #1
├─ -kan/-i -> meN- ► memberikan  #2
│  ├─ strip -kan ► memberi  #3
│  │  ├─ strip -i ► member  #4
│  │  │  ├─ nasal mem- ► ber  #5
│  │  │  └─ nasal me- ► mber  #6
│  │  ├─ nasal mem- ► beri  #7
│  │  │  └─ strip -i ► ber  (dup)
│  │  └─ nasal me- ► mberi  #8
│  │     └─ strip -i ► mber  (dup)
│  ├─ strip -an ► memberik  #9
│  │  ├─ nasal mem- ► berik  #10
│  │  │  └─ strip ber- ► ik  #11
│  │  └─ nasal me- ► mberik  #12
│  ├─ nasal mem- ► berikan  (dup)
│  │  └─ strip ber- ► ikan  #13
│  └─ nasal me- ► mberikan  #14
│     ├─ strip -kan ► mberi  (dup)
│     └─ strip -an ► mberik  (dup)
├─ strip ber- ► ikan  (dup)
├─ strip -kan ► beri  (dup)
└─ strip -an ► berik  (dup)
→ [berikan, memberikan, memberi, member, ber, mber, beri, mberi, memberik, berik, ik, mberik, ikan, mberikan]
```

`memberikan` produces the **same fourteen candidates** in a different order
(compare the two `→ [...]` lists). That makes sense: `berikan` and `memberikan`
are the same morphological family — `-kan/-i → meN-` rebuilds `memberikan` from
`berikan`, and `memberikan` strips back down toward `beri`. So the set of
candidates belongs to the family, not to the word you typed; the typed word only
decides where the walk starts, and therefore the order things get looked up in.

## 3. `berikan → ikan` — two words, no relation

The line to notice is `strip ber- ► ikan`. The generator hands `ikan` ("fish") to
the dictionary as a candidate for `berikan` ("give"). The two words have nothing
to do with each other; `ikan` just falls out of mechanically peeling `ber-` off
`berikan`.

This is the one way the generator could actively mislead: if `berikan` were not
itself in the dictionary, the search could keep going and confidently return the
**fish** entry for someone who typed **give**. What stops it is that `berikan`
*is* a keyword and matches on `#1` (`=berikan`), so `ikan` is never even looked
up. That is the whole reason the typed word is always candidate `#1`: it lets a
real word win before any mechanical strip can produce a real-but-wrong one.

It is worth keeping `berikan → ikan` in mind as the example, precisely because
*give → fish* is such an obviously absurd answer — it makes the safeguard easy to
remember.

---

## The point underneath all of it

The generator does **blind, rule-based string manipulation with no notion of
meaning.** It does not know that `berikan` means "give" or that `ikan` means
"fish"; it just peels and reattaches letters according to the affix rules. Even
the `+t` "restoration" is not understanding — it is one more mechanical string
edit that happens to mirror a phonological rule. Meaning enters the system in
exactly one place: the dictionary lookup. The generator proposes; the dictionary
disposes. That division is the whole design — it is why over-generating junk is
safe (a non-word matches nothing) and why the only real danger is a junk string
that *happens* to be a real, unrelated word. The machine never knows what a word
means; it only knows whether the dictionary has heard of it.
