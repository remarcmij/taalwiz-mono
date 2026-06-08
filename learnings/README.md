# Learnings

Short, self-contained notes capturing software-engineering reasoning and
vocabulary that came up while working on Taalwiz. Written for learning, not as
project documentation: each note explains _why_ a decision was made and the
general concepts behind it, so the ideas transfer beyond this codebase.

Newest first. Filename convention: `YYYY-MM-DD-kebab-case-topic.md`.

| Date | Note | In one line |
|---|---|---|
| 2026-06-08 | [Table-driven refactor](2026-06-08-table-driven-refactor.md) | Turning a hand-written `if`-ladder into a data-driven rule pipeline: naming the rule shapes, why order is load-bearing, and pinning behaviour with a characterization test first. |
| 2026-06-08 | [Shared morphology rules](2026-06-08-shared-morphology-rules.md) | When the same bug appears in two files: duplicated knowledge, single source of truth, and why a "consistency" test can't catch a shared mistake. |
