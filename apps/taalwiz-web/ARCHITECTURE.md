# taalwiz-web — Architecture

Angular 20 + Ionic 8 hybrid web/mobile app (Capacitor 7). Standalone components throughout — no NgModules. Zoneless change detection. Lazy-loaded feature routes.

## Table of Contents

1. [High-level overview](#1-high-level-overview)
2. [Folder structure](#2-folder-structure)
3. [Routing](#3-routing)
4. [Feature areas](#4-feature-areas)
5. [Services and state](#5-services-and-state)
6. [HTTP layer](#6-http-layer)
7. [Dictionary (offline-first)](#7-dictionary-offline-first)
8. [Content caching (service worker)](#8-content-caching-service-worker)
9. [Authentication and security](#9-authentication-and-security)
10. [i18n](#10-i18n)
11. [Data models](#11-data-models)

---

## 1. High-level overview

```mermaid
graph TD
    subgraph Bootstrap
        main["main.ts\n(bootstrapApplication)"]
        config["app.config.ts\n(providers)"]
    end

    subgraph Shell
        app["AppComponent\n(Ionic menu + ion-router-outlet)"]
    end

    subgraph Features ["Lazy-loaded features"]
        auth["auth/\n(login, register, password)"]
        home["home/\n(tabs: content | dictionary | hashtags | vocabulary)"]
        admin["admin/\n(users, content, upload, settings)"]
        user["user/\n(welcome, contact, about)"]
    end

    subgraph CrossCutting ["Cross-cutting services"]
        authSvc["AuthService\n(JWT + refresh)"]
        dictSync["DictSyncService\n(IndexedDB sync)"]
        logger["LoggerService"]
        swUpdate["PromptUpdateService\n(PWA)"]
    end

    main --> config
    config --> app
    app --> auth
    app --> home
    app --> admin
    app --> user
    auth --> authSvc
    home --> authSvc
    home --> dictSync
    admin --> authSvc
```

---

## 2. Folder structure

```
src/app/
├── app.component.ts          # Root shell (Ionic side-menu + outlet)
├── app.routes.ts             # Top-level route table
├── app.constants.ts          # langConfig (targetLang, nativeLang, stemmer)
│
├── auth/                     # Auth feature
│   ├── auth.service.ts
│   ├── auth.guard.ts
│   ├── admin.guard.ts
│   ├── auth.interceptor.ts
│   ├── user.model.ts
│   ├── auth.page.ts
│   ├── register/
│   ├── change-password/
│   ├── request-password-reset/
│   └── reset-password/
│
├── home/                     # Main tabbed feature
│   ├── home.page.ts          # Tab container
│   ├── speech-synthesizer.service.ts
│   ├── vocabulary/           # Vocabulary sub-feature
│   │   ├── vocabulary.service.ts
│   │   ├── vocabulary.page.ts
│   │   ├── vocabulary.page.html
│   │   ├── vocabulary.page.scss
│   │   └── vocabulary-entry-modal/   # Add / edit / CSV-import modal
│   │       ├── vocabulary-entry-modal.component.ts
│   │       ├── vocabulary-entry-modal.component.html
│   │       └── vocabulary-entry-modal.component.scss
│   ├── study/                # SRS flashcard sub-feature
│   │   ├── study.service.ts
│   │   └── study-modal/
│   │       ├── study-modal.component.ts
│   │       ├── study-modal.component.html
│   │       └── study-modal.component.scss
│   ├── content/              # Content sub-feature
│   │   ├── content.service.ts
│   │   ├── markdown.service.ts
│   │   ├── topic.model.ts
│   │   ├── publication/
│   │   │   └── article/      # Article + ToC
│   │   └── hashtags/
│   └── dictionary/           # Dictionary sub-feature
│       ├── dictionary.service.ts
│       ├── dict-sync.service.ts
│       ├── dict-store.service.ts
│       ├── search-history.service.ts
│       ├── indonesian-stemmer.ts  # implements Stemmer interface
│       ├── stemmer.ts             # Stemmer interface + IdentityStemmer fallback
│       ├── word-lang.model.ts
│       ├── history-modal/
│       ├── searchbar/
│       └── lemma/
│
├── admin/                    # Admin feature (adminGuard)
│   ├── admin.service.ts
│   ├── users/
│   │   └── groups-modal/     # Group assignment sheet modal
│   ├── content/
│   │   └── upload/
│   └── system-settings/
│
├── user/                     # Standalone user pages
│   ├── welcome/
│   └── contact/
│
├── about/
│
├── help/                     # Help page (markdown, always Dutch)
│
├── shared/                   # Non-feature utilities
│   ├── logger.service.ts
│   ├── api-error-alert.service.ts
│   ├── back-button/
│   └── word-click-modal/
│
└── sw-update/
    └── prompt-update.service.ts
```

---

## 3. Routing

All feature routes are lazy-loaded. The router uses `IonicRouteStrategy` (route reuse) and `PreloadAllModules`.

**Redirects**

- `/` → `/home`
- `**` → `/auth`

**Auth routes**

```mermaid
flowchart TD
    auth_r["/auth"]
    auth_r --> login["/auth — login"]
    auth_r --> register["/auth/register\nregisterGuard"]
    auth_r --> change_pw["/auth/change-password"]
    auth_r --> req_reset["/auth/request-password-reset"]
    auth_r --> reset["/auth/reset-password"]
```

**Home tabs** (all require `authGuard`)

```mermaid
flowchart TD
    home_r["/home"] --> tabs["/home/tabs"]

    tabs --> content_tab["/home/tabs/content"]
    content_tab --> publication["/home/tabs/content/:group"]
    publication --> article["/home/tabs/content/:group/:filename"]

    tabs --> dict_tab["/home/tabs/dictionary"]
    dict_tab --> lemma["/home/tabs/dictionary/:word/:lang"]

    tabs --> hashtags_tab["/home/tabs/hashtags"]
    tabs --> vocabulary_tab["/home/tabs/bookmarks"]
```

**Admin** (requires `adminGuard`)

```mermaid
flowchart TD
    admin_r["/admin"]
    admin_r --> users["/admin/users"]
    admin_r --> new_user["/admin/new-user"]
    admin_r --> admin_content["/admin/content"]
    admin_r --> upload["/admin/upload"]
    admin_r --> settings["/admin/system-settings"]
```

**Standalone pages** (all require `authGuard`)

- `/welcome/:lang`
- `/about/:lang`
- `/contact`
- `/help`

**Guards:**

| Guard | Purpose |
|---|---|
| `authGuard` | Requires authenticated user; triggers `DictSyncService.init()` |
| `adminGuard` | Requires `roles` includes `'admin'`; composes `authGuard` |
| `registerGuard` | Validates `?email=&token=` via API before showing register page |

---

## 4. Feature areas

### 4.1 Auth

Login, registration (invite-only with token), and password-reset flows. `AuthService` manages JWT state; all other features depend on it. On successful authentication the `authGuard` fires `DictSyncService.init()` so the local dictionary is ready before the user reaches the home tabs.

### 4.2 Home (tabs)

Four peer tabs sharing the same Ionic tab bar:

```mermaid
graph LR
    HomePage["HomePage\n(ion-tabs)"]
    HomePage --> Content["Content tab\n/content"]
    HomePage --> Dictionary["Dictionary tab\n/dictionary"]
    HomePage --> Hashtags["Hashtags tab\n/hashtags"]
    HomePage --> Vocabulary["Vocabulary tab\n/bookmarks"]

    Content --> Publication["Publication list\n(per groupName)"]
    Publication --> Article["Article page\n(markdown → HTML)"]
    Article --> TOC["ToC panel\n(TocService)"]
    Article --> WordModal["Word-click modal\n(definition lookup)"]

    Dictionary --> Searchbar["Searchbar\n(autocomplete)"]
    Searchbar --> Lemma["Lemma page\n(definitions)"]

    Hashtags --> HashtagList["Hashtag list\n(cross-publication index)"]

    Vocabulary --> ChipBar["List chip bar\n(VocabularyService.lists)"]
    Vocabulary --> WordList["Saved items\n(swipe to remove)"]
    Vocabulary --> StudyBtn["Study button\n(due-count badge)"]
    StudyBtn --> StudyModal["StudyModal\n(list picker → flashcard → rating)"]
    StudyModal --> DictSvc["DictionaryService\n(fetchWordLemmas — fallback when back is absent)"]
    StudyModal --> StudySvc["StudyService\n(SRS API calls)"]
```

**Article flow:** `ArticleResolver` pre-fetches the article. `MarkdownService` converts `mdText` to HTML, wrapping foreign-language spans. Headings are extracted by `extract-headings.util.ts` and stored in `TocService`. Clicking a word opens `WordClickModalComponent` via `WordClickModalService`, which calls `DictionaryService` for lemma lookup.

### 4.3 Dictionary

Offline-first. On first load the dict manifest is fetched from `/assets/dict-manifest.json`; new or updated bundles are compiled and stored in IndexedDB (`taalwiz-dict`). `DictionaryService` wraps `DictStoreService` with pluggable stemming (via `langConfig.stemmer`) for fuzzy lookup — all searches run entirely offline against IndexedDB.

### 4.4 Admin

Protected by `adminGuard`. Covers user management (invite, list, delete, group assignment), publication sort-order, file upload (`.md` / `.json` only — enforced client **and** server), and system settings (key/value store backed by the `SystemSettings` MongoDB collection, seeded on first API startup). The System Settings page uses an explicit Save/Cancel pattern: buttons appear in the toolbar only when `isDirty()` is true, driven by a `computed` signal that re-evaluates via `onSettingChange()` after each `[(ngModel)]` edit.

**Group management:** The Users page shows each user's current groups as `IonChip` elements and provides an inline **Manage Groups** button. Tapping it opens `GroupsModalComponent` — a bottom sheet listing all available group names as checkboxes, populated from `GET /api/v1/content/groups`. Changes are saved via `PATCH /api/v1/users/:id/groups` and reflected immediately in the users list signal.

---

## 5. Services and state

### State management

There is no centralized store. Services own their state using RxJS `BehaviorSubject` or Angular signals:

**Auth**

```mermaid
graph TD
    AuthService -->|BehaviorSubject| user$
    AuthService -->|BehaviorSubject| tokenData$
```

`user$` is exposed as `authService.user()` — a signal via `toSignal()`.

**Dictionary**

```mermaid
graph TD
    DictSyncService -->|BehaviorSubject| status$
    DictionaryService -->|BehaviorSubject| lookupResult$
```

`status$` values: `'idle' | 'syncing' | 'done' | 'offline' | 'error'`. `lookupResult$` type: `BehaviorSubject<LookupResult | null>`.

**Vocabulary & Study**

```mermaid
graph TD
    VocabularyService -->|signal| lists
    VocabularyService -->|signal| currentListId
    VocabularyService -->|signal| bookmarks
    VocabularyService -->|signal| bookmarkedKeys
    StudyService -->|signal| stats
```

`lists`: `VocabularyList[]` with counts. `bookmarks`: `VocabularyEntry[]` for current list. `bookmarkedKeys`: `Set<string>` for O(1) lookup. `stats`: `SrsStatsEntry[]` per-list due/new/total.

**Content & Search**

```mermaid
graph TD
    TocService -->|signal| headings
    TocService -->|signal| scrollToId
    SearchHistoryService -->|signal| history
```

`history`: `HistoryEntry[]` newest-first.

`AuthService` exposes `user()` — a signal derived from `user$` via `toSignal()`. `AppComponent.currentUser` is a direct alias to this signal; there is no separate local copy. Components use `OnPush` change detection; zoneless change detection is enabled app-wide.

`DictionaryService.lookupResult$` is a `BehaviorSubject` (replays the last result to late subscribers). This matters because `WordClickModalComponent.dictionaryLookup()` navigates to the dictionary page and calls `lookup()` in the same tick — without replay, the result would be lost before `DictionaryPage` finishes rendering and subscribes.

### Service responsibilities

| Service | Location | Responsibility |
|---|---|---|
| `AuthService` | `auth/` | JWT + refresh-token management, login/logout, auto-login (Capacitor Preferences) |
| `VocabularyService` | `home/vocabulary/` | Named list management; vocabulary item add/remove/update with optimistic UI; `addEntry()`, `updateBack()`, `addEntries()` for modal-driven input; cross-device current-list sync via `UserPreferences` API; calls `StudyService.refreshStats()` after every add/remove |
| `StudyService` | `home/study/` | Reactive `stats` signal (per-list SRS counts); `getDueCards(listId)` and `submitReview()` observables for the SRS API |
| `DictSyncService` | `home/dictionary/` | Fetch manifest, download & compile dict bundles, write to IndexedDB |
| `DictStoreService` | `home/dictionary/` | IndexedDB CRUD wrapper (`taalwiz-dict` DB) |
| `DictionaryService` | `home/dictionary/` | Offline lookup via `DictStoreService` using `langConfig.stemmer` (pluggable); manages `lookupResult$` |
| `SearchHistoryService` | `home/dictionary/` | Persist search history (up to 50 entries) via Capacitor Preferences; deduplication on add |
| `ContentService` | `home/content/` | Fetch publications & articles from API; `prefetchArticle()` for silent bulk pre-fetch (publication cache-all button); manage SW content-cache invalidation (manifest check on login, explicit bust on admin mutations and logout) |
| `MarkdownService` | `home/content/` | Markdown → HTML with foreign-language span injection |
| `TocService` | `home/content/…/article/` | Extract headings, scroll-to signal |
| `HashtagsService` | `home/content/hashtags/` | Hashtag index fetching |
| `SpeechSynthesizerService` | `home/` | Web Speech API wrapper (single word + full sentence) |
| `WordClickModalService` | `shared/` | Coordinate word taps → dictionary lookup → modal display |
| `ApiErrorAlertService` | `shared/` | Display Ionic alert on HTTP errors |
| `LoggerService` | `shared/` | Levelled logging (dev: `silly`, prod: `info`) |
| `PromptUpdateService` | `sw-update/` | PWA version-update detection and reload prompt |

---

## 6. HTTP layer

```mermaid
sequenceDiagram
    participant Component
    participant Service
    participant authInterceptor
    participant API

    Component->>Service: fetchX()
    Service->>authInterceptor: HttpRequest (with Bearer token)
    authInterceptor->>API: request
    API-->>authInterceptor: 200 OK
    authInterceptor-->>Service: response
    Service-->>Component: data

    Note over authInterceptor,API: On 401 response
    authInterceptor->>API: POST /api/v1/auth/refresh
    API-->>authInterceptor: new tokens
    authInterceptor->>API: retry original request
    API-->>authInterceptor: 200 OK
    authInterceptor-->>Service: response
```

- All services call `authService.getRequestHeaders()` to attach `Authorization: Bearer <token>`. This is the sole API for obtaining an auth header — there is no secondary property equivalent.
- The `authInterceptor` handles 401s transparently: it invalidates the current token, calls the refresh endpoint, and retries the original request — or forces logout if refresh fails.
- Auth endpoints (`/api/v1/auth/*`) are excluded from the retry loop to prevent infinite recursion.
- API base paths: `/api/v1/` (all API endpoints, including admin), `/assets/` (static dict/content files). Admin-only routes sit under `/api/v1/admin/` and additionally require the `admin` role.

---

## 7. Dictionary (offline-first)

```mermaid
sequenceDiagram
    participant authGuard
    participant DictSyncService
    participant DictStoreService
    participant IndexedDB
    participant API

    authGuard->>DictSyncService: init()
    DictSyncService->>API: GET /assets/dict-manifest.json
    API-->>DictSyncService: manifest (version hashes per bundle)

    loop For each bundle that differs from stored hash
        DictSyncService->>API: GET /assets/{bundle}.json
        API-->>DictSyncService: CompiledDict
        DictSyncService->>DictStoreService: replaceAll(lemmas)
        DictStoreService->>IndexedDB: write lemmas + metadata
    end

    DictSyncService-->>authGuard: status = 'done'

    Note over DictSyncService: Network unavailable → status = 'offline'
    Note over DictSyncService: No changes → status = 'done' immediately
```

`DictStoreService` opens the `taalwiz-dict` IndexedDB database (version 3) with two stores: `lemmas` (indexes: `by-lang-word ([lang, word])` for language-scoped queries, `by-word (word)` for cross-language lookups) and `meta` (stores the current dict version for delta checking).

`DictionaryService` uses `langConfig.stemmer` (a pluggable `Stemmer` interface; currently `IndonesianStemmer`) to generate word variants before searching `DictStoreService`; inflected forms resolve to the correct lemma entirely offline.

---

## 8. Content caching (service worker)

Article bodies and topic index lists are cached by the Angular service worker via two `dataGroups` in `ngsw-config.json`:

| Group | URL pattern | Strategy | maxSize | maxAge |
|---|---|---|---|---|
| `content-api-articles` | `/api/v1/content/article/**` | `freshness` (network-first, 3 s timeout) | 150 | 14 d |
| `content-api-index` | `/api/v1/content/**` | `freshness` (network-first, 3 s timeout) | 50 | 7 d |

Both groups use `freshness` so online users always get responses validated by the API — important because content is access-controlled by group membership. The SW cache serves as an offline fallback only. The 14-day `maxAge` on articles means offline reading remains available for two weeks after the last online visit.

### Cache invalidation

`ContentService` manages three invalidation paths:

- **On login / app restart** — `user$` emits a non-null value. `ContentService` fetches `GET /api/v1/content/manifest` (`{ filename, sha }` per topic), serialises it, and compares with the previous manifest in `localStorage`. If any `sha` changed, both SW data caches are deleted so the next navigation fetches fresh content. First login just seeds the stored manifest.
- **On admin mutations** — Admin pages call `ContentService.clearCache()` after uploads, reorders, and deletions. This wipes both SW data caches immediately.
- **On logout** — `user$` emits `null`; `clearCache()` removes cached content from the browser's `CacheStorage`.

```mermaid
sequenceDiagram
    participant App
    participant ContentService
    participant API
    participant SW as ServiceWorker
    participant CS as CacheStorage

    App->>ContentService: user$ emits non-null (login / auto-login)
    ContentService->>API: GET /api/v1/content/manifest
    API-->>ContentService: [{filename, sha}, ...]
    ContentService->>ContentService: compare with localStorage

    alt any sha changed
        ContentService->>CS: delete content-api-articles + content-api-index caches
        ContentService->>ContentService: store new manifest
    end

    App->>SW: GET /api/v1/content/article/:filename
    SW->>API: network request (freshness — try network first)
    API-->>SW: 200 OK (or 403 if access revoked)
    SW-->>App: serve fresh response (or fall back to cache if offline)
```

### Proactive caching

The publication topic-list page (`PublicationPage`) has a **cache-all** button in the toolbar's `end` slot. Tapping it calls `ContentService.prefetchArticle(filename)` for each article in the publication using RxJS `concat()` — one request at a time — so the SW caches all articles before the user opens any of them.

`prefetchArticle()` is a silent variant of `fetchArticle()`: it returns `Observable<boolean>` and swallows HTTP errors without calling `ApiErrorAlertService`. This prevents alert spam if one article fails during a bulk download.

`PublicationPage` drives the UI with two signals:

| Signal | Type | Description |
|---|---|---|
| `cacheStatus` | `'idle' \| 'caching' \| 'done'` | Button appearance and disabled state |
| `cachedCount` | `number` | Numerator for the deterministic `IonProgressBar` value |

Because articles use the `performance` strategy, already-cached entries are served from the SW cache instantly and add no network traffic. Only uncached articles actually hit the API.

---

## 9. Authentication and security

```mermaid
stateDiagram-v2
    [*] --> LoggedOut
    LoggedOut --> AutoLogin : app start (Capacitor Preferences)
    LoggedOut --> LoggedIn : manual login
    AutoLogin --> LoggedIn : token valid
    AutoLogin --> LoggedOut : no stored token
    LoggedIn --> Refreshing : 401 received
    Refreshing --> LoggedIn : refresh OK
    Refreshing --> LoggedOut : refresh failed
    LoggedIn --> LoggedOut : explicit logout
```

- **Token storage:** Access token in memory (JS ref); refresh token persisted via **Capacitor Preferences** (secure native storage on mobile; `localStorage` equivalent on web — see security note below).
- **Role-based access:** `roles: ('user' | 'admin' | 'demo')[]` on `User`. Admin routes require `'admin'` in the array; enforced in both `adminGuard` and the NestJS API.
- **Content group authorization:** `groups: string[]` on `User` controls which Library publications and hashtags are visible. Content tagged `groupName: 'public'` is visible to all authenticated users. Admin users bypass group filtering entirely. Groups are included in both the access token and refresh token; the admin UI allows assigning groups to users via `PATCH /api/v1/users/:id/groups`.
- **Upload restriction:** Admin upload page accepts only `.md` and `.json` — enforced in the client `accept` prop **and** in `content.service.ts` server-side validation.
- **Server-side HTML sanitization:** `convertMarkdown()` in `apps/taalwiz-api/src/util/markup.ts` passes all Markdown-derived HTML through `sanitize-html` before storing or serving it. The allowlist covers only the tags and attributes the pipeline legitimately produces; `<script>`, event handlers, and `javascript:` URLs are stripped at the source.
- **`bypassSecurityTrustHtml`:** `ArticleBodyComponent` still calls `bypassSecurityTrustHtml()` on article HTML. This is acceptable because the HTML has already been sanitized server-side before it reaches the client.

> **Known open issue:** Refresh token is stored in Capacitor Preferences, which maps to `localStorage` on web — medium-severity risk. Mitigation (HttpOnly cookie) requires API changes and is not yet implemented.

---

## 10. i18n

Uses **ngx-translate**. Translation files are loaded at runtime from `/i18n/{lang}.json`.

| Setting | Value |
|---|---|
| Default UI language | Dutch (`nl`) |
| Fallback language | English (`en`) |
| Target (learning) language | Indonesian (`id`) — `langConfig.targetLang` in `app.constants.ts` |

Language preference is persisted on the `User` model and applied via `TranslateService.use(user.lang)` on login.

---

## 11. Data models

**Auth**

```mermaid
classDiagram
    class User {
        +string id
        +string email
        +string name
        +string lang
        +string[] roles
        +string[] groups
        +string refreshToken
        +Date refreshExp
    }
```

**Content**

```mermaid
classDiagram
    class ITopic {
        +string _id
        +string title
        +string publication
        +string groupName
        +string filename
        +string type
        +string targetLang
        +number sortIndex
        +string sha
    }

    class IArticle {
        +string _id
        +ITopic _topic
        +string title
        +string mdText
        +string htmlText
        +string targetLang
    }

    class IHashtag {
        +string id
        +string name
        +string publicationTitle
        +string articleTitle
        +string sectionHeader
        +string filename
    }

    IArticle --> ITopic : belongs to
```

**Dictionary**

```mermaid
classDiagram
    class ILemma {
        +string word
        +string lang
        +string baseWord
        +string baseLang
        +string text
        +number homonym
        +string keyword
    }

    ILemma --> ILemma : baseWord reference
```

**Vocabulary & Study**

```mermaid
classDiagram
    class VocabularyList {
        +string id
        +string name
        +number count
    }

    class VocabularyEntry {
        +string term
        +string lang
        +string listId
        +string back
        +string savedAt
    }

    class UserPreferences {
        +string currentVocabularyListId
    }

    class SrsItem {
        +string term
        +string lang
        +string listId
        +string back
        +number interval
        +number easeFactor
        +string dueDate
        +number reps
        +number lapses
    }

    VocabularyEntry --> VocabularyList : belongs to
    UserPreferences --> VocabularyList : currentList
    SrsItem --> VocabularyList : belongs to
    SrsItem --> VocabularyEntry : mirrors
```

**Admin**

```mermaid
classDiagram
    class ISystemSettings {
        +string _id
        +string name
        +string label
        +string valueType
        +number sortIndex
    }
```
