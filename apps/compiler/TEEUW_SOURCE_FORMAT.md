# Teeuw Source Format

How to read and write the Teeuw dictionary markdown source (`dict/teeuw/*.md`):
the markup conventions, what each symbol means, and the rules an editor must
follow so the compiler accepts the file and interprets it correctly.

This is the **print -> markup** companion to the two engine-facing docs:

- [INTERNALS.md](./INTERNALS.md) — the compile pipeline and the markup table.
- [TEEUW_PARSER.md](./TEEUW_PARSER.md) — exactly how markup becomes the compiled
  JSON (`base` / `keyword` / `homonym`, the Dutch reverse index).

Where those explain how the machine reads the source, this one explains how a
**human** produces it — most concretely, how to add new words in the `teeuw.X+.md`
supplement files so they behave like the rest of the dictionary.

---

## 1. What the source actually is

The markdown is a faithful, human-readable transcription of the printed Teeuw,
encoding its **typography and layout**, not its meaning. A headword is bold and
at the left margin; its run-on forms are bold and indented; its compounds and
examples are italic; the swung dash stands in for a repeated word. The source
re-encodes those visual conventions in plain text, and the compiler then derives
all the structure (what is a headword, a derivation, a homonym) **mechanically**
from that typography. See [TEEUW_PARSER.md](./TEEUW_PARSER.md) Part 1.

Two consequences worth internalising:

- **You transcribe appearance, not linguistics.** You almost never have to decide
  "is this a derivation?" You reproduce what the page shows (bold / italic /
  indentation / swung dash) and the parser does the rest. The one place this
  breaks down is the tilde, which is why [section 5](#5-the--tilde-and-the--revert-marker)
  is the longest.
- **The `~` shorthand is editorial convenience, not a data model.** A swung dash
  saves the editor (and reader) from re-typing the headword on every line. A
  purely computational representation would not use it at all; it would link rows
  in a table. We keep `~` because the source is written and proofread by people.
  That choice is the source of the one genuine subtlety in this format.

This is a **best-effort** digitization. The transcription is careful and the
compiler is strict, but the original is a large, irregular book, and incidental
deviations remain. Aim for faithful, not flawless.

---

## 2. The block rule (this is the backbone)

A **blank line** separates entries. Everything between two blank lines is one
**block**, and the **first bold word of a block is the headword** (the
grondwoord / `base`). Every later bold word in the same block is a run-on form
(`keyword`) under that same headword — it does **not** start a new entry.

```
**indah** I, fraai, mooi;          <- new block: headword `indah`
*~ kabar*, goed nieuws;            <- still `indah`
**memperindah(kan)**, verfraaien;  <- still `indah` (a keyword, not a new entry)
                                   <- blank line: next block resets the headword
**indang**, wan (rijst);           <- new block: headword `indang`
```

If the same headword reappears in a later block, it becomes the next **homonym**
(`kapan I` / `kapan II` in print). The Roman numerals are just text you copy;
the numbering is computed from the repetition. See [TEEUW_PARSER.md](./TEEUW_PARSER.md) §1.2.

---

## 3. Markup vocabulary

| Symbol | Print feature it encodes | Meaning to the compiler |
|--------|--------------------------|-------------------------|
| `**word**` | a bold word (headword or run-on form) | searchable Indonesian keyword; first in a block = `base`, later = `keyword` |
| `*word*` | an italic word (compound, example, cross-reference) | reference form, not independently searchable |
| `~` | the swung dash | shorthand for the current governing bold word (see §5) |
| `^` | (no print equivalent) | revert `~` back to the headword (see §5) |
| `+` | a space inside a multi-word unit you want indexed as one | rendered as a space (`anak+tiri` -> "anak tiri") |
| `-` | a literal hyphen / reduplication | kept as-is (`anak-anak`) |
| `->` | a cross-reference arrow | bold words after it are references, not keywords |
| `_word_` | (editorial) an exotic name in a gloss | skipped: not indexed as a Dutch word (e.g. a Latin plant name) |
| `( )` | an optional word-part, or a descriptive aside | both forms are indexed (long form and short form); see [TEEUW_PARSER.md](./TEEUW_PARSER.md) §1.3 |
| `1`, `2` | a sense number | copied literally; continues the current headword's senses |
| blank line | return to the left margin | ends the block, resets the headword |

Unused/free characters in the corpus include `^` (now the revert marker) — do
not introduce other control characters without updating the tokenizer.

---

## 4. Derivations and compounds (how an entry is built)

Within a block, the print lays an article out in a fixed order (Teeuw's
introduction, "Opbouw artikelen en volgorde afleidingen"):

1. the headword and its numbered senses;
2. its **compounds / fixed expressions** (italic, alphabetical by the second word);
3. proverbs;
4. its **derivations** (bold, affixed forms).

A compound that has its **own** derivation is promoted to **bold on its own line**,
its derivation set immediately after it, and then the headword's alphabetical
compound list **resumes**. This promotion is exactly what creates the tilde
subtlety below.

---

## 5. The `~` tilde and the `^` revert marker

`~` expands to the **nearest preceding bold word** — the lemma the entry is
currently elaborating. Almost always that is what you want:

- in the headword's compound list, `~` is the headword (`*~ kabar*` under `indah`
  is "indah kabar");
