# taalwiz-docs

Static documentation site for the Taalwiz language learning app, built with [VitePress](https://vitepress.dev). Source files are Markdown; the output is plain HTML served by nginx at `https://taalwiz.nl/guide`.

## Local development

```bash
pnpm --filter taalwiz-docs run dev
```

Opens at `http://localhost:4173/guide/`.

## Production build

```bash
pnpm --filter taalwiz-docs run build
```

Output: `apps/taalwiz-docs/docs/.vitepress/dist/`

## Deployment

See [SETUP.md](./SETUP.md) for nginx configuration on the Raspberry Pi.
