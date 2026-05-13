# Changes — taalwiz-web

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
