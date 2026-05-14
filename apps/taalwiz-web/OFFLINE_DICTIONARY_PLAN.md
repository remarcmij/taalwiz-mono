# Offline Dictionary via IndexedDB — Implementation Plan

## Goal

Make the dictionary available offline after the first authenticated session. Currently every
lookup and autocomplete request hits the NestJS API and fails with no network connection.

The strategy: compiled dictionary JSON files (produced by `dict-compiler` and uploaded by
the admin) are written to disk and served as public static assets. A manifest file at
`/assets/dict-manifest.json` lists all available files and carries a version string.
On first authenticated launch, the Angular app downloads the manifest and all listed JSON
files, transforms them, and stores the result in IndexedDB. On subsequent launches it does
a quick manifest check and re-downloads only when the version has changed.

All lookup and autocomplete queries are served from IndexedDB. The existing API endpoints
remain as the fallback for when IndexedDB is empty.

MongoDB's `Lemma` and `AutoCompletions` (Word) collections are no longer needed and can be
dropped after the new code is deployed.

---

## Codebase context (as of the plan date)

### Data flow today

```
Admin uploads teeuw.a.json
  → ContentService.uploadContent()
      → DictLoader.importUpload()
          → Topic created/updated in MongoDB
          → Lemma documents bulk-inserted into MongoDB
          → AutoCompletions collection rebuilt

User types word
  → DictionaryService (Angular)
      → GET /api/v1/dictionary/find/:word/:lang  (auth required)
          → MongoDB Lemma collection
              → ILemma[] response
```

### Data flow after this change

```
Admin uploads teeuw.a.json
  → ContentService.uploadContent()
      → DictFileLoader.importUpload()
          → Topic created/updated in MongoDB  (admin UI still works)
          → File written to api/public/teeuw.a.json
          → dict-manifest.json regenerated

On app launch (authenticated)
  → DictSyncService.init()
      → GET /assets/dict-manifest.json  (public, no auth)
          → compare version to IndexedDB stored version
          → if stale: fetch each listed file, transform, store in IndexedDB

User types word
  → DictionaryService (Angular)
      → DictStoreService  (IndexedDB, local)
          → result  (or fall back to API if IndexedDB empty)
```

### Key files

| File | Role |
|------|------|
| `apps/taalwiz-api/src/content/content.service.ts` | Routes uploads to loaders; `.json` → dictLoader, `.md` → articleLoader |
| `apps/taalwiz-api/src/content/loaders/BaseLoader.ts` | Abstract base: manages Topic lifecycle, calls `parseContent` / `createData` / `removeData` |
| `apps/taalwiz-api/src/content/loaders/DictLoader.ts` | **Replaced** — currently parses compiled JSON and bulk-inserts into MongoDB |
| `apps/taalwiz-api/src/dictionary/dictionary.controller.ts` | Existing routes kept as API fallback |
| `apps/taalwiz-api/src/dictionary/dictionary.service.ts` | `findWord()`, `findAutoCompletions()` — kept for API fallback |
| `apps/taalwiz-api/src/util/indonesian-stemmer.ts` | Pure TS stemmer: `getWordVariations(word)` → `string[]` |
| `apps/taalwiz-web/src/app/home/dictionary/dictionary.service.ts` | Angular service — calls API, exposes `lookupResult$` Subject |
| `apps/taalwiz-web/src/app/home/dictionary/lemma/lemma.model.ts` | `ILemma` interface used by Angular |
| `apps/taalwiz-web/src/app/auth/auth.guard.ts` | `authGuard` — calls `authService.autoLogin()` if user not set |
| `apps/taalwiz-web/src/app/app.component.ts` | Calls `authService.autoLogin()` on app-resume via `checkAuthOnResume()` |
| `apps/taalwiz-web/ngsw-config.json` | SW asset cache config — needs dict files excluded (see Part 8) |

### Static file serving

`ServeStaticModule` serves `apps/taalwiz-api/api/public/` at URL path `/assets/`.
Currently this directory holds images and other static assets. After this change it also
holds the compiled dictionary JSON files and the manifest.

### Auth model

- Global `APP_GUARD` in `auth.module.ts` applies `AuthGuard` + `RolesGuard` to every
  NestJS route. Static files served by `ServeStaticModule` bypass the NestJS pipeline
  and are therefore **publicly accessible without auth**.
