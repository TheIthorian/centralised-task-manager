# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An operator surface (`apps/admin`) with admin roles, reversible account deletion, site metrics, and OAuth client management, backed by an audit log.

**Architecture:** Mongoose schemas move out of `apps/main/src/**/schemas` into a new `packages/db` so a second backend can own its own connection to the same MongoDB. `apps/admin` is a NestJS backend serving a React SPA on its own origin, issuing its own admin-only tokens that `apps/main` does not accept.

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
└── refactor/auth-oauth-boundary   PR #86 (not ours)
    └── feat/db-package             Phase 1
        └── feat/admin-roles-audit  Phase 2
            └── ...                 Phases 3-6
```

Phase 1 is based on `refactor/auth-oauth-boundary` rather than `main` because that PR moves
`oauth-client`, `authorized-client` and `refresh-token` schemas into `oauth/` and `tokens/` — the
same files Phase 1 relocates into `packages/db`. Rebase the stack if #86 is force-pushed.

---

## File Structure

### New package: `packages/db`

| File                                                   | Responsibility                       |
| ------------------------------------------------------ | ------------------------------------ |
| `src/schemas/user.schema.ts`                           | moved + `deletedAt`                  |
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

### New app: `apps/admin`

Every admin endpoint lives here, not in `apps/main`. Backend `src/` mirrors `apps/main`
conventions; frontend `web/` mirrors `apps/web`.

| File                                    | Responsibility                                       |
| --------------------------------------- | ---------------------------------------------------- |
| `src/auth/admin-jwt.strategy.ts`        | verifies `aud: ctm-admin` against the admin keypair  |
| `src/auth/admin.guard.ts`               | rejects a user whose `role` is not `UserRole.Admin`  |
| `src/users/admin-users.controller.ts`   | list / grant / revoke / soft-delete / restore        |
| `src/metrics/admin-metrics.controller.ts` | aggregate site data                                |
| `src/clients/admin-clients.controller.ts` | OAuth client CRUD                                  |
| `src/audit/audit.controller.ts`         | audit log read                                       |
| `src/audit/audit.service.ts`            | append-only writer                                   |

### `apps/main` additions

Only what the shared data model forces: `users.service.ts` filters soft-deleted users out of every
lookup, and the account-deletion endpoint becomes a soft delete.

### Admin auth

A single operator, so a single credential: `ADMIN_USERNAME` and a bcrypt `ADMIN_PASSWORD_HASH` in
the environment. `POST /admin/auth/login` checks them and sets a short-lived httpOnly session
cookie signed with `ADMIN_JWT_SECRET` (HS256, `aud: ctm-admin`); `AdminGuard` covers every other
route.

There is no admin role on the user document and no grant/revoke: who the operator is, is an
environment decision, not data. That removes "admins managing other admins" from #82's scope.

`apps/main` never learns `ADMIN_JWT_SECRET`, so an admin session is not a bearer token for the task
API, and an app token cannot reach the operator surface.

Repeated failures lock the credential out for a window, reusing the `LoginAttempt` collection
rather than inventing a second mechanism.

---

## Phases

Each phase is independently landable and leaves the repo green.

### Phase 1 — `packages/db` extraction

Move the 13 Mongoose schemas, add the barrel, rewrite the 59 import sites in `apps/main`, delete the
old `schemas/` directories. `config/env.schema.ts` is a Zod env schema, not Mongoose, and stays in
`apps/main`. No behaviour change: `pnpm test` green before and after at 17 tasks / 522 `@ctm/main`
tests.

### Phase 2 — `apps/admin` backend, audit log

`AuditLog` schema and `AuditAction` enum in `packages/db`. A NestJS app with the login route,
`AdminGuard`, the audit writer, and a read endpoint over the log. No user-facing capability yet,
so the phase lands as a gated but empty operator API.

### Phase 3 — reversible account deletion

`deletedAt` on the user document, `users.delete` becomes a soft delete with a retention window,
a restore path, a reaper that hard-deletes past retention, and every existing query filtered to
exclude soft-deleted users.

### Phase 4 — site metrics

Aggregate counts (users, tasks, connectors), sync health, growth buckets over time.

### Phase 5 — OAuth client management

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
