# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Taalwiz is a TypeScript monorepo managed by **Turborepo** and **pnpm**. It contains a NestJS backend API, a React/Ionic web app (PWA), an Angular/Ionic hybrid web/mobile app, a dictionary compiler utility, and a legacy Express API (deprecated, no further development).

## Commands

### Root-level (via Turborepo)

```bash
pnpm build          # Build all packages
pnpm dev            # Start all apps in dev mode
pnpm lint           # Lint all packages
pnpm check-types    # Type-check all packages
pnpm format         # Prettier format all .ts/.tsx/.md files
```

### NestJS API (`apps/api`)

```bash
pnpm --filter api run start:dev          # Dev server with watch
pnpm --filter api run build              # Build via nest build
pnpm --filter api run lint               # Lint with auto-fix
pnpm --filter api run test               # Run all Jest tests
pnpm --filter api run test -- --watch    # Watch mode
pnpm --filter api run test -- user.service.spec.ts  # Single test file
pnpm --filter api run test:e2e           # E2E tests (jest-e2e.json config)
```

### React Web (`apps/web-react`)

```bash
pnpm --filter web-react run dev              # Dev server (Vite)
pnpm --filter web-react run build            # Production build (tsc + vite build)
pnpm --filter web-react run lint             # ESLint
pnpm --filter web-react run check-types      # Type-check only
pnpm --filter web-react run test             # Vitest (single run)
pnpm --filter web-react run test:watch       # Vitest watch mode
pnpm --filter web-react run test:coverage    # Vitest with coverage
```

### Angular Web (`apps/web`)

```bash
pnpm --filter web run start    # Dev server (ng serve)
pnpm --filter web run build    # Production build (ng build)
pnpm --filter web run test     # Karma/Jasmine tests
pnpm --filter web run lint     # Angular lint
```

### Dict Compiler (`apps/dict-compiler`)

```bash
pnpm --filter dict-compiler run build    # tsc build
pnpm --filter dict-compiler run test     # Node.js built-in test runner with tsx
```

## Architecture

### Monorepo Layout

- **`apps/api`** — NestJS 11 backend (Express platform, MongoDB/Mongoose, JWT auth, Nodemailer with Handlebars templates, class-validator)
- **`apps/web-react`** — React 19 + Ionic 8 + Vite PWA (primary web app, react-i18next for i18n, Vitest for tests); converted from `apps/web` by Claude — the Angular version will be deprecated once this app reaches feature parity
- **`apps/web`** — Angular 20 + Ionic 8 + Capacitor 7 hybrid app (ngx-translate for i18n); to be deprecated in favour of `apps/web-react`
- **`apps/dict-compiler`** — Standalone TypeScript utility for compiling dictionaries
- **`apps/api-legacy`** — Deprecated Express 5 API (do not develop further)
- **`packages/eslint-config`** — Shared ESLint configs with presets: `base`, `nest`, `angular`, `react`
- **`packages/typescript-config`** — Shared `base.json` tsconfig (ESNext, NodeNext module, strict)

### Dependencies Between Packages

All apps consume `@repo/eslint-config` (via `workspace:*`). The API uses the `nest` preset, web-react uses `react`, web uses `angular`, and dict-compiler uses `base`. TypeScript configs in apps extend or reference `@repo/typescript-config/base.json`.

### Testing Strategy

- **API**: Jest (test files: `*.spec.ts` in `src/`)
- **Web React**: Vitest + Testing Library (test files: `src/**/*.test.{ts,tsx}`)
- **Web**: Karma + Jasmine (test files: `*.spec.ts`)
- **Dict Compiler & API Legacy**: Node.js built-in test runner with tsx (test files: `src/__tests__/**/*.test.ts`)

## Security

### XSS — `dangerouslySetInnerHTML`

All HTML rendered via `dangerouslySetInnerHTML` **must** be wrapped in `sanitize()` from `apps/web-react/src/lib/sanitize.ts` (DOMPurify). Never add a new `dangerouslySetInnerHTML` site without it.

```tsx
import { sanitize } from '../lib/sanitize.ts';
// ...
dangerouslySetInnerHTML={{ __html: sanitize(html) }}
```

### XSS — Markdown helpers

`tinyMarkdown()` and `convertMarkdown()` in `apps/web-react/src/lib/markdown.ts` HTML-escape their plain-text inputs before building HTML. If you modify these functions, preserve that escaping — do not pass pre-built HTML strings into `tinyMarkdown()` (use the internal `_applyMarkdown()` instead, as `convertMarkdown` does).

### Auth tokens

The refresh token is stored in `localStorage` (key `authData` in `AuthContext`). This is a known medium-severity risk documented in `apps/web-react/SECURITY.md`. Do not widen this surface — avoid storing additional sensitive values in `localStorage` or `sessionStorage`.

### Content Security Policy

No CSP is currently enforced. The dev server does not set one (Vite's React Fast Refresh requires `'unsafe-inline'` for scripts, which negates most of the benefit). Production CSP must be configured at the web server / CDN layer — add it there before going live. A starting point:

```
default-src 'self'; script-src 'self' 'nonce-{random}'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none';
```

### File uploads (admin)

The upload dropzone in `AdminUploadPage` is restricted to `.md` and `.json`. If new file types are needed, update both the `accept` prop on the dropzone **and** the server-side validation in `apps/api/src/content/content.service.ts`.

### Full findings

`apps/web-react/SECURITY.md` contains the complete audit with severity ratings and remaining open items.

## Conventions

- ESM everywhere — use `import`/`export`, never CommonJS
- Unused variables must be prefixed with `_` (ESLint rule)
- Angular components use `app` prefix with kebab-case selectors
- NestJS API has `noImplicitAny: false` in its tsconfig
- Environment variables are tracked in `turbo.json` for caching — update the `globalEnv` list there when adding new env vars