- The manifest and dict JSON files will be public. This is intentional and acceptable —
  the dictionary data is not sensitive.
- The sync HTTP calls from the Angular app (manifest + file fetches) require **no auth
  headers**, which simplifies `DictSyncService` significantly.

### Compiled JSON format (dict-compiler output, one file per letter)

```json
{
  "baseLang": "id",
  "lemmas": [
    {
      "text": "<HTML of the entry>",
      "base": "root word form",
      "homonym": 0,
      "words": [
        { "word": "makan",  "lang": "id", "keyword": 1, "order": 26001 },
        { "word": "eten",   "lang": "nl", "keyword": 1, "order": 26001 }
      ]
    }
  ]
}
```

One compiled lemma entry becomes one IndexedDB record **per `words[]` entry**.

### Manifest format (new)

```json
{
  "version": "2024-01-15T10:30:00.000Z",
  "files": ["teeuw.a.json", "teeuw.b.json", "teeuw.c.json"]
}
```

Served at `/assets/dict-manifest.json`. Regenerated on every dict upload or deletion.
`version` is `new Date().toISOString()` at the time of the most recent file operation.

### ILemma (what DictStoreService stores and returns — unchanged interface)

```typescript
interface ILemma {
  word: string;
  lang: string;
  baseWord: string;
  baseLang: string;
  text: string;
  homonym: number;
  // _id removed — auto-increment key used instead (no MongoDB ObjectId)
}
```

### Indonesian stemmer

`IndonesianStemmer.getWordVariations(word: string): string[]` — pure TypeScript, zero
dependencies, ~260 lines of recursive regex rules. The API uses it to expand a search
term into morphological variants and tries each against MongoDB until a match is found.
The same logic must run client-side. The file can be copied verbatim.

### findWord search logic (server-side today, mirrored client-side)

```typescript
// Indonesian: expand via stemmer, try each in order, return first non-empty result
// Dutch:      split by comma, try each in order, return first non-empty result
const words = lang === 'nl'
  ? word.split(',').map((w) => w.trim())
  : new IndonesianStemmer().getWordVariations(word);

for (const w of words) {
  const lemmas = await findByWordAndLang(w, lang);
  if (lemmas.length) return { word: w, lang, lemmas };
}
return { word, lang, lemmas: [] };
```

The `keyword` filter (optional query param) is never passed by the dictionary UI — skip
it in the offline implementation.

### Size estimate

Teeuw dictionary: ~25,000–40,000 unique words. After word-form expansion, possibly
60,000–100,000 IndexedDB records. Each record is ~200 bytes JSON. Total: **10–20 MB raw,
~3–5 MB gzip** over the wire. Well within browser IndexedDB quota.

---

## Part 1 — API changes (NestJS)

### 1.1 Manifest writer utility

**New file:** `apps/taalwiz-api/src/content/loaders/manifest-writer.ts`

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_DIR = path.resolve('api/public');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'dict-manifest.json');
// Dict files match e.g. "teeuw.a.json", "vandale.b.json"
const DICT_FILE_RE = /^[a-z]+\.[a-z]\.json$/;

export async function writeDictManifest(): Promise<void> {
  const entries = await fs.readdir(PUBLIC_DIR);
  const files = entries
    .filter((name) => DICT_FILE_RE.test(name))
    .sort();
  const manifest = { version: new Date().toISOString(), files };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}
