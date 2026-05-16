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
8. [Authentication and security](#8-authentication-and-security)
9. [i18n](#9-i18n)
10. [Data models](#10-data-models)

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
├── app.constants.ts          # foreignLang = 'id'
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
│       ├── indonesian-stemmer.ts
│       ├── word-lang.model.ts
│       ├── history-modal/
│       ├── searchbar/
│       └── lemma/
│
├── admin/                    # Admin feature (adminGuard)
│   ├── admin.service.ts
│   ├── users/
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

```mermaid
flowchart TD
    root["/"]
    root -->|redirect| home_root["/home"]

    auth_r["/auth"]
    auth_r --> login["/auth (login)"]
    auth_r --> register["/auth/register\n(registerGuard)"]
    auth_r --> change_pw["/auth/change-password"]
    auth_r --> req_reset["/auth/request-password-reset"]
    auth_r --> reset["/auth/reset-password"]

    home_r["/home\n(authGuard)"]
    home_r --> tabs["/home/tabs"]
    tabs --> content_tab["/home/tabs/content"]
    content_tab --> publication["/home/tabs/content/:group"]
    publication --> article["/home/tabs/content/:group/:filename"]
    tabs --> dict_tab["/home/tabs/dictionary"]
    dict_tab --> lemma["/home/tabs/dictionary/:word/:lang"]
    tabs --> hashtags_tab["/home/tabs/hashtags"]
    tabs --> vocabulary_tab["/home/tabs/bookmarks"]

    admin_r["/admin\n(adminGuard)"]
    admin_r --> users["/admin/users"]
    admin_r --> new_user["/admin/new-user"]
    admin_r --> admin_content["/admin/content"]
    admin_r --> upload["/admin/upload"]
    admin_r --> settings["/admin/system-settings"]

    welcome["/welcome/:lang\n(authGuard)"]
    about["/about/:lang\n(authGuard)"]
    contact["/contact\n(authGuard)"]
    help["/help\n(authGuard)"]

    wildcard["**"] -->|redirect| auth_r
```

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

Offline-first. On first load the dict manifest is fetched from `/assets/dict-manifest.json`; new or updated bundles are compiled and stored in IndexedDB (`taalwiz-dict`). `DictionaryService` wraps `DictStoreService` with Indonesian stemming for fuzzy lookup.

### 4.4 Admin

Protected by `adminGuard`. Covers user management (invite, list, delete), publication sort-order, file upload (`.md` / `.json` only — enforced client **and** server), and system settings (key/value store backed by the `SystemSettings` MongoDB collection, seeded on first API startup). The System Settings page uses an explicit Save/Cancel pattern: buttons appear in the toolbar only when `isDirty()` is true, driven by a `computed` signal that re-evaluates via `onSettingChange()` after each `[(ngModel)]` edit.

---

## 5. Services and state

### State management

There is no centralized store. Services own their state using RxJS `BehaviorSubject` or Angular signals:

```mermaid
graph TD
    AuthService -->|BehaviorSubject| user$["user$\n→ toSignal → authService.user()"]
    AuthService -->|BehaviorSubject| tokenData$

    DictSyncService -->|BehaviorSubject| status$["status$\n'idle'|'syncing'|'done'|'offline'|'error'"]

    DictionaryService -->|BehaviorSubject| lookupResult$["lookupResult$\nBehaviorSubject&lt;LookupResult|null&gt;"]

    TocService -->|signal| headings
    TocService -->|signal| scrollToId

    VocabularyService -->|signal| lists["lists\nVocabularyList[] with counts"]
    VocabularyService -->|signal| currentListId
    VocabularyService -->|signal| bookmarks["bookmarks\nVocabularyEntry[] for current list"]
    VocabularyService -->|signal| bookmarkedKeys["bookmarkedKeys\nSet&lt;string&gt; for O(1) lookup"]

    StudyService -->|signal| stats["stats\nSrsStatsEntry[] per-list due/new/total"]

    SearchHistoryService -->|signal| history["history\nHistoryEntry[] newest-first"]
```

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
| `DictionaryService` | `home/dictionary/` | Lookup with Indonesian stemmer, manage `lookupResult$` |
| `SearchHistoryService` | `home/dictionary/` | Persist search history (up to 50 entries) via Capacitor Preferences; deduplication on add |
| `ContentService` | `home/content/` | Fetch publications & articles from API, in-memory cache |
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

`DictStoreService` opens the `taalwiz-dict` IndexedDB database with two stores: `lemmas` (indexed by `word:lang` and `word`) and `metadata` (stores manifest hashes for delta checking).

`DictionaryService` uses `IndonesianStemmer` to generate word variants (prefixes, suffixes) before calling `DictStoreService.findWordsStartingWith()`, so inflected forms resolve to the correct lemma.

---

## 8. Authentication and security

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
- **Upload restriction:** Admin upload page accepts only `.md` and `.json` — enforced in the client `accept` prop **and** in `content.service.ts` server-side validation.
- **Server-side HTML sanitization:** `convertMarkdown()` in `apps/taalwiz-api/src/util/markup.ts` passes all Markdown-derived HTML through `sanitize-html` before storing or serving it. The allowlist covers only the tags and attributes the pipeline legitimately produces; `<script>`, event handlers, and `javascript:` URLs are stripped at the source.
- **`bypassSecurityTrustHtml`:** `ArticleBodyComponent` still calls `bypassSecurityTrustHtml()` on article HTML. This is acceptable because the HTML has already been sanitized server-side before it reaches the client.

> **Known open issue:** Refresh token is stored in Capacitor Preferences, which maps to `localStorage` on web — medium-severity risk. Mitigation (HttpOnly cookie) requires API changes and is not yet implemented.

---

## 9. i18n

Uses **ngx-translate**. Translation files are loaded at runtime from `/i18n/{lang}.json`.

| Setting | Value |
|---|---|
| Default UI language | Dutch (`nl`) |
| Fallback language | English (`en`) |
| Foreign (learning) language | Indonesian (`id`) — constant in `app.constants.ts` |

Language preference is persisted on the `User` model and applied via `TranslateService.use(user.lang)` on login.

---

## 10. Data models

```mermaid
classDiagram
    class User {
        +string id
        +string email
        +string name
        +string lang
        +string[] roles
        +string refreshToken
        +Date refreshExp
    }

    class ITopic {
        +string _id
        +string title
        +string publication
        +string groupName
        +string filename
        +string type
        +string foreignLang
        +string baseLang
        +number sortIndex
        +string hash
    }

    class IArticle {
        +string _id
        +ITopic _topic
        +string title
        +string mdText
        +string htmlText
        +string foreignLang
        +string baseLang
    }

    class ILemma {
        +string word
        +string lang
        +string baseWord
        +string baseLang
        +string text
        +number homonym
        +string keyword
    }

    class IHashtag {
        +string id
        +string name
        +string publicationTitle
        +string articleTitle
        +string sectionHeader
        +string filename
    }

    class ISystemSettings {
        +string _id
        +string name
        +string label
        +string valueType
        +number sortIndex
    }

    class VocabularyEntry {
        +string term
        +string lang
        +string listId
        +string back
        +string savedAt
    }

    class VocabularyList {
        +string id
        +string name
        +number count
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

    IArticle --> ITopic : belongs to
    ILemma --> ILemma : baseWord reference
    VocabularyEntry --> VocabularyList : belongs to
    UserPreferences --> VocabularyList : currentList
    SrsItem --> VocabularyList : belongs to
    SrsItem --> VocabularyEntry : mirrors
```
