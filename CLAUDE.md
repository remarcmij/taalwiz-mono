# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Taalwiz is a TypeScript monorepo managed by **Turborepo** and **pnpm**. It contains a NestJS backend API, an Angular/Ionic hybrid web/mobile app, a dictionary compiler utility, and a legacy Express API (deprecated, no further development).

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
- **`apps/web`** — Angular 20 + Ionic 8 + Capacitor 7 hybrid app (ngx-translate for i18n)
- **`apps/dict-compiler`** — Standalone TypeScript utility for compiling dictionaries
- **`apps/api-legacy`** — Deprecated Express 5 API (do not develop further)
- **`packages/eslint-config`** — Shared ESLint configs with presets: `base`, `nest`, `angular`
- **`packages/typescript-config`** — Shared `base.json` tsconfig (ESNext, NodeNext module, strict)

### Dependencies Between Packages

All apps consume `@repo/eslint-config` (via `workspace:*`). The API uses the `nest` preset, web uses `angular`, and dict-compiler uses `base`. TypeScript configs in apps extend or reference `@repo/typescript-config/base.json`.

### Testing Strategy

- **API**: Jest (test files: `*.spec.ts` in `src/`)
- **Web**: Karma + Jasmine (test files: `*.spec.ts`)
- **Dict Compiler & API Legacy**: Node.js built-in test runner with tsx (test files: `src/__tests__/**/*.test.ts`)

## Conventions

- ESM everywhere — use `import`/`export`, never CommonJS
- Unused variables must be prefixed with `_` (ESLint rule)
- Angular components use `app` prefix with kebab-case selectors
- NestJS API has `noImplicitAny: false` in its tsconfig
- Environment variables are tracked in `turbo.json` for caching — update the `globalEnv` list there when adding new env vars
