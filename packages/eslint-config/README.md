# `@repo/eslint-config`

Shared ESLint configurations used across the Taalwiz monorepo. Each app extends a preset:

| Preset | Import | Used by |
|--------|--------|---------|
| `base` | `@repo/eslint-config/base` | Common ruleset the other presets build on |
| `nest` | `@repo/eslint-config/nest` | `apps/api`, `apps/compiler` |
| `angular` | `@repo/eslint-config/angular` | `apps/web` |
