# Taalwiz Monorepo

Taalwiz is a language learning platform built around **Indonesian** as the target
language. The base language paired with it is configurable: this repository is set
up for Dutch speakers (Indonesian ↔ Dutch), but another instance could pair
Indonesian with English. The user interface is available in Dutch and English.

This repository is a TypeScript monorepo managed by
[Turborepo](https://turborepo.com) and [pnpm](https://pnpm.io), containing the
backend API, the client app, a dictionary compiler, and the documentation site.

For a high-level tour of what Taalwiz does and how it works, see the
[**project overview**](docs/OVERVIEW.md).

## Apps

| App | What it is |
|-----|------------|
| [`apps/web`](apps/web/README.md) | Angular 20 + Ionic 8 + Capacitor 7 hybrid web/mobile app — the primary client |
| [`apps/api`](apps/api/README.md) | NestJS 11 backend (MongoDB/Mongoose, JWT) serving the REST API |
| [`apps/compiler`](apps/compiler/README.md) | Utility that compiles dictionary sources into structured JSON |
| [`apps/docs`](apps/docs/README.md) | VitePress static documentation site |

## Getting Started

**Prerequisites:** [Node.js](https://nodejs.org) ≥ 18 and [pnpm](https://pnpm.io) 10.33.0 (the version pinned in `packageManager`; `corepack enable` will provision it automatically).

```bash
pnpm install          # install all workspace dependencies
pnpm dev              # start every app in dev mode
```

To run a single app, filter by its workspace name:

```bash
pnpm --filter web run dev      # Angular client → http://localhost:4200
pnpm --filter api run dev      # NestJS API     → http://localhost:3000
pnpm --filter docs run dev     # VitePress docs → http://localhost:4173
```

Other root tasks: `pnpm build`, `pnpm lint`, `pnpm check-types`, `pnpm format`.

### API configuration

The API reads its configuration from `apps/api/.env`. Copy the template and fill in the values before starting it:

```bash
cp apps/api/.env.example apps/api/.env
```

See [CLAUDE.md](CLAUDE.md) for the full list of development commands and conventions.
