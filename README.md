# Taalwiz Monorepo

Taalwiz is a language learning platform (Indonesian ↔ Dutch). This repository is a
TypeScript monorepo managed by [Turborepo](https://turborepo.com) and
[pnpm](https://pnpm.io), containing the backend API, the client app, a dictionary
compiler, and the documentation site.

## Apps

| App | What it is |
|-----|------------|
| [`apps/web`](apps/web/README.md) | Angular 20 + Ionic 8 + Capacitor 7 hybrid web/mobile app — the primary client |
| [`apps/api`](apps/api/README.md) | NestJS 11 backend (MongoDB/Mongoose, JWT) serving the REST API |
| [`apps/compiler`](apps/compiler/README.md) | Utility that compiles dictionary sources into structured JSON |
| [`apps/docs`](apps/docs/README.md) | VitePress static documentation site |

See [CLAUDE.md](CLAUDE.md) for the full list of development commands and conventions.
