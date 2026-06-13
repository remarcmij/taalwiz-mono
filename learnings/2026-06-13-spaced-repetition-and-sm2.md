# Spaced repetition and SM-2

_2026-06-13. How spaced-repetition scheduling works, the SM-2 algorithm Taalwiz
uses, and where it sits relative to the newer FSRS. A concepts note, not a code
note: the implementation lives in
[srs.service.ts](../apps/api/src/srs/srs.service.ts) (`applySm2()` and
`reviewCard()`), and the user-facing study flow is modelled on Anki._

---

## The one-paragraph orientation

Spaced repetition (SRS) schedules each review of a flashcard at the moment you
are about to forget it, then pushes the next review further out as the memory
strengthens. It rests on two of the oldest empirical findings in psychology
(Ebbinghaus, 1885):

- **The forgetting curve** — memory decays predictably over time.
- **The spacing effect** — repetitions spread out over time beat the same
  repetitions crammed together.

SRS just operationalises those two facts. This is not an app-era engagement
trick; it is 140-year-old cognitive science. That lineage matters: it places a
vocabulary tool in the tradition of memory research rather than gamification
(real texts, real lexicography, no streak-nagging).

---

## The science (what actually underwrites it)

Two robust findings sit under any SRS:

- **Spacing effect** — distributed practice beats massed practice (cramming).
- **Testing effect / retrieval practice** — the act of _recalling_ (as on a
  flashcard) strengthens memory more than re-reading. A flashcard flip is
  retrieval practice, not just exposure.

Anchors:

- **Ebbinghaus (1885)**, _Über das Gedächtnis_ (On Memory) — the forgetting
  curve and the founding of experimental memory research. He tested himself with
  nonsense syllables and observed both the decay curve and the spacing benefit.
- **Cepeda, Pashler, Vul, Wixted & Rohrer (2006)**, "Distributed practice in
  verbal recall tasks: A review and quantitative synthesis," _Psychological
  Bulletin_ — a large meta-analysis confirming the spacing effect.
- **Roediger & Karpicke (2006)**, "Test-enhanced learning" — the testing effect.

---

## SM-2 in a nutshell

SM-2 is the spaced-repetition algorithm published by Piotr Woźniak for SuperMemo
in 1987. Each card carries three numbers:

- **repetitions (n)** — how many times in a row it has been recalled correctly.
- **easiness factor (EF)** — how "easy" the card is; starts at **2.5**, never
  below **1.3**. Higher EF = intervals grow faster.
- **interval (I)** — days until the next review.

After each review you grade recall quality. Original SM-2 uses a **0–5** scale
(0 = blackout, 5 = perfect). Modern apps collapse this to a few buttons.

**On a correct recall (q ≥ 3):**

- if n = 1 → I = 1 day
- if n = 2 → I = 6 days
- if n > 2 → I = round(previous I × EF)
- then n = n + 1

**On a failure (q < 3):**

- reset n = 0 and I = 1 (the card re-enters learning and is repeated soon)

**Update EF every time** (then clamp to ≥ 1.3):

```
EF' = EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))
```

Worked values for the EF update: q=5 → +0.10; q=4 → +0.00; q=3 → −0.14;
q=2 → −0.32; q=0 → −0.80. So perfect recalls ease the card; hard or failed
recalls make it come back sooner and grow more slowly.

**The core idea:** correct answers multiply the interval by EF (exponential
growth, so reviews get rare); failures collapse the interval back to ~1 day and
lower EF, so hard cards stay frequent. That is the whole engine.

---

## How it relates to the newer FSRS

- **SuperMemo** is the reference origin of SM-2 (Woźniak, 1987), _not_ Anki.
- **Anki** is the most popular SRS app and used an SM-2 variant for years, but
  since v23.10 (Nov 2023) it ships **FSRS** (Free Spaced Repetition Scheduler),
  now the default. So today's Anki schedules with FSRS, not SM-2.
