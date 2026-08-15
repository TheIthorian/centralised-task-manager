# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Meta:** When the user states a new rule or convention, always add it to this file immediately before continuing with any other work.

## Monorepo Overview

Turborepo monorepo managed with **pnpm workspaces**.

```
apps/
  main/             # NestJS REST API + auth server (primary backend)
  web/              # Vite + React SPA (served by apps/main in production)
  admin/            # NestJS operator API — metrics, OAuth clients, audit log (Cloudflare Access)
  admin-web/        # Vite + React SPA — the operator console for apps/admin
  cli/              # Node.js CLI (`ctm`) — task and connector management
  docs/             # Docusaurus site — compiled user-facing docs + OpenAPI reference
                    # (do NOT store internal markdown here)
  storybook/        # Storybook harness for @ctm/ui — dev tool only, never deployed
packages/
  ui/               # Design tokens + presentational React components
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
pnpm turbo run dev --filter=@ctm/docs  # Docs only — regenerates openapi.json first
                                    # (`pnpm --filter @ctm/docs dev` skips Turbo, so the spec goes stale)
pnpm build                          # Build all apps
pnpm lint                           # Run oxlint across workspace
pnpm format                         # Run oxfmt across workspace
pnpm test                           # Run all tests

# Scoped to a single package
pnpm --filter @ctm/main dev
pnpm --filter @ctm/main test
pnpm --filter @ctm/ui test              # Component tests (jsdom + testing-library + axe)
pnpm --filter @ctm/storybook dev        # Storybook on :6006, theme + density toolbars
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
- OAuth 2.1 authorization server (issues tokens to CLI, MCP, and third-party clients)
- Scheduled sync + reminder jobs (`@nestjs/schedule`)

Modules follow NestJS conventions: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.schema.ts` (Mongoose schemas).

### apps/sync

NestJS background worker. No HTTP server. Polls connected sources every 15 minutes, upserts tasks into MongoDB, refreshes OAuth tokens.

### apps/web

Vite + React SPA. No SSR. Deployed to Cloudflare Pages (see `DEPLOYMENT.md`).

**Stack:** Vite · React · React Router · Tailwind CSS v4 · TypeScript (strict, `moduleResolution: bundler`)

### apps/admin and apps/admin-web

The operator surface: a NestJS API and the SPA that drives it. Cloudflare Access authenticates the
operator, so neither app stores a credential or has a login route, and the SPA reaches the API
through a same-origin Pages Function rather than calling it directly. `apps/admin` publishes no
OpenAPI document. See each app's README before changing either.

### packages/ui

Design tokens and presentational components. A component belongs here if it can be described without mentioning the API; `apps/web` keeps routing, queries, URL state and side effects.

- Tokens live in `packages/ui/src/styles/tokens.css` (Quiet Slate, both themes) and are imported by `apps/web/src/index.css` and the Storybook preview.
- Every component ships three co-located files: `Name.tsx`, `Name.spec.tsx`, `Name.stories.tsx`. No story means not finished.
- Specs assert behaviour only — role, accessible name, ARIA state, keyboard, callbacks, plus `expect(await axe(container)).toHaveNoViolations()`. **Never assert Tailwind class strings or DOM snapshots:** those change with every design pass. Token correctness is judged in Storybook.
- `packages/ui` never imports i18next. Copy arrives as props.

### apps/storybook

`@storybook/react-vite` harness that renders `packages/ui`. Stories live next to their component in `packages/ui/src`; this app is only the configuration. It has no `build` script and no deploy target on purpose.

### apps/docs

Docusaurus site. **This directory is for compiled/generated user-facing documentation only** — the OpenAPI reference is generated from `apps/main` and rendered via `docusaurus-plugin-openapi-docs`. Do not store internal markdown files here.

## Coding Conventions

### TypeScript

- **Never use `any`.** Not in source, not in tests, and never with an `eslint-disable` for `no-explicit-any`. Avoid `unknown` where possible. When the type is not statically known, perform runtime validation (e.g. Zod, class-validator, or a type guard) rather than casting. When a cast is genuinely unavoidable (e.g. a third-party plugin type that does not line up), use `as unknown as X` — never `as any`.
- **Prefer `type` over `interface`.** Use `type` aliases by default; only use `interface` when a class must implement it.
- **`enum` for closed sets of values.** Use a TypeScript `enum`, not a `const` array with a derived literal union. Zod reads an enum directly (`z.enum(MyEnum)`), and the import forces the dependency to point at whichever package owns the vocabulary instead of each call site restating the literals.
- **Explicit return types** — every function and method must have an explicit return type annotation.
- **Object arguments** — when a function has two or more parameters, use a single object argument instead of positional params.
- **Docstrings** — add a JSDoc comment to every public method on a class or interface, and every exported module-level function. Keep them concise: only document parameters, return value, or thrown errors when it genuinely adds information beyond the name.
- **Comments explain why, not how.** The code already says what it does. Comment only what the code cannot: the reason for a non-obvious choice, a constraint from outside the file, a trap someone would otherwise reintroduce. Keep it to a line or two — if a comment needs a paragraph, the reasoning belongs in the spec or the commit message. Never write a comment that describes or justifies the change being made; a reader who never saw the diff gains nothing from it. That reasoning goes in the PR description.
- **Declaration order** — a helper function is declared _after_ its caller, so a file reads top-down from its entry point to its details. Function declarations hoist, so a module-level helper can sit at the bottom of the file even when the code above it calls it. Values that are not hoisted (`const`, `let`, classes) still have to precede their use.
- **Trailing commas** — always include trailing commas on the last item of multi-line objects, arrays, and parameter lists.
- **Logging** — always place a blank line before and after a log statement, and a blank line after a closing scope brace (where the formatter allows).