```

**Note on `PUBLIC_DIR` path:** `path.resolve('api/public')` resolves relative to the
process working directory, which is `apps/taalwiz-api/` when the NestJS dev server runs.
Verify this holds in production (dist build). If needed, use `import.meta.url` or an
environment variable to make the path absolute.

### 1.2 Replace `DictLoader` with `DictFileLoader`

**File:** `apps/taalwiz-api/src/content/loaders/DictLoader.ts`

Replace the entire file with a much simpler implementation that saves the JSON file to
disk and regenerates the manifest. The `BaseLoader` base class continues to manage the
Topic lifecycle (create / update / delete) — no changes to `BaseLoader`.

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { TopicDoc } from '../models/topic.model.js';
import BaseLoader, { Upload } from './BaseLoader.js';
import { writeDictManifest } from './manifest-writer.js';

const PUBLIC_DIR = path.resolve('api/public');

const DictDataTopLevelSchema = z.object({
  baseLang: z.string().min(1),
  lemmas: z.array(z.unknown()),
});

interface DictFileMeta {
  baseLang: string;
}

class DictFileLoader extends BaseLoader<DictFileMeta> {
  protected parseContent(
    content: string,
    filename: string,
  ): Upload<DictFileMeta> {
    const raw: unknown = JSON.parse(content);
    const result = DictDataTopLevelSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(`invalid dict JSON in ${filename}: ${z.prettifyError(result.error)}`);
    }

    const match = filename.match(/^(.+)\.[a-z]\.json$/);
    if (!match) {
      throw new Error(`ill-formed filename: ${filename}`);
    }
    const groupName = match[1];

    // Stash the raw JSON for writing to disk in createData()
    (this as any)._pendingContent = content;
    (this as any)._pendingFilename = filename;

    return {
      topic: {
        filename,
        type: 'dict',
        groupName,
        title: groupName.charAt(0).toUpperCase() + groupName.slice(1),
        baseLang: result.data.baseLang,
      },
      payload: { baseLang: result.data.baseLang },
    };
  }

  protected async createData(
    _topic: TopicDoc,
    _data: Upload<DictFileMeta>,
  ): Promise<void> {
    const content: string = (this as any)._pendingContent;
    const filename: string = (this as any)._pendingFilename;
    await fs.writeFile(path.join(PUBLIC_DIR, filename), content, 'utf8');
    await writeDictManifest();
  }

  protected async removeData(topic: TopicDoc): Promise<void> {
    const filePath = path.join(PUBLIC_DIR, topic.filename as string);
    await fs.rm(filePath, { force: true });
    await writeDictManifest();
  }
}

export default DictFileLoader;
```

**Implementation note on `_pending*`:** `parseContent` and `createData` are called in
sequence by `BaseLoader.importUpload()` with no way to pass state between them via
parameters. The `_pending*` fields are a pragmatic workaround; if it feels too hacky,
refactor `BaseLoader` to pass the raw content string to `createData` as an additional
parameter, or extend the `Upload<T>` type to carry a `rawContent` field.

### 1.3 Drop MongoDB dictionary infrastructure (post-deploy)

After this change is deployed and verified, the following can be removed:

- `apps/taalwiz-api/src/dictionary/models/lemma.model.ts` — **delete file**
- `apps/taalwiz-api/src/dictionary/models/completions.model.ts` — **delete file**
- MongoDB collections `lemmas` and `words` — **drop from database**
- Any remaining references to `Lemma` or `AutoCompletions` in `dictionary.service.ts`
  (the `findWord` and `findAutoCompletions` methods will still be needed as API fallback,
  but they currently query Mongo — see note below)

**Note:** `findWord` and `findAutoCompletions` in `dictionary.service.ts` currently query
the Mongo `Lemma` and `AutoCompletions` collections respectively. These methods are kept
as the API fallback for when IndexedDB is empty (e.g., very first ever load). Once the
Lemma collection is dropped they will always return empty arrays, meaning the fallback
becomes a no-op. This is acceptable: the fallback is only needed during the initial sync.
Alternatively, delete the API fallback entirely after validating the IndexedDB path works —
this is a product decision to make at implementation time.

### 1.4 No new API endpoints or service methods needed

The manifest and dict JSON files are served automatically by `ServeStaticModule` as static
assets. No new controller routes or service methods are required in the API.

---

## Part 2 — Shared code: IndonesianStemmer

**Copy** `apps/taalwiz-api/src/util/indonesian-stemmer.ts` verbatim to:
`apps/taalwiz-web/src/app/home/dictionary/indonesian-stemmer.ts`

No changes to the file contents. It has zero dependencies and is pure TypeScript.

Add a one-line comment at the top of **both** copies:

```typescript
// Kept in sync with apps/taalwiz-api/src/util/indonesian-stemmer.ts — update both together.
```

---

## Part 3 — Angular: IndexedDB store service

**New file:** `apps/taalwiz-web/src/app/home/dictionary/dict-store.service.ts`

Use the **`idb`** npm package for clean Promise-based IndexedDB access:

```bash
pnpm --filter taalwiz-web add idb
```

### Client-side transform

