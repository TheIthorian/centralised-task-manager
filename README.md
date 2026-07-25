# Centralised Task Manager

A monorepo that aggregates tasks from multiple sources (Todoist, Google Tasks) into a single API, with a web UI and docs site.

Managed with **pnpm workspaces** + **Turborepo**.

---

## Apps

| App                                      | Description                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`apps/main`](apps/main/README.md)       | NestJS REST API — auth, task aggregation, OAuth flows, API token issuance, scheduled sync + reminders               |
| [`apps/sync`](apps/sync/README.md)       | NestJS background worker — polls connected sources every 15 min, upserts tasks into MongoDB, refreshes OAuth tokens |
| [`apps/web`](apps/web/README.md)         | Vite + React SPA — task management UI, deployed to Cloudflare Pages                                                 |
| [`apps/docs`](apps/docs/README.md)       | Docusaurus site — user-facing docs and generated OpenAPI reference                                                  |
| [`apps/landing`](apps/landing/README.md) | Landing / marketing page                                                                                            |

## Packages

| Package                                                        | Description                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| [`packages/connectors`](packages/connectors/README.md)         | `TaskConnector` interface + Todoist and Google Tasks adapters |
| [`packages/api-client`](packages/api-client/README.md)         | Typed HTTP client for `apps/main`                             |
| [`packages/logger`](packages/logger/README.md)                 | Shared Pino logger                                            |
| [`packages/request-logger`](packages/request-logger/README.md) | HTTP request/response logging (Pino + Nest middleware)        |
| [`packages/errors`](packages/errors/README.md)                 | Shared error types                                            |
| [`packages/http-client`](packages/http-client/README.md)       | Shared fetch wrapper                                          |
| [`packages/config`](packages/config/README.md)                 | Shared oxlint config                                          |
| [`packages/tsconfig`](packages/tsconfig/README.md)             | Shared TypeScript configs                                     |

---

## Quick Start

```bash
pnpm install
docker compose up        # starts MongoDB + all services
pnpm dev                 # or run without Docker
```

## Common Commands

```bash
pnpm build       # build all apps
pnpm test        # run all tests
pnpm lint        # oxlint across workspace
pnpm format      # oxfmt across workspace
```

See each app/package README for detailed setup and environment variables.

## Deployment

Railway (API + MCP) · MongoDB Atlas · Cloudflare Pages (web, landing, docs).
See [DEPLOYMENT.md](DEPLOYMENT.md).