### Testing

- **Co-locate test files** — place `*.spec.ts` files next to the source file they test. The vitest config picks up `src/**/*.spec.ts`; `tsconfig.build.json` excludes them from the production build.
- **Integration tests use the real DB** — always use a real MongoDB instance; never mock the database layer. `apps/main/vitest.setup.ts` loads `apps/main/.env.test` and connects Mongoose before tests run; `MONGODB_URI` is available in `process.env` for all test suites.
- **DB URI from env** — read `process.env['MONGODB_URI']` (set by `vitest.setup.ts` from `.env.test`); do not hardcode connection strings per suite.
- **No cleanup after tests** — tests leave data in the DB. Use unique identifiers (e.g. `Date.now()`) to avoid collisions across runs.

### Auth

App auth uses `@nestjs/passport` + `passport-local` (login) + `passport-jwt` (protected routes). `POST /auth/login` returns an RS256 access token plus a refresh token; refresh tokens are stored hashed in MongoDB (`auth/schemas/refresh-token.schema.ts`) and rotated via `POST /auth/refresh`.

CLI and MCP clients do not use a separate API-token endpoint. `apps/main/src/oauth` runs a full OAuth 2.1 authorization server:

- `POST /.well-known/oauth-client` — dynamic client registration
- `GET`/`POST /oauth/authorize` — consent screen, `code_challenge` (PKCE) required
- `POST /oauth/token` — `authorization_code` grant, returns access + id + refresh tokens
- `GET /oauth/userinfo`
- `GET /.well-known/openid-configuration`, `/oauth-authorization-server`, `/jwks.json`

All access tokens are RS256, signed with the `RSA_PRIVATE_KEY` keypair (`oauth/oauth-key.service.ts`) and verified by the single `JwtStrategy`. Scopes live in `oauth/scopes.ts`; users revoke clients via `DELETE /auth/me/authorized-apps/:clientId`.

### Request / Response Types

All controller request and response types must be defined in `packages/api-client`, in the module for the domain that owns them (`src/domains/<domain>/<domain>.types.ts`, e.g. `src/domains/tasks/tasks.types.ts`), and exported from the package's `index.ts`. `src/types.ts` and `src/client.types.ts` are re-export barrels: add the type to its domain module and re-export it, never define it in a barrel. Never define inline response shapes in controllers.

**Response types** — controller methods return a DTO **class** that `implements` the api-client type, never the bare type alias. Type aliases are erased at runtime, so `@nestjs/swagger` cannot see them and the API reference renders an empty Responses section:

```ts
// apps/main/src/tasks/dto/task-response.dto.ts
import type { TaskDto as ITaskDto } from '@ctm/api-client';
export class TaskDto implements ITaskDto { ... }

// apps/main/src/tasks/tasks.controller.ts
import { TaskDto } from './dto/task-response.dto.js';
async findOne(...): Promise<TaskDto> { ... }
```

`@nestjs/swagger/plugin` derives `@ApiProperty` from the class's TS types during OpenAPI generation, so response fields need no decorators — add one only to override (enums, `Record<string, unknown>`). If a handler carries an explicit `@ApiResponse({ status })`, the plugin leaves it alone: pass `type:` yourself.

**Every handler argument must be validated at runtime, through exactly one mechanism.** A TS type is
erased at compile time, so `@Body() body: SomeType` validates nothing and the value reaches the
handler unchecked. Zod is the only validation library: there is no class-validator in `apps/main`.

Read every argument through a `Validated*` decorator from `common/validation/validated.decorators.ts`,
never through Nest's `@Body`, `@Query`, `@Param` or `@Headers` directly. The schema is named at the
call site, so validation is visible without knowing anything about the DTO:

```ts
async create(
    @Request() req: AuthRequest,
    @ValidatedBody(CreateTaskDto) dto: CreateTaskDto,
): Promise<TaskDto> {
```