The compiled JSON format must be flattened before storage. Add a standalone `transform`
function (not a class method — pure function, easy to test):

```typescript
interface CompiledLemma {
  text: string;
  base: string;
  homonym: number;
  words: Array<{ word: string; lang: string; keyword: number; order: number }>;
}

interface CompiledDict {
  baseLang: string;
  lemmas: CompiledLemma[];
}

function transformDict(data: CompiledDict): ILemma[] {
  const records: ILemma[] = [];
  for (const lemma of data.lemmas) {
    for (const wordDef of lemma.words) {
      records.push({
        word: wordDef.word,
        lang: wordDef.lang,
        baseWord: lemma.base,
        baseLang: data.baseLang,
        text: lemma.text,
        homonym: lemma.homonym,
      });
    }
  }
  return records;
}
```

Call this once per file during sync, then pass all records to `replaceAll()`.

### IndexedDB schema

Database name: `taalwiz-dict`
Database version: `1`

**Object store `lemmas`**
- No key path — auto-increment out-of-line integer keys (no MongoDB `_id` available)
- Index `by-word-lang` on `[word, lang]` — compound, non-unique — for exact lookups
- Index `by-word` on `word` — non-unique — for autocomplete prefix search

**Object store `meta`**
- Key path: `key`
- Stores `{ key: string; value: string }` — one record: `{ key: 'version', value: '...' }`

### Service interface

```typescript
@Injectable({ providedIn: 'root' })
export class DictStoreService {
  // Call once at startup to open/initialize the DB
  async open(): Promise<void>;

  // Returns the stored version string, or null if DB has never been synced
  async getStoredVersion(): Promise<string | null>;

  // Atomically replaces all lemmas and saves the new version
  async replaceAll(lemmas: ILemma[], version: string): Promise<void>;

  // Returns all lemmas where word === w AND lang === l, sorted by homonym
  async findByWordAndLang(w: string, l: string): Promise<ILemma[]>;

  // Returns up to `limit` distinct { word, lang } pairs where word starts with prefix
  async findByPrefix(
    prefix: string,
    lang: string,
    limit: number,
  ): Promise<{ word: string; lang: string }[]>;

  // Returns total lemma count (0 = never synced)
  async count(): Promise<number>;
}
```

### Implementation notes

**`open()`** — call `openDB('taalwiz-dict', 1, { upgrade(db) { ... } })` and store the
returned `IDBPDatabase` handle in a private field.

**`replaceAll()`** — single readwrite transaction:
1. `tx.objectStore('lemmas').clear()`
2. `tx.objectStore('lemmas').add(lemma)` for each record in the same transaction
3. `tx.objectStore('meta').put({ key: 'version', value: version })`
4. `await tx.done`
This is atomic — the user never sees a partially-replaced dictionary.

**`findByWordAndLang()`** — use the `by-word-lang` index with
`IDBKeyRange.only([word, lang])`. Sort the result array by `homonym` in JS.

**`findByPrefix()`** — use the `by-word` index with
`IDBKeyRange.bound(prefix, prefix + '￿')`. Iterate with a cursor; collect distinct
`(word, lang)` pairs using a `Set<string>` keyed by `word + '|' + lang`; stop when
`limit` is reached.

---

## Part 4 — Angular: sync service

**New file:** `apps/taalwiz-web/src/app/home/dictionary/dict-sync.service.ts`

```typescript
export type SyncStatus = 'idle' | 'syncing' | 'done' | 'offline' | 'error';

@Injectable({ providedIn: 'root' })
export class DictSyncService {
  readonly status$ = new BehaviorSubject<SyncStatus>('idle');

  // Called once on app init after auth is confirmed (see Part 7)
  async init(): Promise<void>;

  // Called after login/auto-login — version check + conditional sync
  async syncIfNeeded(): Promise<void>;
}
```

### `init()` flow

1. Call `DictStoreService.open()` to initialize the IndexedDB connection.
2. Call `syncIfNeeded()`.

### `syncIfNeeded()` flow

No auth headers are needed — the manifest and dict files are public static assets.

