# Changes — taalwiz-api

## 2026-05-15 — Add server-side HTML sanitization to Markdown pipeline

### Problem

`convertMarkdown()` passed `marked` output directly to callers without sanitization. Admin-uploaded `.md` files could contain raw HTML (Markdown allows it), which `marked` would pass through verbatim. A malicious or compromised admin account could inject `<script>` tags, event handlers, or `javascript:` URLs that would be stored in the database and served to all users.

### Changes

- **`src/util/markup.ts`** — Added `sanitize-html` as the final step in `convertMarkdown()`. After `marked.parse()` and the `<table class='table'>` replacement, the HTML is passed through `sanitizeHtml()` with a tight allowlist. Permitted tags cover everything the pipeline legitimately produces: standard Markdown block and inline elements, `<span>` with `id`/`class` (foreign-word and hashtag spans), heading `id` attributes (for TOC), `<table class="table">`, links, and images. All other tags, attributes, event handlers, and non-http(s)/mailto URL schemes are stripped.

### Files

| File | Change |
|------|--------|
| `src/util/markup.ts` | Add `sanitize-html` post-processing step |
| `package.json` | Add `sanitize-html` dependency |

---

## 2026-05-14 — Remove MongoDB dictionary endpoints

The `DictionaryModule` has been deleted entirely. This includes the `/api/v1/dictionary/find`
and `/api/v1/dictionary/autocomplete` endpoints, the `DictionaryService`, `DictionaryController`,
the `Lemma` and `AutoCompletions` Mongoose models, and all associated DTOs.

Dictionary data is now served exclusively as static JSON assets via `ServeStaticModule`. The
Angular client reads from IndexedDB (populated at startup from those assets) and never calls
the API for dictionary lookups.

### Files removed

| File | Reason |
|------|--------|
| `src/dictionary/dictionary.controller.ts` | Endpoints no longer needed |
| `src/dictionary/dictionary.controller.spec.ts` | Controller deleted |
| `src/dictionary/dictionary.service.ts` | MongoDB queries removed |
| `src/dictionary/dictionary.module.ts` | Module deleted |
| `src/dictionary/dto/find-word-params.dto.ts` | DTO no longer needed |
| `src/dictionary/dto/find-word-query.dto.ts` | DTO no longer needed |
| `src/dictionary/models/lemma.model.ts` | Mongoose model no longer needed |
| `src/dictionary/models/completions.model.ts` | Mongoose model no longer needed |

---

## 2026-05-14 — Ignore uploaded dict files in Git

Added `.gitignore` entries for `public/assets/dict-manifest.json` and
`public/assets/*.*.json`. These files are written at runtime by the admin upload flow
and must not be committed.

### Files

| File | Change |
|------|--------|
| `.gitignore` | Ignore `public/assets/dict-manifest.json` and `public/assets/*.*.json` |

---

## 2026-05-14 — Replace DictLoader MongoDB insertion with file-based serving (feature branch: feat/offline-dictionary)

### Summary

Dictionary data is no longer stored in MongoDB. Compiled dictionary JSON files are now
written directly to `public/assets/` when uploaded by the admin, and served as static
assets. A `dict-manifest.json` file lists all available dict files and carries a version
string that the Angular client uses to decide whether to re-sync its IndexedDB store.

The `Lemma` and `AutoCompletions` (Word) MongoDB collections can be dropped after this
change is deployed and verified.

### Changes

- **`DictLoader.ts`** — Replaced entirely. The new `DictFileLoader` still extends
  `BaseLoader` (preserving Topic lifecycle and admin-UI tracking), but instead of
  bulk-inserting Lemma documents into MongoDB it writes the raw JSON file to
  `public/assets/<filename>` and calls `writeDictManifest()` to regenerate the manifest.
  On `removeData` it deletes the file from disk and regenerates the manifest.

- **`manifest-writer.ts`** (new) — Standalone utility that scans `public/assets/` for
  files matching the dict filename pattern (`/^[a-z]+\.[a-z]\.json$/`), builds a manifest
  object `{ version: ISOString, files: string[] }`, and writes it to
  `public/assets/dict-manifest.json`.

### Files

| File | Change |
|------|--------|
| `src/content/loaders/DictLoader.ts` | Replace MongoDB insertion with file write + manifest update |
| `src/content/loaders/manifest-writer.ts` | New — generates `dict-manifest.json` |

### Post-deploy cleanup

Once the feature branch is merged and verified in production:
- Drop MongoDB collection `lemmas`
- Drop MongoDB collection `words` (AutoCompletions)
- Delete `src/dictionary/models/lemma.model.ts`
- Delete `src/dictionary/models/completions.model.ts`
- Remove Lemma/AutoCompletions references from `src/dictionary/dictionary.service.ts`

---

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
