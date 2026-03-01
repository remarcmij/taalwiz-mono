# Security Findings: web-react

Date: 2026-03-01

## 1. XSS via `dangerouslySetInnerHTML` — High Risk

Six locations render server-supplied or database-supplied HTML directly into the DOM with no client-side sanitization:

| File | Source of HTML |
|---|---|
| `src/components/ArticleBody.tsx:30` | `article.htmlText` from API |
| `src/pages/admin/AdminArticlePreviewPage.tsx:93` | `article.htmlText` from API |
| `src/pages/user/AboutPage.tsx:34` | `article.htmlText` from API |
| `src/pages/user/WelcomePage.tsx:39` | `article.htmlText` from API |
| `src/components/WordClickModal.tsx:129` | `tinyMarkdown()` output from lemma data |
| `src/components/LemmaCard.tsx:27` | `convertMarkdown()` output from lemma data |

The `tinyMarkdown` and `convertMarkdown` functions in `src/lib/markdown.ts` perform simple regex-based string replacements to produce HTML but do **not escape their inputs first**. If content stored in the database contains `<script>` tags or event handler attributes (e.g., `onerror=`), they will be executed verbatim in the browser.

The implicit trust model is that the API enforces strict sanitization server-side. Client-side defense-in-depth is absent.

**Recommended fixes:**
- Run all `article.htmlText` values through a client-side sanitizer such as [DOMPurify](https://github.com/cure53/DOMPurify) before passing them to `dangerouslySetInnerHTML`.
- HTML-escape user-controlled input inside `tinyMarkdown` / `convertMarkdown` before injecting any HTML tags.

---

## 2. Refresh Token Stored in `localStorage` — Medium Risk

`src/context/AuthContext.tsx:256–258` serialises the refresh token into `localStorage` under the key `authData`. `localStorage` is accessible to any JavaScript executing on the page. If XSS is achieved (see issue 1), an attacker can silently exfiltrate the refresh token and maintain long-lived access to the account.

**Recommended fix:**
- Store the refresh token in an `HttpOnly` cookie set by the API. This removes JavaScript access entirely and is the industry-standard mitigation. It requires the `/api/v1/auth/refresh` endpoint to read the token from the cookie rather than the request body.
- If `HttpOnly` cookies are not feasible, accept the trade-off explicitly and prioritise eliminating the XSS risk, as that is the primary threat vector for token theft.

---

## 3. No Content Security Policy — Medium Risk

`index.html` contains no `Content-Security-Policy` meta tag, and `vite.config.ts` configures no CSP response headers for the dev server or preview server. Without a CSP, any injected script — whether from XSS or a compromised npm dependency — can execute freely, make arbitrary network requests, and exfiltrate data.

**Recommended fix:**
- Add a CSP at the web server or CDN layer (preferred over a meta tag, as meta tags cannot restrict certain directives such as `frame-ancestors`). A restrictive starting point:
  ```
  Content-Security-Policy:
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    connect-src 'self';
    img-src 'self' data:;
    font-src 'self';
    frame-ancestors 'none';
  ```
  Note: Ionic uses inline styles, so `'unsafe-inline'` for `style-src` is likely necessary. Scripts can and should be locked down to `'self'`.

---

## 4. File Upload Has No Client-Side Type Restriction — Low Risk

`src/pages/admin/AdminUploadPage.tsx:85–88` initialises `react-dropzone` without an `accept` prop, so any file type can be queued and submitted. Server-side validation is the authoritative control and must remain so, but the absence of a client-side filter widens the opportunity for confused uploads and potential server-side parser vulnerabilities.

This is low risk on its own because the upload page is protected by the admin role guard.

**Recommended fix:**
- Add an `accept` prop to the `useDropzone` call restricting to the expected file types (e.g., `{ 'text/markdown': ['.md'], 'application/json': ['.json'] }`).

---

## 5. `document.getElementById` with URL-Supplied Value — Informational

`src/pages/home/content/ArticlePage.tsx:46–49` calls `document.getElementById(\`_${scrollToId}_\`)` where `scrollToId` is read directly from the `?id=` URL query parameter. `getElementById` does not parse or execute HTML, so this is safe as written. However, if this pattern were ever changed to `querySelector` or `querySelectorAll`, the unsanitised value would become an injection point.

**No action required.** Note for future reference: never pass unsanitised URL parameters to DOM selector APIs.

---

## 6. Client-Side Admin Guard Is UI-Only — Informational

`src/App.tsx:54–58` redirects unauthenticated or non-admin users away from `/admin/*` routes. This is correct UX but is not a security control — it depends on `isAdmin` derived from the in-memory auth state and can be bypassed by any user who manipulates local state. Real enforcement must come from the API rejecting requests made with non-admin tokens.

This appears to be the intended architecture. It is noted here only to make the trust boundary explicit: **all admin security lives in the API, not the client.**

---

## Summary

| # | Issue | Severity |
|---|---|---|
| 1 | `dangerouslySetInnerHTML` without sanitization (6 sites) | **High** |
| 2 | Refresh token stored in `localStorage` | **Medium** |
| 3 | No Content Security Policy | **Medium** |
| 4 | File upload: no client-side type filter | **Low** |
| 5 | `getElementById` with URL-supplied value | **Informational** |
| 6 | Client-side admin guard is UI-only | **Informational** |

The highest-priority fix is adding DOMPurify (or equivalent) before every `dangerouslySetInnerHTML` call, both because the XSS surface is wide and because a successful XSS attack directly enables theft of the refresh token stored in `localStorage`.

---

## Fixes Applied — 2026-03-01

Issues 1, 3, and 4 were addressed. Issue 2 (refresh token in `localStorage`) was deferred pending API changes.

### Issue 1 — XSS (Fixed)

**`src/lib/markdown.ts`** — Added `escapeHtml()` to sanitize plain-text inputs before HTML is constructed. Refactored into an internal `_applyMarkdown()` (regex substitutions only) and the public `tinyMarkdown()` (escapes, then substitutes). `convertMarkdown()` now escapes each plain-text buffer segment individually before inserting `<span>` tags, then calls `_applyMarkdown()`.

**`src/lib/sanitize.ts`** *(new)* — Thin wrapper around `DOMPurify.sanitize()` imported as a shared utility.

**`dompurify`** added as a production dependency; all six `dangerouslySetInnerHTML` sites now pass their HTML through `sanitize()`:

| File | Change |
|---|---|
| `src/components/ArticleBody.tsx` | `sanitize(htmlText)` |
| `src/pages/admin/AdminArticlePreviewPage.tsx` | `sanitize(article.htmlText)` |
| `src/pages/user/AboutPage.tsx` | `sanitize(article.htmlText)` |
| `src/pages/user/WelcomePage.tsx` | `sanitize(article.htmlText)` |
| `src/components/WordClickModal.tsx` | `sanitize(html)` |
| `src/components/LemmaCard.tsx` | `sanitize(convertMarkdown(lemma.text))` |

### Issue 3 — No Content Security Policy (Deferred)

Adding a CSP to the Vite dev server was attempted but broke the app: `@vitejs/plugin-react` injects an inline `<script type="module">` preamble for React Fast Refresh that `script-src 'self'` blocks. Adding `'unsafe-inline'` to work around it negates most of the benefit. The dev server CSP was removed.

CSP must be enforced at the **production web server / CDN layer** where nonce-based or hash-based policies can be applied without the HMR constraint.

### Issue 4 — Unrestricted File Upload (Fixed)

**`src/pages/admin/AdminUploadPage.tsx`** — Added `accept: { 'text/markdown': ['.md'], 'application/json': ['.json'] }` to the `useDropzone` call, matching the file types the API accepts.

### Remaining open items

| # | Issue | Severity | Status |
|---|---|---|---|
| 2 | Refresh token stored in `localStorage` | **Medium** | Open — requires API changes |
| 3 | No Content Security Policy | **Medium** | Open — must be set at production server/CDN |
| 5 | `getElementById` with URL-supplied value | **Informational** | No action needed |
| 6 | Client-side admin guard is UI-only | **Informational** | No action needed |