- under a derivation, `~` is that derivation (`*~ negeri*` under `pengadilan` is
  "pengadilan negeri").

**The one trap.** When a bold compound with its own derivation sits inside the
headword's compound list, it becomes the "nearest bold word", so the lines after
it would wrongly attach to the compound instead of the headword:

```
**anak**, kind;
**anak+tiri**, stiefkind; *menganaktirikan*, ...;   <- `~` now points at "anak tiri"
*~ tunggal*, enig kind;                              <- WANTS "anak tunggal", gets "anak tiri tunggal"
```

`^` fixes this. A `^` **reverts `~` (and bare sense numbers) back to the
headword**, from that point until the next bold word re-anchors it. Place it
where the headword's list **resumes** — that is, **right after the compound's own
derivation**:

```
**anak**, kind;
**anak+tiri**, stiefkind; *menganaktirikan*, ...;
^
*~ tunggal*, enig kind;     <- "anak tunggal" again
*~ yatim*, wees;            <- still "anak"
2 jong (dier);              <- sense 2 of "anak", not of "anak tiri"
```

The same shape, with genuine sub-compounds kept before the `^`:

```
**rumah+sakit**, ziekenhuis;
*~ bersalin*, kraamkliniek;   <- "rumah sakit bersalin" (kept: a hospital)
*~ jiwa*, ...;                <- "rumah sakit jiwa"
*merumahsakitkan*, ...;       <- the compound's derivation
^
*~ setan*, ...;               <- "rumah setan" (the rumah list resumes)
*~ sewa*, huurhuis;
```

### How to write `^`

- On **its own line**, or as a **prefix** on the resuming sublemma; an optional
  space after the prefix is allowed for readability:

  ```
  ^                       (its own line)
  ^*~ setan*, ...         (prefix, no space)
  ^ *~ setan*, ...        (prefix, with space — same effect)
  ```
- It is a **latch**: one `^` covers every following line until the next bold word,
  so you mark only the resume point, not each line.
- It emits no lemma of its own and never appears in the app.
- It errors at compile time if it appears before any headword.

### When you do *not* need a `^`

- A bold compound whose derivation is on its **own line** (`**akal+budi**, ...;
  *berakal budi*, ...;`): the derivation already closes it, so just put the `^`
  after that line. If the derivation is on the **same line** as the compound and
  no sub-compounds intervene, put the `^` (or the resuming lines) right after it.
- A `2 ...` sense that is the **compound's own** second sense
  (`**susah+payah**, 1 ...; 2 ...;`): leave it; it belongs to the compound.
- A line where a following **bold** form already re-anchors `~` (a new derivation):
  no `^` needed.

Deciding sub-compound-vs-headword is the one judgment that can need the printed
page (is `~ jiwa` a "rumah sakit jiwa" or a "rumah jiwa"?). The Dutch gloss
usually settles it ("psychiatrische kliniek" is a hospital), so this is reading
your own translation, not deep Indonesian. When in doubt, you can always avoid
`~` entirely and write the word out in full (`*rumah setan*`); it compiles to the
same result.

---

## 6. Supplement (`+`) files

To add post-1996 words, create/extend `teeuw.X+.md` (e.g. `teeuw.a+.md`) using the
**exact same markup**. The core files stay untouched; everything in a `+` file is
automatically flagged `isSupplement` and rendered distinctly. Homonym numbering
carries across the core/supplement boundary. Full design in
[TEEUW_PARSER.md](./TEEUW_PARSER.md) Part 2.

Practical checklist for a new entry:

1. Start a block with a blank line before it; the headword is the first `**bold**`.
2. Use `*~ x*` for compounds of the headword; spell Dutch glosses plainly.
3. If you add a bold compound with its own derivation and more headword-compounds
   follow it, drop a `^` after the derivation.
4. Mark exotic gloss names with `_..._` so they are not indexed as Dutch.
5. Recompile (`pnpm --filter compiler run build && pnpm --filter compiler run start`).
   The compiler is strict: a malformed block aborts with the line number, so a
   clean compile is your first proofreading pass.

---

## 7. Validation

A clean compile guarantees the markup is well-formed, not that every `~` resolves
as you intended. Two safety nets:

- **The compiler warns** (non-fatally, with a line number) when a `~` binds to a
  multi-word compound **after that compound's own derivation has appeared** — the
  signature of a missing `^`. Watch the compile output; a warning almost always
  means "add a `^` where the headword's list resumes". It does not abort the build.
- For anything subtle, check the affected entry in the JSON (`json/teeuw.X.json`)
  or the app: a resumed line should read "`headword word`", not "`compound word`".

The `^` rule plus this warning cover the systematic cases; a new one can only
arise from a new bold compound you introduce, and the warning will flag it.
