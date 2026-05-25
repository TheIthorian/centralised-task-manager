# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Meta:** When the user states a new rule or convention, always add it to this file immediately before continuing with any other work.

## Monorepo Overview

Turborepo monorepo managed with **pnpm workspaces**.

```
apps/
  main/             # NestJS REST API + auth server (primary backend)
  web/              # Vite + React SPA (served by apps/main in production)
  cli/              # Node.js CLI (`ctm`) — task and connector management
  docs/             # Docusaurus site — compiled user-facing docs + OpenAPI reference
                    # (do NOT store internal markdown here)
packages/
  connectors/       # TaskConnector interface + Todoist + Google Tasks adapters
  logger/           # Shared Pino logger
  errors/           # Shared error types
  http/             # Shared fetch wrapper
  tsconfig/         # Shared TypeScript configs
  config/           # Shared oxlint config
```

**Internal planning files** (specs, implementation plans) live in `.claude/`:

```
.claude/
  specs/    # Design specs
  plans/    # Implementation plans
```

## Common Commands

```bash
pnpm install                        # Install all workspace dependencies
pnpm dev                            # Start all apps in dev mode (via Turbo)
pnpm build                          # Build all apps
pnpm lint                           # Run oxlint across workspace
pnpm format                         # Run oxfmt across workspace
pnpm test                           # Run all tests

# Scoped to a single package
pnpm --filter @ctm/main dev
pnpm --filter @ctm/main test
```

## Docker (Development)

```bash
docker compose up        # Start all services + MongoDB
docker compose up main   # Start only the main app + its deps
```

The `docker-compose.yml` at the repo root defines dev services: `main`, `sync`, and `mongodb`. Each app has a corresponding `Dockerfile`.

## Tech Stack

| Area              | Choice                                                       |
| ----------------- | ------------------------------------------------------------ |
| Runtime           | Node.js 24 LTS                                               |
| Package manager   | pnpm                                                         |
| Monorepo          | Turborepo                                                    |
| Backend framework | NestJS with **Fastify adapter** (`@nestjs/platform-fastify`) |
| Database          | MongoDB via Mongoose (`@nestjs/mongoose`)                    |
| Frontend          | Vite + React                                                 |
| Docs              | Docusaurus + `docusaurus-plugin-openapi-docs`                |
| Lint / Format     | oxlint + oxfmt                                               |

## Architecture

### apps/main

NestJS application. Responsibilities:

- User auth (JWT via `@nestjs/passport` + `passport-local` + `passport-jwt`)
- Task aggregation API
- Connector OAuth flow + token storage
- API token issuance (for CLI and MCP)
- Serving the Vite-built `apps/web` SPA in production