```
1. If !navigator.onLine → status$.next('offline'), return
2. fetch('/assets/dict-manifest.json')
   → on network error → status$.next('offline'), return
   → parse as { version: string, files: string[] }
3. Compare manifest.version to DictStoreService.getStoredVersion()
4. If equal → status$.next('done'), return   (already up to date)
5. status$.next('syncing')
6. For each filename in manifest.files:
     a. fetch('/assets/' + filename)
     b. parse as CompiledDict
     c. collect ILemma[] via transformDict()
7. DictStoreService.replaceAll(allLemmas, manifest.version)
8. status$.next('done')
9. On any error in steps 6–7 → status$.next('error')
```

Steps 6a–6c can be done in parallel with `Promise.all()` since the files are independent.
Collect all resulting `ILemma[]` arrays, flatten, and pass to `replaceAll()` in one call.

Use the plain `fetch()` API (no Angular `HttpClient`) since no auth headers or
interceptors are needed. This keeps `DictSyncService` free of `HttpClient` injection.

---

## Part 5 — Angular: modify `DictionaryService`

**File:** `apps/taalwiz-web/src/app/home/dictionary/dictionary.service.ts`

Inject `DictStoreService`. Replace lookup/autocomplete calls with local-first logic.

### `searchDictionary()` — local-first lookup

Add a private method `searchLocal(target: WordLang, searchWord?: string)`:

```typescript
private async searchLocal(
  target: WordLang,
  searchWord?: string,
): Promise<LookupResult> {
  const result = new LookupResult();
  result.targetBase = target;

  const word = searchWord ?? target.word;
  const words =
    target.lang === 'nl'
      ? word.split(',').map((w) => w.trim())
      : new IndonesianStemmer().getWordVariations(word);

  for (const w of words) {
    const lemmas = await this.#dictStore.findByWordAndLang(w, target.lang);
    if (lemmas.length > 0) {
      return makeLookupResult({
        word: w,
        lang: target.lang,
        lemmas,
        haveMore: false,
      });
    }
  }

  return result; // empty
}
```

Modify `searchDictionary()`:

```typescript
searchDictionary(target: WordLang, searchWord?: string) {
  from(this.#dictStore.count())
    .pipe(
      switchMap(async (count) => {
        if (count > 0) {
          const result = await this.searchLocal(target, searchWord);
          reorderLookupResult(result);
          return result;
        }
        return null; // signal: fall through to API
      }),
    )
    .subscribe((result) => {
      if (result !== null) {
        this.#lookupResult$.next(result);
      } else {
        this.searchViaApi(target, searchWord); // existing pagination loop
      }
    });
}
```

Extract the existing pagination loop (the `doSearch` closure) into a private
`searchViaApi()` method.

**Pagination:** The API path uses skip/limit=50 pagination and loops until
`haveMore = false`. The local path returns all matches in one call — `haveMore` is
hardcoded `false`.

### `fetchSuggestions()` — local-first autocomplete

```typescript
fetchSuggestions(term: string): Observable<WordLang[]> {
  const lang = this.#translate.currentLang ?? 'id';

  return from(this.#dictStore.count()).pipe(
    switchMap(async (count) => {
      if (count > 0) {
        const prefixes =
          lang === 'id'
            ? new IndonesianStemmer().getWordVariations(term)
            : [term];

        const seen = new Set<string>();
        const results: WordLang[] = [];

        for (const prefix of prefixes) {
          const hits = await this.#dictStore.findByPrefix(prefix, lang, 10);
          for (const hit of hits) {
            const key = hit.word + '|' + hit.lang;
            if (!seen.has(key)) {
              seen.add(key);
              results.push(new WordLang(hit.word, hit.lang));
            }
            if (results.length >= 10) break;
          }
          if (results.length >= 10) break;
        }

        return results;
      }
      return null;
    }),
    switchMap((results) => {
      if (results !== null) return of(results);
      // Existing API fallback — unchanged
      return this.#authService.getRequestHeaders().pipe(
        switchMap((headers) =>
          this.#http.get<WordLang[]>(
            `/api/v1/dictionary/autocomplete/${term}`,
            { headers },
          ),
        ),
      );
    }),
  );
}
```

`TranslateService` is already injected in `DictionaryService` (used by `handleError()`).
Access `currentLang` from it.

---

## Part 6 — Angular: sync status UI

**File:** `apps/taalwiz-web/src/app/home/dictionary/dictionary.page.ts`

Inject `DictSyncService` and `DictStoreService`. Expose signals:

