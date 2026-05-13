# Changes — taalwiz-api

## 2026-05-11 — Distinguish expired vs. invalid password-reset tokens in logs

### Problem

The `resetPassword` catch block logged `'Invalid password reset token'` for both a `TokenExpiredError` and a genuinely invalid/malformed token. The two cases have different remediation paths (ask the user to re-request a link vs. investigate a potential attack), so conflating them made log triage harder.

### Changes

- **`users.service.ts`** — Moved the `logger.error(...)` call into each branch of the existing `if (err instanceof TokenExpiredError)` check, so expired tokens log `'Password reset token expired'` and invalid tokens log `'Invalid password reset token'`.

### Files

| File | Change |
|------|--------|
| `src/users/users.service.ts` | Distinct log messages for expired vs. invalid reset token |

---

## 2026-05-10 — Fix `ContentService.deleteTopic` cascade delete and add unit tests

### Problem

`ContentService.deleteTopic` deleted the `Topic` document from MongoDB but did not cascade to the associated lemmas or articles. This was a regression introduced when porting from the legacy API: the original code called the appropriate loader's `removeTopic` method; the ported version did not. The bug was silent — the topic appeared deleted from the admin view, but stale dictionary/article data remained in the database. No tests existed to catch the regression.

### Changes

- **`content.service.ts`** — `deleteTopic` now calls `this.dictLoader.removeTopic(topic)` for `type: 'dict'` topics and `this.articleLoader.removeTopic(topic)` for `type: 'article'` topics before returning `{ deletedCount: 1 }`.

- **`content.service.spec.ts`** — Added three focused unit tests using Vitest: topic-not-found path returns `{ deletedCount: 0 }` without calling any loader; dict-topic path calls `dictLoader.removeTopic`; article-topic path calls `articleLoader.removeTopic`. Also migrated the existing API tests to Vitest globals.

### Files

| File | Change |
|------|--------|
| `src/content/content.service.ts` | Cascade `removeTopic` on delete |
| `src/content/content.service.spec.ts` | Three new unit tests; migrate to Vitest globals |
