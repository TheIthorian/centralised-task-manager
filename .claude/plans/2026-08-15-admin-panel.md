# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An operator surface (`apps/admin`) with site metrics and OAuth client management, backed by an audit log. Reversible account deletion is deferred: see Phase 3.

**Status:** Phases 1, 1b and 2 are open as PRs #87, #88 and #89. Phases 3-6 are not started.

**Architecture:** Mongoose schemas move out of `apps/main/src/**/schemas` into a new `packages/db`, and the shared Nest request-validation helpers into `packages/nest-common`, so a second backend can own its own connection to the same MongoDB. `apps/admin` is a NestJS backend serving a React SPA on its own origin, behind Cloudflare Access.

**Tech Stack:** NestJS (Fastify), Mongoose, Zod + `nestjs-zod`, Vite + React, Tailwind v4, `@ctm/ui`, vitest.

**Spec:** GitHub issue #82 (no separate spec doc; this plan is the design record).

## Global Constraints

- Never `any`. `as unknown as X` only when genuinely unavoidable.
- `type` over `interface`; `enum` for closed sets of values.
- Explicit return types on every function and method.
- Single object argument when a function takes two or more parameters.
- JSDoc on every public method and exported module-level function.
- Helpers declared _after_ their caller.
- Trailing commas on multi-line literals; blank line around every log statement.
- Typed errors from `@ctm/errors`; never `throw new Error`.
- Every handler argument validated via a `Validated*` decorator; `requestObject` for app endpoints, `z.object` for protocol endpoints. Every string gets a `max`, every array a `max` length.
- Controller methods return a DTO **class** that `implements` the `@ctm/api-client` type.
- Request/response types defined in `packages/api-client` under `src/domains/<domain>/`, re-exported from `index.ts`.
- Tests co-located as `*.spec.ts`, real MongoDB via `process.env['MONGODB_URI']`, no cleanup, unique ids via `Date.now()`.
- All `apps/admin` user-visible text via `t('key')`; keys in `apps/admin/src/i18n/en.json`.
- Every `packages/ui` component ships `Name.tsx`, `Name.spec.tsx`, `Name.stories.tsx`.
- Conventional Commits. PR body = What / Why / How only.

---

## Branch Stack

Each phase is its own PR, branched off the phase before it, so review is incremental and no phase
waits on a merge.

```
main
└── refactor/auth-oauth-boundary    PR #86 (not ours)
    └── feat/db-package             Phase 1
        └── feat/nest-common        Phase 1b
            └── feat/admin-backend  Phase 2
                └── ...             Phases 3-6
```

Phase 1 is based on `refactor/auth-oauth-boundary` rather than `main` because that PR moves
`oauth-client`, `authorized-client` and `refresh-token` schemas into `oauth/` and `tokens/` — the
same files Phase 1 relocates into `packages/db`. Rebase the stack if #86 is force-pushed.

---

## File Structure

### New package: `packages/db`

| File                                                   | Responsibility                       |
| ------------------------------------------------------ | ------------------------------------ |
| `src/schemas/user.schema.ts`                           | moved verbatim                       |
| `src/schemas/task.schema.ts`                           | moved verbatim                       |
| `src/schemas/connector-config.schema.ts`               | moved verbatim                       |
| `src/schemas/notification.schema.ts`                   | moved verbatim                       |
| `src/schemas/stored-file.schema.ts`                    | moved verbatim                       |
| `src/schemas/job.schema.ts`, `task-sync-job.schema.ts` | moved verbatim                       |
| `src/schemas/export.schema.ts`                         | moved verbatim                       |
| `src/schemas/login-attempt.schema.ts`                  | moved verbatim                       |
| `src/schemas/oauth-client.schema.ts`                   | moved + `isFirstParty`, `disabledAt` |
| `src/schemas/authorized-client.schema.ts`              | moved verbatim                       |
| `src/schemas/refresh-token.schema.ts`                  | moved verbatim                       |
| `src/schemas/audit-log.schema.ts`                      | **new**                              |
| `src/audit.ts`                                         | `AuditAction` enum                   |
| `src/index.ts`                                         | barrel                               |

### New package: `packages/nest-common`

The `Validated*` decorators, `createZodDto`, the shared param schemas, `HandlerValidationModule`
and `AppErrorFilter`, extracted from `apps/main/src/common` so both Nest apps validate handler
input the same way rather than drifting apart in two copies. `AppErrorFilter` takes its logger
through `APP_LOGGER` instead of importing one, since the root logger is built from the environment
of whichever app installs it.

### New app: `apps/admin`

Every admin endpoint lives here, not in `apps/main`. Backend `src/` mirrors `apps/main`
conventions; frontend `web/` mirrors `apps/web`.