```typescript
protected syncStatus = toSignal(
  inject(DictSyncService).status$,
  { initialValue: 'idle' as SyncStatus },
);
protected dictIsEmpty = signal(true); // set to false after count() resolves > 0
```

Initialize `dictIsEmpty` in `ngOnInit` or the constructor:

```typescript
inject(DictStoreService).count().then((n) => this.dictIsEmpty.set(n === 0));
```

**File:** `apps/taalwiz-web/src/app/home/dictionary/dictionary.page.html`

Add a status banner above the search bar:

```html
@if (syncStatus() === 'syncing') {
  <div class="sync-banner">
    <ion-progress-bar type="indeterminate"></ion-progress-bar>
    <p>{{ 'dictionary.sync-downloading' | translate }}</p>
  </div>
}
@if (syncStatus() === 'offline') {
  <p class="sync-note">{{ 'dictionary.sync-offline' | translate }}</p>
}
@if (syncStatus() === 'error') {
  <p class="sync-note sync-error">{{ 'dictionary.sync-error' | translate }}</p>
}
```

Disable the search input on the very first sync (no prior data):

```html
<ion-searchbar
  [disabled]="syncStatus() === 'syncing' && dictIsEmpty()"
  [placeholder]="syncStatus() === 'syncing' && dictIsEmpty()
    ? ('dictionary.sync-wait' | translate)
    : ('dictionary.search-placeholder' | translate)"
  ...
></ion-searchbar>
```

Add translation keys to both `src/assets/i18n/en.json` and `src/assets/i18n/nl.json`
(verify the actual i18n file paths in the project before implementing):

```json
"dictionary": {
  "sync-downloading": "Downloading dictionary for offline use…",
  "sync-offline":     "Offline — using cached dictionary.",
  "sync-error":       "Dictionary sync failed. Will retry next session.",
  "sync-wait":        "Downloading dictionary…"
}
```

---

## Part 7 — Angular: app initialization wiring

### Where to call `DictSyncService.init()`

The `authGuard` (file: `apps/taalwiz-web/src/app/auth/auth.guard.ts`) calls
`authService.autoLogin()` and resolves `true` when authenticated. This is the correct
injection point for the initial sync.

**In `authGuard`:**

```typescript
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const dictSync   = inject(DictSyncService);
  const router     = inject(Router);
  const logger     = inject(LoggerService);

  const obs$ = authService.user() ? of(true) : authService.autoLogin();
  return obs$.pipe(
    tap((isAuthenticated) => {
      if (!isAuthenticated) {
        logger.warn('authGuard', 'User is not authenticated');
        router.navigateByUrl('/auth');
      } else {
        void dictSync.init(); // fire and forget — does not block navigation
      }
    }),
  );
};
```

**In `AppComponent.checkAuthOnResume()`** (for app resume after backgrounding):

```typescript
.subscribe((success) => {
  if (!success) {
    this.onLogout();
  } else {
    void this.#dictSync.syncIfNeeded(); // cheap version check on resume
  }
});
```

### After manual login

Find the login component's form submit handler (search for `authService.login(` in
`apps/taalwiz-web/src/app/auth/`). In the success callback, call
`dictSyncService.init()`.

---

## Part 8 — Exclude dict files from the Angular service worker cache

**File:** `apps/taalwiz-web/ngsw-config.json`

The current `assets` group caches `/assets/**`, which would include the dict JSON files.
Since IndexedDB handles the dictionary data, having the SW also cache them doubles the
storage and could cause stale-data issues. Exclude them:

```json
{
  "name": "assets",
  "installMode": "lazy",
  "updateMode": "prefetch",
  "resources": {
    "files": [
      "/assets/**",
      "/*.(svg|cur|jpg|jpeg|png|apng|webp|avif|gif|otf|ttf|woff|woff2)"
    ],
    "excludeFiles": [
      "/assets/*.*.json",
      "/assets/dict-manifest.json"
    ]
  }
}
```

**Verify** that Angular's `@angular/service-worker` supports `excludeFiles` in your
version — it was added in Angular 17. If not supported, use a more specific glob in
`files` instead of a wildcard (e.g., list only image/font extensions explicitly and
remove `/assets/**`).

---

## Implementation order

**Before touching any files, create a feature branch:**

```bash
git checkout -b feat/offline-dictionary
```

