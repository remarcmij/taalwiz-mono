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
