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

---

## Production nginx Configuration

The Vite production build emits **no inline scripts** — only `<script type="module" src="...">` tags with content-hashed filenames. This means a strict `script-src 'self'` (without `'unsafe-inline'`) is safe in production.

### Architecture

```
Browser → nginx (443) → /api/*   → NestJS :3000 (REST API)
                      → /assets/* → NestJS :3000 (uploaded content)
                      → /*        → dist/  (Vite build, SPA fallback)
```

### Step 1 — Shared security-headers snippet

Create `/etc/nginx/snippets/taalwiz-headers.conf`:

```nginx
# Content Security Policy
# script-src 'self' is safe in production — the Vite build emits no inline scripts.
# style-src 'unsafe-inline' is required by Ionic's runtime styling.
add_header Content-Security-Policy
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none';"
    always;

# Belt-and-suspenders clickjacking protection for older browsers
add_header X-Frame-Options "DENY" always;

# Prevent MIME-type sniffing
add_header X-Content-Type-Options "nosniff" always;

# Limit referrer information sent to third parties
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Restrict access to sensitive browser APIs
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

> **Why a separate snippet?** nginx's `add_header` directives are **not inherited** by nested `location` blocks. Placing them in an include file lets you add them to every location with a single line.

### Step 2 — Server block

Create `/etc/nginx/sites-available/taalwiz` (adjust domain, paths, and port to match your setup):

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    # TLS — managed by Certbot or equivalent
    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Serve the Vite production build
    root  /var/www/taalwiz/web-react/dist;
    index index.html;

    # --- NestJS API ---
    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        include snippets/taalwiz-headers.conf;
    }

    # --- Uploaded / API-served content assets ---
    # The NestJS API serves its public/ folder under /assets/.
    location /assets/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        include snippets/taalwiz-headers.conf;
    }

    # --- Vite build artefacts (content-hashed, safe to cache forever) ---
    # Matches /assets/index-AbCdEf12.js, /assets/index-XyZ.css, etc.
    # Note: this location is matched before the /assets/ proxy above only
    # if the file actually exists on disk — adjust ordering if needed.
    location ~* ^/assets/.+\.[a-f0-9]{8}\.(js|css)$ {
        expires    1y;
        add_header Cache-Control "public, immutable" always;
        include snippets/taalwiz-headers.conf;
    }

    # --- PWA service worker and workbox runtime ---
    # Must never be cached long-term so updates propagate to clients promptly.
    location ~* ^/(sw|workbox-.+)\.js$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        include snippets/taalwiz-headers.conf;
    }

    # --- Web app manifest ---
    location = /manifest.webmanifest {
        add_header Cache-Control "no-cache" always;
        include snippets/taalwiz-headers.conf;
    }

    # --- SPA fallback ---
    # All other paths return index.html so client-side routing works on reload.
    # index.html itself must not be cached (browsers would miss new deployments).
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        include snippets/taalwiz-headers.conf;
    }
}
```

Enable the site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/taalwiz /etc/nginx/sites-enabled/
sudo nginx -t          # verify config
sudo systemctl reload nginx
```

### Key points

| Point | Detail |
|---|---|
| `script-src 'self'` | Safe in production — no inline scripts in Vite build output |
| `style-src 'unsafe-inline'` | Required — Ionic applies styles via the `style` attribute at runtime |
| SPA fallback | `try_files ... /index.html` is essential for deep-link reloads |
| Service worker cache | `sw.js` and `workbox-*.js` must be `no-cache` so updates propagate |
| Vite assets cache | Content-hashed filenames (`index-Ab12Cd34.js`) are safe to cache for 1 year |
| `add_header` inheritance | Headers are **not** inherited by child `location` blocks — always `include snippets/taalwiz-headers.conf` in every location |
| NestJS also serves `/assets/` | The API's `ServeStaticModule` exposes its `public/` folder under `/assets/` — nginx must proxy that path to NestJS, not serve it from `dist/` |

### Remaining open items

| # | Issue | Severity | Status |
|---|---|---|---|
| 2 | Refresh token stored in `localStorage` | **Medium** | Open — requires API changes |
| 3 | No Content Security Policy | **Medium** | Open — must be set at production server/CDN |
| 5 | `getElementById` with URL-supplied value | **Informational** | No action needed |
| 6 | Client-side admin guard is UI-only | **Informational** | No action needed |
