# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Taalwiz is a TypeScript monorepo managed by **Turborepo** and **pnpm**. It contains a NestJS backend API, an Angular/Ionic hybrid web/mobile app, and a dictionary compiler utility.

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
pnpm --filter api run test               # Run all Vitest tests
pnpm --filter api run test:watch         # Watch mode
pnpm --filter api run test user.service.spec.ts     # Single test file
pnpm --filter api run test:e2e           # E2E tests (test/vitest.config.ts)
```

### Angular Web (`apps/web`)

```bash
pnpm --filter web run dev      # Dev server (ng serve, port 4200)
pnpm --filter web run build    # Production build (ng build)
pnpm --filter web run test     # Vitest (single run)
pnpm --filter web run test:watch  # Vitest watch mode
pnpm --filter web run lint     # Angular lint
```

### Dict Compiler (`apps/compiler`)

```bash
pnpm --filter compiler run build    # tsc build
pnpm --filter compiler run test     # Vitest
```

## Architecture

### Monorepo Layout

- **`apps/api`** — NestJS 11 backend (Express platform, MongoDB/Mongoose, JWT auth, Nodemailer with Handlebars templates, class-validator)
- **`apps/web`** — Angular 20 + Ionic 8 + Capacitor 7 hybrid app (ngx-translate for i18n); **primary web app**
- **`apps/compiler`** — Standalone TypeScript utility for compiling dictionaries
- **`packages/eslint-config`** — Shared ESLint configs with presets: `base`, `nest`, `angular`
- **`packages/typescript-config`** — Shared `base.json` tsconfig (ESNext, NodeNext module, strict)

### Dependencies Between Packages

All apps consume `@repo/eslint-config` (via `workspace:*`). The API uses the `nest` preset, web uses `angular`, and compiler uses `base`. TypeScript configs in apps extend or reference `@repo/typescript-config/base.json`.

### Testing Strategy

- **API**: Vitest with globals (test files: `*.spec.ts` in `src/`)
- **Web**: Vitest (test files: `*.spec.ts` in `src/`). Pure-logic only — no Angular component/DOM tests yet.
- **Compiler**: Vitest (test files: `src/__tests__/**/*.test.ts`)

## Security

### File uploads (admin)

The upload dropzone in the admin page accepts `.md` and `.json` content files plus `.jpg`, `.jpeg`, `.png`, `.gif`, and `.webp` publication images. Images are written directly to `apps/api/public/assets/images/` and served at `/assets/images/`. Each manifest declares which image to display via an `image:` frontmatter field; the value is the full image filename (e.g. `bumi-manusia.jpg`). If new file types are needed, update both the client-side `accept` prop **and** the server-side validation in `apps/api/src/content/content.service.ts`.

## Conventions

- ESM everywhere — use `import`/`export`, never CommonJS
- Unused variables must be prefixed with `_` (ESLint rule)
- Angular components use `app` prefix with kebab-case selectors
- Environment variables are tracked in `turbo.json` for caching — update the `globalEnv` list there when adding new env vars