- **FSRS** is a statistics-based algorithm that fits a model to each learner's
  own review history; benchmarks claim ~20–30% fewer reviews than SM-2 for the
  same retention.

The natural question is "why SM-2 and not FSRS?" SM-2 is **simple, transparent,
proven, and needs no training data or per-user history** — a good fit for a
focused vocabulary tool. FSRS's advantage shows up at scale, where there is a lot
of review data to fit its model. SM-2 is a sound, well-understood baseline; FSRS
is a credible future upgrade if the user base and review history ever justify it.
That reframes "old algorithm" as a deliberate engineering trade-off rather than a
shortcoming.

---

## How Taalwiz implements it

- **Algorithm:** SM-2, server-side. Source:
  [srs.service.ts](../apps/api/src/srs/srs.service.ts) (`applySm2()` and
  `reviewCard()`). The exact constants (EF steps, starting intervals) live there
  and are worth reading alongside the canonical SM-2 above.
- **Buttons:** three — **Again / Good / Easy** (vs Anki's four). Roughly: Again ≈
  a failure (q < 3), Good ≈ q≈4, Easy ≈ q≈5.
- **Granularity:** whole **days** (no sub-day "learning steps" like Anki's), so a
  card never becomes newly due _during_ a sitting.
- **Again behaviour:** the server sets the card's `dueDate = now` (it stays due),
  and the study session **re-queues** the card so it comes back later in the same
  session; the session completes only once every card has gotten a Good/Easy.
- **Practice mode:** an on-demand cram over a whole list, random order, that does
  _not_ submit reviews — the schedule is untouched. (Anki calls this "custom
  study.") Good for warm-ups without disturbing the spacing.

The pipeline the feature is built around: read a real text → tap a word → look it
up in the Teeuw-grounded dictionary → bookmark it (with its source sentence) →
review it later via SM-2, in context. The lexicography and corpus are the
differentiator; SM-2 is the well-established retention engine underneath.

---

## Further reading

**Why spaced repetition works (evidence-based):**

- **Michael Nielsen, "Augmenting Long-term Memory"** —
  https://augmentingcognition.com/ltm.html
  The best single essay on _why_ spaced repetition works and what it feels like
  in practice. Start here.
- **Gwern Branwen, "Spaced Repetition for Efficient Learning"** —
  https://gwern.net/spaced-repetition
  Heavily researched and cited, with the cost-benefit analysis ("is it worth it,
  and when?").

**The algorithm itself (SM-2):**

- **SuperMemo / Piotr Woźniak, "Algorithm SM-2"** —
  https://super-memory.com/english/ol/sm2.htm
  The primary source for the exact algorithm. Dense but authoritative. See also
  SuperMemo's "General principles of spaced repetition and learning."

**Practical mechanics:**

- **Anki manual** — https://docs.ankiweb.net
  Plain-language background on rating buttons, intervals, and ease. (Anki uses
  four buttons — Again/Hard/Good/Easy — where Taalwiz uses three.)

**Quick primer:**

- **Wikipedia, "Spaced repetition"** —
  https://en.wikipedia.org/wiki/Spaced_repetition
  History (Ebbinghaus, Leitner) and vocabulary. A 5-minute overview.

**The phenomenology of memory (the opposite extreme):**

- **A.R. Luria, _The Mind of a Mnemonist_ (1968)** — the classic case study of
  Shereshevsky ("S."), a memory with seemingly no forgetting curve, sustained by
  synesthesia and the method of loci. It brackets the SRS question from the other
  end: not "how do we make a memory hold" but "what it costs when it holds too
  well." S. could recite a passage perfectly yet struggled to abstract or read
  for meaning, because every word detonated into vivid sensory imagery. A quiet
  argument for meaning-in-context (real texts, the source sentence) over raw rote
  retention — and a useful reminder that more memory is not unconditionally
  better.
