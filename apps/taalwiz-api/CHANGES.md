# Changes — taalwiz-api

## 2026-05-15 — SRS flashcard backend

New `SrsModule` providing spaced-repetition card state for bookmarked words. SRS cards are stored in a dedicated `srs_cards` MongoDB collection keyed on `{ userId, listId, word, lang }`. Cards are created automatically when a bookmark is added and deleted when the bookmark (or its list) is removed.

### Algorithm

Simplified SM-2 with three ratings:

| Rating | Interval | Ease Δ |
|--------|----------|--------|
| Again  | reset to 1 day | −0.20 (floor 1.3) |
| Good   | 1 → 6 → `round(interval × ease)` days | — |
| Easy   | 4 → 10 → `round(interval × ease × 1.3)` days | +0.15 (cap 4.0) |

The core calculation is in the exported pure function `applySm2()` (unit-tested in `srs.service.spec.ts`).

### Schema

**`SrsCard`** — `userId`, `listId`, `word`, `lang`, `interval` (days, default 1), `easeFactor` (default 2.5), `dueDate` (default now), `reps` (default 0), `lapses` (default 0). Unique index on `{ userId, listId, word, lang }`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/srs/due?listId=<id>` | Cards due today for the specified list |
| `GET` | `/api/v1/srs/stats` | `{ listId, due, new, total }[]` — one entry per list with cards |
| `POST` | `/api/v1/srs/review` | Submit `{ word, lang, listId, rating }`; returns `{ dueDate }` |

### Files

| File | Change |
|------|--------|
| `src/srs/models/srs-card.model.ts` | New — Mongoose schema |
| `src/srs/dto/review-srs-card.dto.ts` | New — class-validator DTO |
| `src/srs/srs.service.ts` | New — SM-2 logic (`applySm2`), DB ops |
| `src/srs/srs.service.spec.ts` | New — 13 unit tests for `applySm2` |
| `src/srs/srs.controller.ts` | New — REST endpoints |
| `src/srs/srs.module.ts` | New — NestJS module (exported `SrsService`) |
| `src/bookmarks/bookmarks.service.ts` | Inject `SrsService`; cascade create/delete on bookmark add/remove/list-delete |
| `src/bookmarks/bookmarks.module.ts` | Import `SrsModule` |
| `src/app.module.ts` | Register `SrsModule` |

---

## 2026-05-15 — Named bookmark lists + UserPreferences

Extended the bookmarks feature to support multiple named lists per user. Added server-side `UserPreferences` to persist the user's selected list across devices.

### Schema changes

- **`BookmarkList`** (new collection) — `userId` (ObjectId ref User), `name` (string), `createdAt`. Compound unique index on `{ userId, name }`. `findAllLists` auto-seeds a "Favorites" list for users with no lists.
- **`Bookmark`** (modified) — Replaced `listName: String` with `listId: { type: ObjectId, ref: 'BookmarkList', required: true }`. Unique index updated to `{ userId, listId, word, lang }`.
- **`UserPreferences`** (new collection) — `userId` (unique ObjectId), `currentBookmarkListId` (nullable ObjectId). Syncs the active list selection across devices.

### Endpoints

All endpoints are JWT-protected via the global auth guard.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/bookmarks/lists` | List all bookmark lists with word counts; auto-creates "Favorites" if none exist |
| `POST` | `/api/v1/bookmarks/lists` | Create a list `{ name }`; returns `{ id, name, count }` |
| `DELETE` | `/api/v1/bookmarks/lists/:id` | Delete a list and cascade-delete its bookmarks (204) |
| `PATCH` | `/api/v1/bookmarks/lists/:id` | Rename a list `{ name }` (204) |
| `GET` | `/api/v1/bookmarks?listId=<id>` | List bookmarks in the specified list, sorted by `savedAt` desc |
| `POST` | `/api/v1/bookmarks` | Add bookmark `{ word, lang, listId }`; upsert (no-op on duplicate) |
| `DELETE` | `/api/v1/bookmarks?word=&lang=&listId=<id>` | Remove a bookmark |
| `GET` | `/api/v1/user-preferences` | Get `{ currentBookmarkListId }` |
| `PATCH` | `/api/v1/user-preferences` | Set `{ currentBookmarkListId }` (204) |

### Files

| File | Change |
|------|--------|
| `src/bookmarks/models/bookmark-list.model.ts` | New — `BookmarkList` Mongoose schema |
| `src/bookmarks/models/bookmark.model.ts` | Replace `listName` string with `listId` ObjectId FK; update unique index |
| `src/bookmarks/dto/create-bookmark-list.dto.ts` | New |
| `src/bookmarks/dto/rename-bookmark-list.dto.ts` | New |
| `src/bookmarks/dto/create-bookmark.dto.ts` | Replace `list?` with `listId` |
| `src/bookmarks/bookmarks.service.ts` | Add list CRUD + count aggregation; `findAll/add/remove` use `listId` |
| `src/bookmarks/bookmarks.controller.ts` | Add list routes declared before bookmark routes |
| `src/user-preferences/models/user-preferences.model.ts` | New |
| `src/user-preferences/dto/update-user-preferences.dto.ts` | New |
| `src/user-preferences/user-preferences.service.ts` | New |
| `src/user-preferences/user-preferences.controller.ts` | New |
| `src/user-preferences/user-preferences.module.ts` | New |
| `src/app.module.ts` | Register `UserPreferencesModule` |

---

## 2026-05-15 — Word bookmarks API

New `bookmarks` module providing per-user bookmark storage backed by MongoDB.

### Schema

`BookmarkSchema` stores `userId` (ObjectId ref User), `listId` (ObjectId ref BookmarkList), `word`, `lang`, and `savedAt`. A compound unique index on `{ userId, listId, word, lang }` prevents duplicates.

### Endpoints

All endpoints are JWT-protected via the global auth guard. The current user's ID is extracted from the JWT payload attached to `request['user']` by `AuthGuard`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/bookmarks?listId=<id>` | List all bookmarks for the current user in the specified list |
| `POST` | `/api/v1/bookmarks` | Add a bookmark `{ word, lang, listId }`; upsert (no-op on duplicate) |
| `DELETE` | `/api/v1/bookmarks?word=&lang=&listId=<id>` | Remove a bookmark; query params used to avoid URL-encoding issues with non-ASCII words |

### Files

| File | Change |
|------|--------|
| `src/bookmarks/models/bookmark.model.ts` | New — Mongoose schema + `BookmarkDoc` type |
| `src/bookmarks/dto/create-bookmark.dto.ts` | New — class-validator DTO |
| `src/bookmarks/bookmarks.service.ts` | New — `findAll`, `add` (upsert), `remove` |
| `src/bookmarks/bookmarks.controller.ts` | New — REST endpoints |
| `src/bookmarks/bookmarks.module.ts` | New — NestJS module |
| `src/app.module.ts` | Register `BookmarksModule` |

---

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