- `ValidatedBody(DtoOrSchema)` and `ValidatedQuery(DtoOrSchema)` for whole objects.
- `ValidatedParam({ name, schema })`, `ValidatedQueryValue({ name, schema })` and `ValidatedHeader({ name, schema })` for single values. Use `objectIdSchema` for Mongo ids: an unchecked id becomes a Mongoose CastError, which surfaces as a 500.
- **Objects** — define a Zod schema and wrap it with `createZodDto` (`common/zod/create-zod-dto.ts`, a thin adapter over `nestjs-zod`). `nestjs-zod` derives the OpenAPI schema from the Zod schema, so `scripts/generate-openapi.ts` must keep passing the document through `cleanupOpenApiDoc`.
- **Bound every string.** Give each string a `max`, and each array a `max` length.
- **`requestObject` for app endpoints, `z.object` for protocol endpoints.** `requestObject` rejects unrecognised keys, which app clients only send by mistake, and reads an explicit `null` as an absent key, since a client round-tripping a response back as a request sends null for fields it did not set. Nested objects need their own `requestObject`. OAuth and MCP clients legitimately send parameters this server does not implement, so `oauth/` and `.well-known` DTOs stay on plain `z.object` and strip instead (RFC 7591 §3.1).
- **Ajv, not Zod, for schemas that arrive as data** — connector connection details compile JSON Schema at runtime, which Zod cannot do.
- Never hand a handler argument to a service, a DB query, or an outbound request before it has been through a schema.

This is enforced, not just documented: `HandlerValidationModule` audits every controller's route
metadata on `onApplicationBootstrap` and refuses to start when an argument carries no validation
pipe, so the mistake is a failed deploy rather than an open endpoint. A handler that genuinely
validates its own input by a route the audit cannot see is marked `@UnvalidatedInput(reason)`, and
the reason is required.

**Request DTOs** live in `apps/main/src/**/dto/*.ts`. Export the schema and the DTO class built from
it, and pass the api-client type to `createZodDto` so the schema cannot drift from the wire contract:

```ts
import type { CreateTaskDto as ICreateTaskDto } from '@ctm/api-client';

export const createTaskSchema = z.strictObject({ ... });
export class CreateTaskDto extends createZodDto<ICreateTaskDto>({
    schema: createTaskSchema,
    name: 'CreateTaskDto',
}) {}
```

- Share nested schemas (`dueDateSchema`, `channelPrefsSchema`) rather than nested DTO classes; `nestjs-zod` inlines them into the OpenAPI document.
- When adding a new endpoint, define the response type in `api-client` first, then implement in the controller.

### Client Boundaries

- `packages/api-client` must remain a pure typed REST wrapper with no UI/browser concerns (no cookies, redirects, toasts, or window usage); it should be safe for web, CLI, and MCP consumers.
- UI-specific API behavior lives in `apps/web`: redirect-on-unauthenticated flows, and surfacing structured errors to the user.
- Token refresh belongs to `packages/api-client`, because which endpoint redeems a refresh token is protocol, not presentation. It refreshes an expiring access token before a call and retries a 401 once. Where the rotated pair is stored is the consumer's decision, injected as `persistence.onTokensRefreshed`: the package never touches a keychain, a cookie, or `localStorage`.
- API clients should be class-based; pass access/refresh tokens into the client constructor instead of relying on shared mutable singleton state.

### UI Text and Translations

- All user-visible text in `apps/web` comes from `t('key')` via `react-i18next`. No string literals in JSX, including copy passed as props into `@ctm/ui`.
- Keys live in `apps/web/src/i18n/en.json`, namespaced by surface and named for meaning. English only for now; `fallbackLng` is off so a missing key is a visible bug rather than a rendered key path.
- Counts and dates are interpolated (`t('tasks.openCount', { count })`) and formatted with `Intl`, never assembled by concatenation.

### Data Fetching and Writes

- **No optimistic writes.** TanStack Query offers them via `onMutate` plus rollback; we decline. A mutation posts, `onSuccess` invalidates, and the row re-renders from server data. The moment the client patches its own cache it can show a state the backend never agreed to.
- A row with a write in flight uses `isPending`: dimmed, `aria-disabled`, held in place, never struck through. Undo is a real second call inside the toast window.
- Toasts are only for things the user did. System failures are inline banners, because a toast disappears before it can be acted on.

### Accessibility

- Real interactive elements only, never a click handler on a `div`. Visible 2px accent focus ring everywhere; `outline: none` is never acceptable.
- `aria-label` on icon-only controls, `aria-hidden="true"` on decorative marks, correct ARIA state (`aria-pressed`, `aria-checked`, `aria-current`, `aria-selected`, `aria-disabled`), `aria-live="polite"` on counts and status that change asynchronously.
- WCAG 2.2 AA contrast in both themes. Meaning is never carried by colour alone.
- 44px minimum touch targets below 768px, whatever the density setting says.
- `prefers-reduced-motion` collapses motion to an instant state change.

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

### Pull Requests — What / Why / How

PR descriptions use exactly three headings, in this order, and stay concise:

```markdown
## What

## Why

## How
```

- **What** — the change, in a line or two.
- **Why** — the problem it solves.
- **How** — the approach, and any non-obvious decision or deployment hazard.

No other headings. Keep each section short; the diff carries the detail.

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
