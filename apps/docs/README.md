# @ctm/docs

Docusaurus site — user-facing documentation and generated OpenAPI reference.

The OpenAPI spec is generated from `apps/main` (`pnpm generate-openapi`) and rendered by `docusaurus-plugin-openapi-docs`.

> Do not store internal planning files or specs here. Those belong in `.claude/`.

## Commands

```bash
pnpm --filter @ctm/docs dev      # local dev server
pnpm --filter @ctm/docs build    # production build → build/
pnpm --filter @ctm/docs serve    # serve the production build locally
```

## Updating the API Reference

```bash
# 1. Regenerate the OpenAPI spec from apps/main
pnpm --filter @ctm/main generate-openapi

# 2. Copy / reference the output in the docs plugin config, then rebuild
pnpm --filter @ctm/docs build
```
