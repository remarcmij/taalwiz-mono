# Changes — taalwiz-web

## 2026-05-15 — Word bookmarks ("My Words")

### Summary

Users can now save dictionary words for later review. A bookmark icon appears on each dictionary lemma card and in the word-click modal. A new "My Words" tab lists all saved words; tapping one navigates to the dictionary and runs the lookup. Bookmarks are stored server-side (MongoDB) so they persist across devices and sessions.

The bookmark schema includes a `listName` field (currently always `'default'`) to support multiple named word lists in a future enhancement without requiring a schema migration.

### Changes

- **`BookmarkService`** (new) — `providedIn: 'root'` service that maintains two reactive signals: `bookmarks` (full list, newest-first) and `bookmarkedKeys` (a `Set<string>` for O(1) `isBookmarked()` checks). Loads from the API on login, clears on logout. Adds and removes are optimistic: the signals update immediately and are rolled back if the API call fails. `isEnabled` computed signal gates UI to logged-in users only.

- **`BookmarksPage`** (new) — "My Words" tab with an `ion-list` of saved words. Each row shows the word, a relative-time note, and a language badge. Tap to navigate to the Dictionary tab and run a full lookup. Swipe left to reveal a "Remove" action.

- **`dictionary.page.ts` / `.html`** — Injects `BookmarkService`; bookmark toggle icon added to the lemma card header (`isFirst` card only). Icon is `bookmark` when saved, `bookmark-outline` when not. `$event.stopPropagation()` prevents the click from bubbling to `ion-content (click)="onClear()"`.

- **`word-click-modal.component.ts` / `.html`** — Injects `BookmarkService`; bookmark toggle icon added to the modal toolbar (before the dictionary-lookup search icon). `isBookmarked` is a `computed` signal so the icon reacts instantly.

- **`home.page.html` / `home.routes.ts`** — New "My Words" tab button (`bookmark-outline` icon); new lazy-loaded route `home/tabs/bookmarks`.

- **`public/i18n/en.json` + `nl.json`** — Added `common.bookmarks`, `common.remove`, `bookmarks.empty`.

### Files

| File | Change |
|------|--------|
| `src/app/home/bookmarks/bookmark.service.ts` | New |
| `src/app/home/bookmarks/bookmarks.page.ts` | New |
| `src/app/home/bookmarks/bookmarks.page.html` | New |
| `src/app/home/bookmarks/bookmarks.page.scss` | New |
| `src/app/home/dictionary/dictionary.page.ts` | Inject `BookmarkService`; add `IonIcon` + `addIcons`; constructor |
| `src/app/home/dictionary/dictionary.page.html` | Bookmark toggle in lemma card header |
| `src/app/shared/word-click-modal/word-click-modal.component.ts` | Inject `BookmarkService`; `isBookmarked` computed; `addIcons` |
| `src/app/shared/word-click-modal/word-click-modal.component.html` | Bookmark toggle button in toolbar |
| `src/app/home/home.page.ts` | Add `bookmarkOutline` to `addIcons` |
| `src/app/home/home.page.html` | Add My Words tab button |
| `src/app/home/home.routes.ts` | Add `bookmarks` child route |
| `public/i18n/en.json` | Add `common.bookmarks`, `common.remove`, `bookmarks.empty` |
| `public/i18n/nl.json` | Mirror Dutch translations |

---

## 2026-05-15 — Persistent search history

### Summary

The dictionary page previously tracked up to 4 recent searches as an in-memory signal that reset on every navigation. This change persists the full history (up to 50 entries) using `@capacitor/preferences` so it survives navigation and app restarts. The breadcrumb strip remains as the quick-access view (newest 4). A `···` breadcrumb appears when there is more history, opening a bottom-sheet modal with the full list.

### Changes

- **`SearchHistoryService`** (new) — `providedIn: 'root'` service wrapping `@capacitor/preferences` (key: `taalwiz.search-history`). Exposes a `history` signal (array of `HistoryEntry`, newest-first). Deduplication on `add()`: an existing entry for the same `word+lang` is removed before prepending the new one, so re-searched words rise to the top. Signal starts at `[]` and self-populates on first async tick via `void this.#loadFromPreferences()` in the constructor — the same pattern used in `AuthService`.

