# What the codebase can't tell the agent

_2026-06-08. A process note, not a technical one, and deliberately
project-agnostic: you do not need to know anything about this codebase to read it.
It distills one realisation from a long pairing session between a maintainer and a
coding agent (Claude Code) into something transferable to anyone learning to work
with these tools — including students and fellow mentors._

---

## The one realisation

A coding agent is a fast, tireless, prolific coder. It can read every file in a
project, transform hundreds of places at once, and write its own throwaway tools
to do so. What it **cannot** do is know anything that is not in front of it. It
sees the code. It does not see the world the code is *about*.

In this session, almost every input that actually mattered came from outside the
codebase:

- a **printed reference book** the human had on the desk, which the agent could
  only use once the human photographed a few pages and handed them over;
- the human's **domain knowledge** — which outputs were plausible and which were
  nonsense — none of it written down anywhere the agent could read;
- the human's **instinct** that a proposed explanation "felt more complicated than
  it should be", which turned out to be the key to the whole solution.

The agent produced the breadth and the mechanics. The human produced the
**ground truth and the judgment**. The collaboration worked precisely because the
human kept supplying what the repository could not contain.

---

## Why this is the lesson, not a detail

It is tempting to think the skill of working with an agent is "writing good
prompts". The more useful framing is: **the agent's knowledge stops at the edge of
the codebase, and your job is to bridge that edge.** Everything downstream follows
from taking that seriously.

1. **The agent is confidently wrong exactly where the code runs out.** When the
   right answer depends on a fact that lives outside the repo, the agent does not
   stop and say "I don't know this". It produces a fluent, plausible, wrong answer
   with good reasons attached. It cannot reliably tell when it has stepped past
   what the code can justify. So fluency is not a signal of correctness, and you
   cannot wait for the agent to flag its own blind spots.

2. **The boundary is the context window, not just the repo.** Even code the agent
   has worked on extensively is not a model it *holds*; it rebuilds from whatever is
   loaded in the moment. So "it's in the repo" does not mean "the agent has it."
   Runtime behaviour, how a screen really renders, a choice made in an earlier
   session — all may need to be put back on screen even though they are, in
   principle, derivable. Showing is usually cheaper than making it re-derive.

3. **Your most valuable inputs are the ones not derivable from the code.** A photo
   of a reference. A "no, that's not how this domain works". A hunch. The agent
   could never have reached these by reading the repository harder. This is also
   why a passive "just fix it" fails: it withholds the very thing only you can
   provide.

4. **Hand over your ground truth explicitly — the agent can't reach for the book
   on your desk.** Paste the spec, screenshot the page, describe the constraint,
   show the real output. A surprising amount of stuck-ness dissolves the moment
   the off-screen truth is put on screen.

5. **Trust your instinct enough to overrule fluent output.** The turning point was
   a human saying, in effect, "this shouldn't need to be that hard." That doubt
   was information the code did not contain. Treat the agent's output as a strong
   draft to be challenged, not an answer to be accepted.

6. **Build the shared mental model first; the code is the easy part.** Most of the
   effort went into *understanding the problem together* — and the understanding
   only became correct once the human's external knowledge was folded in. Once the
   model was right, the implementation was small. Don't let the agent rush to code
   past a model you haven't actually agreed on.

7. **Verify with a method independent of how the work was done.** Because the agent
   can't see its own blind spots, have it check its work a different way than it
   produced it. Two independent methods that agree are worth far more than one that
   is sure.

8. **You own the scope and the stopping point.** The agent will happily keep
   going. Deciding "this is good enough, and here is the honest boundary" is a
   judgment that needs the human's sense of what matters — which, again, is not in
   the code.

---

## The one-sentence version

> A coding agent knows only what is in the codebase; you know what the codebase is
> about — so the collaboration is worth more than either alone exactly to the
> extent that you keep supplying the ground truth and judgment the code cannot
> contain.

---

## The honest caveat

This whole dynamic assumes the human actually has, or can get, the outside
knowledge — and is willing to be hands-on: fetch the reference, correct the
framing, make the call. Hand an agent a domain you don't understand and ask it to
"just handle it", and its fluency will produce confident, plausible, wrong work
that you have no way to catch. The tool amplifies the operator; it does not
replace them. The skill being learned is not prompting. It is collaboration: what
to delegate, what to supply that isn't in the code, when to overrule, and when to
stop.

---

## Transferable recipe

1. Assume the agent knows only what is in the repo; everything else is yours to
   supply.
2. Remember its memory is the context window: re-supply runtime behaviour and
   decisions from earlier sessions — "it's in the repo" is not "it has it".
3. Put your off-screen ground truth on screen — paste it, screenshot it, describe
   it.
4. Treat fluent output as a draft; it can't tell you when it has guessed past the
   code.
5. Push back on instinct; "that feels wrong" is information the codebase lacks.
6. Agree on the mental model before asking for code.
7. Let it do the breadth and the tooling; you do the grounding.
8. Verify with an independent method.
9. Decide the scope and the stopping point yourself.