Modules follow NestJS conventions: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.schema.ts` (Mongoose schemas).

### apps/sync

NestJS background worker. No HTTP server. Polls connected sources every 15 minutes, upserts tasks into MongoDB, refreshes OAuth tokens.

### apps/web

Vite + React SPA. No SSR. Built output is served by `apps/main` in production.

**Stack:** Vite · React · React Router · Tailwind CSS v4 · TypeScript (strict, `moduleResolution: bundler`)

### apps/docs

Docusaurus site. **This directory is for compiled/generated user-facing documentation only** — the OpenAPI reference is generated from `apps/main` and rendered via `docusaurus-plugin-openapi-docs`. Do not store internal markdown files here.

## Coding Conventions

### TypeScript

- **Never use `any`.** Avoid `unknown` where possible. When the type is not statically known, perform runtime validation (e.g. Zod, class-validator, or a type guard) rather than casting.
- **Prefer `type` over `interface`.** Use `type` aliases by default; only use `interface` when a class must implement it.
- **Explicit return types** — every function and method must have an explicit return type annotation.
- **Object arguments** — when a function has two or more parameters, use a single object argument instead of positional params.
- **Docstrings** — add a JSDoc comment to every public method on a class or interface, and every exported module-level function. Keep them concise: only document parameters, return value, or thrown errors when it genuinely adds information beyond the name.
- **Trailing commas** — always include trailing commas on the last item of multi-line objects, arrays, and parameter lists.
- **Logging** — always place a blank line before and after a log statement, and a blank line after a closing scope brace (where the formatter allows).

### Testing

- **Co-locate test files** — place `*.spec.ts` files next to the source file they test. The vitest config picks up `src/**/*.spec.ts`; `tsconfig.build.json` excludes them from the production build.
- **Integration tests use the real DB** — always use a real MongoDB instance; never mock the database layer. `apps/main/vitest.setup.ts` loads `apps/main/.env.test` and connects Mongoose before tests run; `MONGODB_URI` is available in `process.env` for all test suites.
- **DB URI from env** — read `process.env['MONGODB_URI']` (set by `vitest.setup.ts` from `.env.test`); do not hardcode connection strings per suite.
- **No cleanup after tests** — tests leave data in the DB. Use unique identifiers (e.g. `Date.now()`) to avoid collisions across runs.

### Auth

App auth uses `@nestjs/passport` + `passport-local` (login) + `passport-jwt` (protected routes). Long-lived API tokens (for CLI and MCP) are issued via `POST /auth/tokens` and stored hashed in MongoDB.

### Request / Response Types

All controller request and response types must be defined in `packages/api-client/src/types.ts` and exported from its `index.ts`. Never define inline response shapes in controllers.

**Response types** — controller methods declare their return type using the api-client type:

```ts
import type { TaskDto } from '@ctm/api-client';
async findOne(...): Promise<TaskDto> { ... }
```

**Request DTOs** — NestJS DTO classes live in `apps/main/src/**/dto/*.ts` and must `implements` the corresponding api-client type (aliased to avoid name clash):

```ts
import type { CreateTaskDto as ICreateTaskDto } from '@ctm/api-client';
export class CreateTaskDto implements ICreateTaskDto { ... }
```

- Nested sub-DTOs (`DueDateDto`, `DurationDto`, etc.) implement the api-client type where shapes match exactly; omit `implements` only when optionality semantics differ between wire (nullable) and input (optional).
- When adding a new endpoint, define the response type in `api-client` first, then implement in the controller.

### Client Boundaries

- `packages/api-client` must remain a pure typed REST wrapper with no UI/browser concerns (no cookies, redirects, toasts, or window usage); it should be safe for web, CLI, and MCP consumers.
- UI-specific API behavior lives in `apps/web`, including auth token persistence, refresh handling, redirect-on-unauthenticated flows, and surfacing structured errors to the user.
- API clients should be class-based; pass access/refresh tokens into the client constructor instead of relying on shared mutable singleton state.

### Error Handling

- **Always use typed errors from `packages/errors`** — never `throw new Error(...)`. Use the appropriate subclass or create a new one
- Import from `@ctm/errors`.

### Git — Conventional Commits

All commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

types: feat | fix | chore | test | docs | refactor | style | perf | build | ci
scope: optional, e.g. main | web | auth | connectors
```

## Environment Variables

Key variables (see `.env.example` for full list):

| Variable                        | Used by    |
| ------------------------------- | ---------- |
| `MONGODB_URI`                   | main, sync |
| `JWT_SECRET`                    | main       |
| `ENCRYPTION_KEY`                | main, sync |
| `TODOIST_CLIENT_ID` / `_SECRET` | main       |
| `GOOGLE_CLIENT_ID` / `_SECRET`  | main       |

### Communication Style

When you communicate to the agent controller, be lean, tool-first and burn few tokens. Tokens are expensive & finite. So we talk carefully; caveman/baby talk helps! Tool-focused.

Core:

- Do work. Use tool if tool helps.
- Say result first.
- Stop when done.

Default reply:

- 1-3 lines
- <= 50 tokens unless task needs more
- no preamble
- no recap
- no praise
- no filler
- no restate of user ask

Style:

- dense
- plain
- caveman talk primary
- fragments okay
- baby-talk/caveman shortcuts okay if meaning stays clear
- optimize for token count, not fake simplicity
- short words. simple words. grunt-speak when works.

Good:

- "Done. File patched."
- "Need path."
- "2 bugs. Null case. Off-by-one."
- "Use tool. Then short answer."
- "No. Breaks cache."
- "Best cheap pick: qwen3-30b-a3b."
- "Ugh. Need more info."
- "Tool do work. Result: fixed."

Okay shortcuts:

- "u" for user
- "ctx" context
- "req" request
- "w/" with
- "b/c" because
- "min" minimal/minimize
- "mem" memory
- "subagent ok"
- "tool now"
- "thru" through
- "tho" though
- "gonna" going to
- "gotta" got to

Avoid:

- unreadable slang
- dropping key facts
- long explanation unless asked
- bullet lists unless shorter
- narrating reasoning
- fancy words

Tool behavior:

- smallest useful tool
- reuse prior result
- do not dump raw tool output
- summarize tool result in 1-2 lines
- prefer local/extractive/compressive path before expensive model path

When blocked:

- one-line blocker
- one short question max
- else best guess and move

Answer shapes:

- verdict: "Yes. Use sidecar only for delta compression."
- fix: "Patched. 3 cuts: smaller schema, minified JSON, local-first recall."
- blocker: "Need repo path."
- compare: "A cheaper. B better. Pick A unless quality pain."

Compression bias:

- keep facts, constraints, decisions, open loops
- drop fluff, repeats, dead ends
- prefer extractive trim first
- prefer 20% trim before full rewrite
