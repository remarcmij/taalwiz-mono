# Learnings

Short, self-contained notes capturing software-engineering reasoning and
vocabulary that came up while working on Taalwiz. Written for learning, not as
project documentation: each note explains _why_ a decision was made and the
general concepts behind it, so the ideas transfer beyond this codebase.

> **Audience / why this is in the repo.** These are the maintainer's personal
> learning notes (Jim is an autodidact software engineer; this is where the
> reasoning behind certain decisions gets worked out and the concepts named).
> They are intentionally _not_ standard project docs and are not required reading
> for contributors — the authoritative docs live next to the code they describe
> (`SEARCH.md`, `MORPHOLOGY_AID.md`, `CLAUDE.md`, the compiler's `TEEUW_PARSER.md`).
> Keeping these in-repo (rather than a private notebook) means a note sits next to
> the commit that prompted it and travels with the code. Treat them as a learning
> journal, not as guidance you must follow.

Newest first. Filename convention: `YYYY-MM-DD-kebab-case-topic.md`.

| Date | Note | In one line |
|---|---|---|
| 2026-06-08 | [What the codebase can't tell the agent](2026-06-08-working-with-a-coding-agent.md) | A project-agnostic process note on working with a coding agent: it knows only the code, so the human must supply the ground truth and judgment that live outside the repo (domain knowledge, external references, instinct). |
| 2026-06-08 | [Bug-to-refactor retrospective](2026-06-08-bug-to-refactor-retrospective.md) | Synthesis of the session: what the whole arc (one bug -> single source of truth) actually achieved, and the transferable recipe. |
| 2026-06-08 | [Table-driven refactor](2026-06-08-table-driven-refactor.md) | Turning a hand-written `if`-ladder into a data-driven rule pipeline: naming the rule shapes, why order is load-bearing, and pinning behaviour with a characterization test first. |
| 2026-06-08 | [Shared morphology rules](2026-06-08-shared-morphology-rules.md) | When the same bug appears in two files: duplicated knowledge, single source of truth, and why a "consistency" test can't catch a shared mistake. |