| File                                      | Responsibility                                    |
| ----------------------------------------- | ------------------------------------------------- |
| `src/auth/access-verifier.service.ts`     | verifies the Cloudflare Access token against JWKS |
| `src/auth/admin.guard.ts`                 | rejects any request Access did not vouch for      |
| `src/users/admin-users.controller.ts`     | list (deletion deferred, see Phase 3)             |
| `src/metrics/admin-metrics.controller.ts` | aggregate site data                               |
| `src/clients/admin-clients.controller.ts` | OAuth client CRUD                                 |
| `src/audit/audit.controller.ts`           | audit log read                                    |
| `src/audit/audit.service.ts`              | append-only writer                                |

### `apps/main` additions

None, beyond the two extractions. Phases 1 and 1b move code out of it; nothing in the admin feature
adds behaviour to it, now that reversible deletion is deferred.

### Admin auth

Cloudflare Access authenticates the operator. This app stores no credential and has no login route:
it verifies the RS256 token Access signs against the team's JWKS, checking issuer, audience and
expiry, and takes the operator's identity from the verified `email` claim.

`CF_ACCESS_AUD` is required. Every Access application in a team shares the team's signing keys, so
without an audience check a token minted for any other application would verify here.

There is no admin role on the user document and no grant/revoke: who the operator is, is Access's
allowlist, not data. That removes "admins managing other admins" from #82's scope.

The guard is global with no `@Public()` escape hatch. Nothing on an operator surface should be
reachable without an identity.

**Deployment requirement:** the app must only ever be reachable through Access. Expose the origin
directly and the `Cf-Access-Jwt-Assertion` header is the only thing in front of it, which is
trivially forged. `ADMIN_DEV_BYPASS_EMAIL` covers local development and the env schema forbids it
when `NODE_ENV=production`.

---

## Phases

Each phase is independently landable and leaves the repo green.

### Phase 1 — `packages/db` extraction

Move the 13 Mongoose schemas, add the barrel, rewrite the 59 import sites in `apps/main`, delete the
old `schemas/` directories. `config/env.schema.ts` is a Zod env schema, not Mongoose, and stays in
`apps/main`. No behaviour change: `pnpm test` green before and after at 17 tasks / 522 `@ctm/main`
tests.

### Phase 1b — `packages/nest-common` extraction

Move the request-validation helpers and the error filter out of `apps/main/src/common`. No
behaviour change beyond the filter's logger arriving by injection.

### Phase 2 — `apps/admin` backend, audit log

`AuditLog` schema and `AuditAction` enum in `packages/db`. A NestJS app with the Access verifier,
the global `AdminGuard`, the audit writer, and a read endpoint over the log. No operator capability
yet, so the phase lands as a gated but nearly empty API.

### Phase 3 — reversible account deletion (deferred)

**Not started, and deliberately not decided here.** Soft deletion is not a user-account question:
tasks, connector configs and exports each face the same choice, and answering it once inside an
admin PR would set a precedent for all of them by accident. It needs its own design pass covering
where the filter lives, what the retention window is per resource, and what a reaper does about
rows whose owner is itself soft-deleted.

Until then `apps/main` keeps its hard `users.delete`, and the admin app offers no deletion.

### Phase 4 — site metrics (not started)

Aggregate counts (users, tasks, connectors), sync health, growth buckets over time. Read-only, so
it does not wait on the soft-delete decision.

### Phase 5 — OAuth client management (not started)

Admin CRUD over `OAuthClient`, with first-party clients seeded from code marked `isFirstParty`
and rejected by every write path.

### Phase 6 — admin SPA

NestJS backend + React SPA, separate origin, admin-only token audience.

---

## Phase 1 Tasks

### Task 1: Scaffold `packages/db`

**Files:**

- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/tsconfig.build.json`, `packages/db/src/index.ts`

**Interfaces:**

- Produces: package name `@ctm/db`, exporting from `src/index.ts`.

- [ ] **Step 1: Create the package manifest**

Mirror `packages/errors/package.json`, pinning versions exactly (no `^`), with `mongoose` and
`@nestjs/mongoose` as peer dependencies so the app owns the singleton.

- [ ] **Step 2: Add it to the workspace and install**

Run: `pnpm install`
Expected: `@ctm/db` resolves from `apps/main`.

- [ ] **Step 3: Commit**

```bash
git add packages/db
git commit -m "build(db): scaffold the shared schema package"
```

### Task 2: Move the schemas

**Files:**

- Create: `packages/db/src/schemas/*.schema.ts` (14 files)
- Delete: `apps/main/src/**/schemas/*.schema.ts`
- Modify: 57 import sites in `apps/main/src`

- [ ] **Step 1: Move the files with `git mv` so history follows**

- [ ] **Step 2: Rewrite the imports to `@ctm/db`**

- [ ] **Step 3: Run the full suite**

Run: `pnpm test`
Expected: PASS, same test count as the pre-move baseline (17 tasks).

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(db): move mongoose schemas into @ctm/db"
```

---

## Phases 2-6 Tasks

Not yet written. Each phase gets its task breakdown once the phase before it has landed and its
real interfaces are known, rather than guessed here.