The goal is to keep this work isolated from `main` so the two approaches can be compared
before deciding whether to merge.

---

Execute in this order to allow incremental testing:

1. **API — Parts 1.1 + 1.2** (`manifest-writer.ts` + new `DictLoader.ts`)
   - Upload a test dict JSON file via the admin UI
   - Verify `api/public/teeuw.a.json` is written to disk
   - Verify `api/public/dict-manifest.json` is created with correct content
   - Verify `GET /assets/dict-manifest.json` and `GET /assets/teeuw.a.json` return data

2. **Angular — Part 2** (copy `IndonesianStemmer`)
   - No wiring needed; verify TypeScript compiles

3. **Angular — Part 3** (`DictStoreService`)
   - Add `idb`: `pnpm --filter taalwiz-web add idb`
   - Write service; verify `open()`, `replaceAll()`, and `findByWordAndLang()` work via
     browser DevTools IndexedDB inspector

4. **Angular — Part 4** (`DictSyncService`)
   - Wire up manifest fetch + file fetches + `replaceAll()`
   - After sync, inspect IndexedDB in DevTools to confirm data is present

5. **Angular — Part 5** (modify `DictionaryService`)
   - Test online first (IndexedDB populated) — verify lookup returns correct results
   - Set DevTools to Offline; verify lookup still works from IndexedDB
   - Verify API fallback works if IndexedDB is cleared manually via DevTools

6. **Angular — Part 6** (UI status banner)
   - Add i18n keys; test all four status states

7. **Angular — Part 7** (app init wiring in `authGuard` + `AppComponent`)
   - Full integration test: log in → observe sync banner → go offline → look up words

8. **Angular — Part 8** (`ngsw-config.json`)
   - Apply exclusion; verify production build and SW behavior

9. **Cleanup — Part 1.3** (drop MongoDB dict collections)
   - Only after all the above is verified in production

---

## Open decisions

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | `idb` package vs. raw IndexedDB? | Use `idb` (~2 kB) — typed, Promise-based, avoids manual wrapping boilerplate |
| 2 | Persist storage permission? | Call `navigator.storage.persist()` after first successful sync to prevent browser eviction under storage pressure |
| 3 | `_pending*` pattern in `DictFileLoader`? | If it feels awkward, extend `Upload<T>` with a `rawContent?: string` field in `BaseLoader` and pass it through to `createData()` |
| 4 | `PUBLIC_DIR` path resolution? | Confirm that `path.resolve('api/public')` is correct relative to the NestJS process working directory in both dev and production |
| 5 | Re-sync on app resume? | Yes — already handled by `AppComponent.checkAuthOnResume()` wiring in Part 7 |
| 6 | `excludeFiles` in ngsw-config? | Verify Angular SW version supports it; fall back to explicit file globs if not |
| 7 | Keep API fallback long-term? | Once IndexedDB is proven reliable in production, consider removing the Lemma/AutoCompletions fallback entirely to simplify `DictionaryService` |

---

## Files to create (new)

```
apps/taalwiz-api/src/content/loaders/manifest-writer.ts
apps/taalwiz-web/src/app/home/dictionary/indonesian-stemmer.ts   (copy from API)
apps/taalwiz-web/src/app/home/dictionary/dict-store.service.ts
apps/taalwiz-web/src/app/home/dictionary/dict-sync.service.ts
```

## Files to modify

```
apps/taalwiz-api/src/content/loaders/DictLoader.ts              (replace entirely)
apps/taalwiz-web/src/app/auth/auth.guard.ts
apps/taalwiz-web/src/app/app.component.ts
apps/taalwiz-web/src/app/home/dictionary/dictionary.service.ts
apps/taalwiz-web/src/app/home/dictionary/dictionary.page.ts
apps/taalwiz-web/src/app/home/dictionary/dictionary.page.html
apps/taalwiz-web/src/app/home/dictionary/dictionary.page.scss    (sync banner styles)
apps/taalwiz-web/ngsw-config.json
src/assets/i18n/en.json                                          (verify path)
src/assets/i18n/nl.json                                          (verify path)
```

## Files to delete (after cleanup — step 9)

```
apps/taalwiz-api/src/dictionary/models/lemma.model.ts
apps/taalwiz-api/src/dictionary/models/completions.model.ts
```