- **`HistoryModalComponent`** (new) — Ionic bottom-sheet modal (`breakpoints: [0, 0.5, 1]`, `initialBreakpoint: 0.5`). Shows the full history as a list: word, relative-time note, language badge. Tap an entry to dismiss the modal and trigger a dictionary lookup. "Clear" button wipes the history in place without closing the modal.

- **`DictionaryPage`** — `recentSearches` is now a `computed` signal derived from `SearchHistoryService.history()` (oldest-first display order). `hasMoreHistory` computed drives the `···` breadcrumb. `addRecentSearch()` delegates to the service. `openHistory()` creates and presents `HistoryModalComponent`; on dismiss with `role === 'select'` it calls `lookup()`.

- **`dictionary.page.html`** — Added `$event.stopPropagation()` to breadcrumb click handlers (prevents bubbling to `ion-content`'s `onClear`). Added `···` breadcrumb shown only when `hasMoreHistory()`.

- **`public/i18n/en.json` + `nl.json`** — Added `dictionary.history`, `dictionary.history-empty`, `dictionary.clear-history`.

### Files

| File | Change |
|------|--------|
| `src/app/home/dictionary/search-history.service.ts` | New |
| `src/app/home/dictionary/history-modal/history-modal.component.ts` | New |
| `src/app/home/dictionary/history-modal/history-modal.component.html` | New |
| `src/app/home/dictionary/dictionary.page.ts` | Use `SearchHistoryService`; `recentSearches` + `hasMoreHistory` computed; `openHistory()` |
| `src/app/home/dictionary/dictionary.page.html` | `stopPropagation` on breadcrumbs; `···` overflow breadcrumb |
| `public/i18n/en.json` | Add `dictionary.history*` keys |
| `public/i18n/nl.json` | Mirror Dutch translations |

---

## 2026-05-15 — Fix autocomplete index to filter by language natively

### Problem

`DictStoreService.findWordsStartingWith` used the `by-word` single-key index and filtered by language in JavaScript. Beyond the inefficiency, a previous attempt to use the `by-word-lang` composite index (`['word', 'lang']`) with a compound range also failed: IDBKeyRange tuple comparison stops at the first element that differs, so words from other languages whose word portion falls inside the prefix range would leak through.

### Changes

- **`dict-store.service.ts`** — Added a `by-lang-word` index (`['lang', 'word']`). With language as the primary sort key, `IDBKeyRange.bound([lang, startString], [lang, startString + '￿'])` pins the language exactly and only bounds the word by prefix — IndexedDB never visits entries from other languages. DB version bumped to 2.

### Files

| File | Change |
|------|--------|
| `src/app/home/dictionary/dict-store.service.ts` | Add `by-lang-word` index; bump DB to v2; use new index in `findWordsStartingWith` |

---

## 2026-05-15 — Architecture review fixes

Seven issues identified during an architectural review, addressed in a single pass.

### Changes

- **`markdown.service.ts`** — Removed spurious `</span>` tags from the `**bold**` and `*italic*` replacement strings in `tinyMarkdown()`. Every bold or italic word was emitting malformed markup.

- **`dict-store.service.ts`** — `open()` is now idempotent: returns immediately if the IndexedDB connection already exists, preventing duplicate connections when `init()` is called from multiple entry points (auth guard and app resume).

- **`dict-sync.service.ts`** — `syncIfNeeded()` now returns immediately if `status$` is already `'syncing'`, preventing a second parallel sync (and a concurrent `replaceAll` on the same transaction) when called from auth guard and app resume in quick succession.

- **`auth.service.ts`** — Removed the `requestHeaders$` observable property and the never-used `json` parameter from `getRequestHeaders()`. There is now one unified way to obtain a Bearer-token header.

- **`content.service.ts`** — `fetchTopics` updated to use `getRequestHeaders()` (was the sole caller of the now-removed `requestHeaders$`).

- **`app.component.ts`** — Removed the redundant `translate.use('nl')` call in `ngOnInit`. The `APP_INITIALIZER` in `main.ts` already guarantees Dutch translations are loaded before bootstrap, so this extra async wrapper served no purpose. The `user$` subscription is now placed directly in `ngOnInit`.

- **`dictionary.service.ts`** — `#lookupResult$` changed from `Subject` to `BehaviorSubject<LookupResult | null>(null)`. A plain `Subject` meant that results fired from `WordClickModalComponent.dictionaryLookup()` (which navigates then immediately calls `lookup()`) could be lost if `DictionaryPage` had not yet rendered and subscribed.

- **`dictionary.page.ts`** — Added `filter(Boolean)` to `results$` to skip the null initial value emitted by the new `BehaviorSubject`.

- **`app.component.ts`** — `currentUser` is now a direct alias to `authService.user` (the signal already maintained by `AuthService`) rather than an independent signal kept in sync by a subscription. The logout-redirect logic is replaced by a `pairwise()` pipe that explicitly detects the logged-in → logged-out transition. Removed unused `signal` and `User` imports.

- **`indonesian-stemmer.ts`** — Removed stale comment claiming a server-side copy of the stemmer exists. The API copy was removed in a previous session; only the client-side copy remains.

### Files

| File | Change |
|------|--------|
| `src/app/home/content/markdown.service.ts` | Fix spurious `</span>` in bold/italic replacements |
| `src/app/home/dictionary/dict-store.service.ts` | Guard `open()` against duplicate calls |
| `src/app/home/dictionary/dict-sync.service.ts` | Guard `syncIfNeeded()` against concurrent syncs |
| `src/app/auth/auth.service.ts` | Remove `requestHeaders$`; simplify `getRequestHeaders()` |
| `src/app/home/content/content.service.ts` | Use `getRequestHeaders()` in `fetchTopics` |
| `src/app/app.component.ts` | Remove redundant `translate.use('nl')`; alias `currentUser` to `authService.user`; `pairwise()` logout redirect |
| `src/app/home/dictionary/dictionary.service.ts` | `lookupResult$`: `Subject` → `BehaviorSubject<LookupResult \| null>` |
| `src/app/home/dictionary/dictionary.page.ts` | Add `filter(Boolean)` to `results$` |
| `src/app/home/dictionary/indonesian-stemmer.ts` | Remove stale "keep in sync with API" comment |

---

## 2026-05-14 — Remove MongoDB API fallback from DictionaryService

Dictionary lookups are now IndexedDB-only. All three lookup paths (`searchDictionary`,
`fetchSuggestions`, `fetchWordLemmas`) no longer fall back to the NestJS API when
IndexedDB is empty. `searchViaApi`, `execSearchRequest`, and `handleError` have been
removed along with their dependencies (`HttpClient`, `AuthService`, `AlertController`,
`TranslateService`).

If the local store is empty (dict sync not yet complete), searches return empty results
silently — the sync-status banner already informs the user that the dictionary is loading.

### Files

| File | Change |
|------|--------|
| `src/app/home/dictionary/dictionary.service.ts` | Removed MongoDB fallback; IndexedDB-only |

---

## 2026-05-14 — Bug fixes and toast notification found during offline-dictionary testing

### Problem

Three bugs were found while testing the offline dictionary feature:

1. **`DictSyncService`** set `status$` to `'offline'` on any non-200 manifest response,
   including a 404. A 404 means no dict files have been uploaded yet — not that the device
   is offline. This caused a misleading "Offline" banner on a fresh install before the first
   admin upload.

2. **`DictionaryService.fetchSuggestions`** used `authService.user().lang` as the
   dictionary search language. `user.lang` is the UI language (`'nl'`/`'en'`), never `'id'`,
   so the Indonesian stemmer was never invoked and `findByPrefix` searched for Dutch words
   starting with the typed term — returning nothing for Indonesian input.

3. **`DictionaryService.searchLocal`** returned a `LookupResult` from `makeLookupResult()`
   without setting `targetBase`. `reorderLookupResult` then threw `Cannot read properties
   of null (reading 'key')` when the user clicked a suggestion.

### Changes

- **`DictSyncService`** — `syncIfNeeded()` now distinguishes a 404 (no dict uploaded yet →
  `'done'`) from other non-ok responses (server error → `'error'`). Genuine network
  failures (fetch throws) remain `'offline'`.

- **`DictionaryService.fetchSuggestions`** — Removed `user.lang` from the local search
  path. The Indonesian stemmer is now always applied and `findByPrefix` always searches
  `lang: 'id'`, matching the behaviour of the existing API `findAutoCompletions` endpoint.

- **`DictionaryService.searchLocal`** — Sets `targetBase` on the result returned by
  `makeLookupResult()` before returning, matching the pattern already used by `searchViaApi`.

- **`AppComponent`** — Subscribes to `DictSyncService.status$` with `pairwise()` and shows
  a toast ("Dictionary ready for offline use") when the status transitions from `'syncing'`
  to `'done'`. The toast fires app-wide so the admin sees it after uploading new files even
  if they are not on the dictionary page at the time.

- **`public/i18n/en.json` + `nl.json`** — Added `dictionary.sync-done` translation key.

### Files

| File | Change |
|------|--------|
| `src/app/home/dictionary/dict-sync.service.ts` | 404 → `'done'`; non-404 non-ok → `'error'` |
| `src/app/home/dictionary/dictionary.service.ts` | Always use Indonesian stemmer + `lang: 'id'` for autocomplete; set `targetBase` in `searchLocal` |
| `src/app/app.component.ts` | Toast on `'syncing' → 'done'` transition |
| `public/i18n/en.json` | Add `dictionary.sync-done` |
| `public/i18n/nl.json` | Add `dictionary.sync-done` |

---

## 2026-05-14 — Offline dictionary via IndexedDB (feature branch: feat/offline-dictionary)

### Summary

The dictionary feature previously required a live network connection for every lookup and
autocomplete request. This change makes the dictionary available offline after the first
authenticated session by downloading compiled dictionary data into IndexedDB on the device.

### How it works

On first authenticated launch `DictSyncService` fetches `/assets/dict-manifest.json` (a
lightweight JSON file listing all compiled dictionary files and a version string). If the
stored version differs — or if IndexedDB is empty — it downloads all listed JSON files in
parallel, transforms each from the compiled `{baseLang, lemmas[]}` format into flat
`ILemma` records, and stores them in IndexedDB. On subsequent launches only the version
string is checked; data is re-downloaded only when the admin has uploaded new dictionary
files. The API lookup and autocomplete endpoints remain as a fallback for the initial sync
window when IndexedDB is still empty.

### Changes

- **`DictStoreService`** (new) — IndexedDB wrapper using the `idb` package. Object stores:
  `lemmas` (auto-increment keys, indexed on `[word, lang]` and `word`) and `meta` (stores
  the current version string). Provides `open`, `replaceAll`, `findByWordAndLang`,
  `findByPrefix`, and `count`.

- **`DictSyncService`** (new) — Fetches the manifest and dict files using plain `fetch()`
  (no auth headers needed — assets are public). Exposes a `status$: BehaviorSubject`
  (`idle | syncing | done | offline | error`) consumed by the dictionary page UI.

- **`indonesian-stemmer.ts`** (new) — Verbatim copy of the API's stemmer for client-side
  use. Both copies carry a comment reminding maintainers to keep them in sync.

- **`DictionaryService`** — Lookup and autocomplete now check `DictStoreService.count()`
  first and serve results from IndexedDB when data is present. Falls back to the API only
  when the store is empty. The existing pagination loop is preserved in the API path.

- **`DictionaryPage`** — Injects `DictSyncService` and shows a sync status banner in the
  header: a progress bar during the initial download, an "offline" note when the network
  is unavailable, and an error note on sync failure. The search input is disabled (with a
  descriptive placeholder) during the very first sync when the store is still empty.

- **`ILemma.model.ts`** — `_id` made optional (was `string`, now `string | undefined`).
  IndexedDB records have no MongoDB ObjectId; API responses still carry one.

- **`lemma.component.html`** — Changed `@for` tracking from `lemma._id` to `$index`.

- **`searchbar-dropdown.component.html`** — Changed `@for` tracking from `suggestion._id`
  to `suggestion.key` (always-present computed property on `WordLang`).

- **`auth.guard.ts`** — Calls `dictSync.init()` (fire-and-forget) after authentication
  succeeds, covering both fresh login and auto-login.

- **`app.component.ts`** — Calls `dictSync.syncIfNeeded()` on Capacitor app resume so the
  dictionary re-syncs if the admin uploaded new files while the app was backgrounded.

- **`ngsw-config.json`** — Added `excludeFiles` to the `assets` SW cache group to prevent
  the service worker from double-caching `dict-manifest.json` and the dict JSON files
  (IndexedDB is the single source of truth for dictionary data).

- **`public/i18n/en.json` + `nl.json`** — Added `dictionary.*` translation keys for the
  sync status banner messages.

### Files

| File | Change |
|------|--------|
| `src/app/home/dictionary/dict-store.service.ts` | New |
| `src/app/home/dictionary/dict-sync.service.ts` | New |
| `src/app/home/dictionary/indonesian-stemmer.ts` | New (copy of API stemmer) |
| `src/app/home/dictionary/dictionary.service.ts` | Local-first lookup and autocomplete |
| `src/app/home/dictionary/dictionary.page.ts` | Inject sync services; `dictIsEmpty` signal; `ionViewWillEnter` count check |
| `src/app/home/dictionary/dictionary.page.html` | Sync status banner; conditional searchbar disabled/placeholder |
| `src/app/home/dictionary/dictionary.page.scss` | `.sync-banner`, `.sync-error` styles |
| `src/app/home/dictionary/lemma/lemma.model.ts` | `_id` made optional |
| `src/app/home/dictionary/lemma/lemma.component.html` | `track $index` instead of `track lemma._id` |
| `src/app/home/dictionary/searchbar/searchbar-dropdown/searchbar-dropdown.component.html` | `track suggestion.key` instead of `track suggestion._id` |
| `src/app/auth/auth.guard.ts` | Call `dictSync.init()` on auth success |
| `src/app/app.component.ts` | Call `dictSync.syncIfNeeded()` on app resume |
| `ngsw-config.json` | Exclude dict files from SW asset cache |
| `public/i18n/en.json` | Add `dictionary.*` sync status keys |
| `public/i18n/nl.json` | Mirror Dutch translations |

---

## 2026-05-13 — Fix i18n not rendering in zoneless mode

### Problem

In Angular's zoneless change detection mode (no Zone.js), translation keys were rendered as raw strings (e.g. `common.app-name`) instead of translated text. The translation file (`nl.json`) loaded successfully (HTTP 200), but components did not re-render after translations became available.

Two root causes:

1. **No `APP_INITIALIZER` to preload translations.** With Zone.js, `TranslatePipe.markForCheck()` implicitly triggered change detection via Zone.js's async patching. Without Zone.js, `markForCheck()` from an RxJS subscription does not reliably wake the Angular scheduler, so the initial render showed raw keys and no re-render followed.

2. **Circular DI dependency via `authInterceptor`.** `TranslateHttpLoader` used the full `HttpClient` (with interceptors). The `authInterceptor` calls `inject(AuthService)` synchronously during subscription setup. `AuthService` injects `TranslateService`, which was already being constructed — causing `NG0200: Circular dependency detected for AuthService`.

### Changes

- **`useHttpBackend: true`** on `provideTranslateHttpLoader` — translation file requests now go directly to `HttpBackend`, bypassing all HTTP interceptors. This breaks the circular dependency and is semantically correct (translation files are public static assets that need no auth).

- **`APP_INITIALIZER`** — blocks the Angular bootstrap until `nl.json` is loaded. The first render then has translations available synchronously, so no async CD cycle is needed.

### Files

| File | Change |
|------|--------|
| `src/main.ts` | Add `useHttpBackend: true`, add `APP_INITIALIZER` to preload translations |

---

## 2026-05-13 — Fix two unhandled Observable errors

### Problem

Two places in the codebase subscribed to Observables that can emit errors without providing an error handler, causing unhandled exceptions.

1. `AdminService.getUsers()` had no `catchError` operator, so any HTTP failure propagated to the subscriber in `UsersPage.ionViewWillEnter()`, which also had no error handler. The admin user list would silently remain empty with no feedback.

2. `WordClickModalComponent.speakWord()` and `speakSentence()` subscribed to `SpeechSynthesizerService.speakSingle()` without error handlers. The speech service emits `observer.error()` on Web Speech API failures, so those errors surfaced as unhandled exceptions. The error was already logged internally by the service, so no additional UI feedback was needed.

### Changes

- **`AdminService.getUsers()`** — Added `catchError` that calls `ApiErrorAlertService.showError()` and returns `of([])`, matching the pattern used by `getSettings()`.

- **`WordClickModalComponent`** — Added `{ error: () => {} }` handlers to both `speakWord()` and `speakSentence()` subscriptions to suppress the unhandled exception. The speech service already logs the error internally.

### Files

| File | Change |
|------|--------|
| `src/app/admin/admin.service.ts` | Add `catchError` to `getUsers()` |
| `src/app/shared/word-click-modal/word-click-modal.component.ts` | Add error handlers to `speakWord()` and `speakSentence()` |

---

## 2026-05-13 — Reactive 401 handling with automatic token refresh

### Problem

When a user's access token expired (e.g. after the computer slept overnight), clicking a word to trigger a dictionary lookup silently failed. The error handler in `WordClickModalService` discarded all errors without user feedback, and the word stayed permanently highlighted with the `.clicked` CSS class. Even though `AuthService` proactively refreshes the access token before each request, a 401 can still reach the client in edge cases such as clock skew between client and server, server-side token revocation, or both the access token and the refresh token having expired.

### Changes

- **`auth.interceptor.ts`** (new) — Angular functional HTTP interceptor that catches 401 responses from any API call, clears the cached access token, and retries the request once with a freshly obtained token. If the retry also fails (e.g. the refresh token has also expired), the user is logged out and redirected to the login page.

- **`AuthService.invalidateToken()`** (new method) — Clears the in-memory token cache, forcing the `token` getter to call the refresh endpoint on its next use. Used by the interceptor to trigger a reactive refresh.

- **`AuthService.logout()`** (changed) — Now navigates to `/auth` after clearing session state. Previously, `logout()` cleared in-memory state and Capacitor Preferences but left the user on the current protected page, giving no feedback that the session had ended.

- **`WordClickModalService`** (fixed) — The error handler now removes the `.clicked` CSS highlight from the target word. Previously the highlight was only removed on modal dismiss, so any error left the word permanently highlighted.

### Files

| File | Change |
|------|--------|
| `src/app/auth/auth.interceptor.ts` | New |
| `src/app/auth/auth.service.ts` | `invalidateToken()` added; `logout()` redirects to `/auth` |
| `src/main.ts` | `provideHttpClient(withInterceptors([authInterceptor]))` |
| `src/app/shared/word-click-modal/word-click-modal.service.ts` | Remove `.clicked` on error |

---

## 2026-05-12 — Right-side TOC sidebar for article pages

### Problem

Articles with many sections (h1–h3 headings) had no in-page navigation. Users had to scroll manually to find a specific section.

### Changes

- **`TocService`** (new) — Thin singleton that holds the current article's heading list as a signal. `ArticlePage` pushes its headings into the service on `ionViewWillEnter` and clears them on `ionViewWillLeave`, so the TOC is always scoped to the active article.

- **`ArticlePage`** — Extracts h1–h3 headings from the rendered HTML into a `headings` computed signal, wires it to `TocService`, and adds a toolbar button (list icon, right slot) that opens the TOC menu. The button is hidden when the article has no headings.

- **`AppComponent`** — Adds a right-side `ion-menu` (id `toc-menu`) that renders the heading list. Heading levels are visually indented (h2 +16 px, h3 +32 px via `--padding-start`). Clicking a heading closes the menu and smooth-scrolls to the target element.

### Files

| File | Change |
|------|--------|
| `src/app/home/content/publication/article/toc.service.ts` | New |
| `src/app/home/content/publication/article/article.page.ts` | Extract headings signal; wire `TocService`; add toolbar toggle button |
| `src/app/home/content/publication/article/article.page.html` | Add end-slot `ion-menu-button` |
| `src/app/app.component.html` | Add `<ion-menu side="end" menuId="toc-menu">` |
| `src/app/app.component.ts` | Inject `TocService` + `MenuController`; add `onTocClick()` |

---

## 2026-05-11 — Auth error-code cleanup and i18n improvements

### Problem

Three related quality issues existed in the auth flows:

1. Nine error-code constants in `shared.ts` were defined but never referenced anywhere in either the web app or the API (dead code).
2. The change-password page showed a single generic failure message regardless of the actual error reason (wrong current password, demo-account restriction, unknown email), losing actionable feedback.
3. The request-password-reset page compared against the raw string literal `'EMAIL_NOT_FOUND'` instead of the imported constant — a maintenance hazard.

### Changes

- **`shared.ts`** — Removed 9 unused constants (`CODE_INVALID`, `CODE_EXPIRED`, `PASSWORD_INCORRECT`, `CODE_DELETE_FAILED`, `INVALID_PASSWORD`, `NO_USER`, `NO_TOKEN`, `USER_NOT_FOUND`, `OK`). Added `DEMO_ACCOUNT` constant (thrown by the API in three places but previously absent from the shared file).

- **`change-password.page.ts`** — Error handler now switches on `errResp.error.message`: `AUTH_FAILED` → "Your current password is incorrect", `DEMO_ACCOUNT` → "Demo accounts cannot change their password", `EMAIL_NOT_FOUND` → existing not-found message, default → existing generic failure message.

- **`request-password-reset.page.ts`** — Replaced string literal comparison `=== 'EMAIL_NOT_FOUND'` with the imported `EMAIL_NOT_FOUND` constant.

- **`public/i18n/en.json` + `nl.json`** — Added two new keys under `auth`: `password-change-wrong-current` and `demo-account-no-password-change`.

### Files

| File | Change |
|------|--------|
| `src/app/server/shared/shared.ts` | Remove 9 unused constants; add `DEMO_ACCOUNT` |
| `src/app/auth/change-password/change-password.page.ts` | Switch on error code; import new constants |
| `src/app/auth/request-password-reset/request-password-reset.page.ts` | Use `EMAIL_NOT_FOUND` constant |
| `public/i18n/en.json` | Add `password-change-wrong-current`, `demo-account-no-password-change` |
| `public/i18n/nl.json` | Mirror new i18n keys in Dutch |

---

## 2026-05-09 — Indonesian stemmer bug fixes

### Problem

A review of `indonesian-stemmer.ts` identified five issues, all confirmed by code tracing:

1. `prefixWithMeng` never matched bare `k`-initial roots (regex `/^(?:g|h|kh)/` missed plain `k`), so `dikritik` never generated `mengritik`.
2. No `-kan` or `-i` suffix strippers existed; `bukakan` could not reach the base `buka`, and `ajari` could not reach `ajar`, blocking related `meN-` prefix generations.
3. A `per`/`pelajar` block in the `di-` stripping path duplicated a recursive call already made by `prefixWithMeng` — dead code that wasted a recursive call (the `Set` prevented output duplication).
4. `SEARCH.md` inaccurately described the `meng-` k-restoration guard, implying `kambil`-style candidates were generated when they are not.
5. High-frequency `ny*`/`ng*` roots (`nyanyi`, `ngaji`) were lost after `meny-`/`meng-` stripping because the stripping produced implausible consonant restorations.

### Changes

- **`indonesian-stemmer.ts`** — Fixed the `prefixWithMeng` regex to include `k`; added `-kan` and `-i` suffix strippers before the existing `-an` rule; removed the redundant `per`/`pelajar` recursive block; added `nyanyi`/`ngaji` to `WordExemptions`.

- **`indonesian-stemmer.spec.ts`** — Added test cases verifying the fixed paths: `dikritik → mengritik`, `bukakan → buka + membukakan`, `ajari → ajar + mengajar`.

- **`SEARCH.md`** — Updated the description of the `meng-` k-restoration guard to accurately reflect that vowel-initial and `g/h`-initial rest strings do not receive k-restoration.

### Files

| File | Change |
|------|--------|
| `src/app/home/dictionary/indonesian-stemmer.ts` | Fix Bug #1 (k-initial roots), Bug #2 (-kan/-i suffixes), Issue #3 (redundant block), Issue #5 (ny/ng exemptions) |
| `src/app/home/dictionary/indonesian-stemmer.spec.ts` | New test cases for fixed paths |
| `src/app/home/dictionary/SEARCH.md` | Correct description of meng- k-restoration guard |
