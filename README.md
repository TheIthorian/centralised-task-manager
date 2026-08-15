# Centralised Task Manager

A monorepo that aggregates tasks from multiple sources (Todoist, Google Tasks, Notion) into a single API, with a web UI, a CLI, an MCP server and a docs site.

Managed with **pnpm workspaces** + **Turborepo**.

---

## Apps

| App                                          | Description                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`apps/main`](apps/main/README.md)           | NestJS REST API: auth, OAuth 2.1 authorization server, task aggregation, connector sync, reminders and notifications |
| [`apps/mcp`](apps/mcp)                       | MCP server: exposes tasks, connectors and notifications to MCP clients over Streamable HTTP                          |
| [`apps/web`](apps/web/README.md)             | Vite + React SPA: task management UI, deployed to Cloudflare Pages                                                   |
| [`apps/admin`](apps/admin/README.md)         | NestJS operator API: deployment metrics, OAuth client management, audit log. Behind Cloudflare Access                |
| [`apps/admin-web`](apps/admin-web/README.md) | Vite + React SPA: the operator console for `apps/admin`, deployed to Cloudflare Pages                                |
| [`apps/cli`](apps/cli/README.md)             | Node.js CLI (`ctm`): task and connector management                                                                   |
| [`apps/docs`](apps/docs/README.md)           | Docusaurus site: user-facing docs and generated OpenAPI reference                                                    |
| [`apps/landing`](apps/landing/README.md)     | Landing / marketing page                                                                                             |
| [`apps/storybook`](apps/storybook/README.md) | Storybook harness for `@ctm/ui`: dev tool, never deployed                                                            |

## Packages

| Package                                                        | Description                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`packages/ui`](packages/ui/README.md)                         | Design tokens + presentational React components                                |
| [`packages/connectors`](packages/connectors/README.md)         | `TaskConnector` interface + Todoist, Google Tasks, Notion and Discord adapters |
| [`packages/api-client`](packages/api-client/README.md)         | Typed HTTP client for `apps/main`, plus the shared request/response types      |
| [`packages/logger`](packages/logger/README.md)                 | Shared Pino logger                                                             |
| [`packages/request-logger`](packages/request-logger/README.md) | HTTP request/response logging (Pino + Nest middleware)                         |
| [`packages/errors`](packages/errors/README.md)                 | Shared error types                                                             |
| [`packages/http-client`](packages/http-client/README.md)       | Shared fetch wrapper                                                           |
| [`packages/config`](packages/config/README.md)                 | Shared oxlint config                                                           |
| [`packages/tsconfig`](packages/tsconfig/README.md)             | Shared TypeScript configs                                                      |

---

## Quick Start

```bash
pnpm install
docker compose up -d     # local MongoDB on :27017
pnpm dev                 # all apps via Turbo
```

Copy `.env.example` to `.env` and fill in the connector credentials you need. Each app README lists its own variables.

## Common Commands

```bash
pnpm build       # build all apps
pnpm test        # run all tests
pnpm lint        # oxlint across workspace
pnpm format      # oxfmt across workspace

pnpm --filter @ctm/main dev             # a single package
pnpm turbo run dev --filter=@ctm/docs   # docs: regenerates openapi.json first
```

## Deployment

Railway (`main` + `mcp` + `admin`) · MongoDB Atlas · Cloudflare Pages (web, admin-web, landing, docs).
See [DEPLOYMENT.md](DEPLOYMENT.md).
