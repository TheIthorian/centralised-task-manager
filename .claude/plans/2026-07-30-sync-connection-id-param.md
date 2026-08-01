# Plan: SyncController honours `connectionId`

Spec: `.claude/specs/2026-07-30-sync-connection-id-param-design.md`
Issue: #30
Branch: `fix/sync-connection-id-param`

## 1. Scope the service lookup

`apps/main/src/sync/sync.service.ts`

- `getJob({ userId, jobId, connectionId })`: throw `NotFoundException('Sync job not found')` when
  the job is missing, owned by another user, or carries a different `connectionId`. The existing
  `ForbiddenException` goes, and its import with it.
- `cancelJob({ userId, jobId, connectionId })`: forward `connectionId` to the `getJob` ownership
  check. The atomic `findOneAndUpdate` still keys on `_id` alone, since `getJob` has already proved
  the pair matches.

## 2. Read the parameter in the controller

`apps/main/src/sync/sync.controller.ts`

- `getJob` and `cancelJob` gain
  `@ValidatedParam({ name: 'connectionId', schema: objectIdSchema }) connectionId: string` and pass
  it to the service.

## 3. Extend the startup audit

`apps/main/src/common/validation/audit-handler-inputs.ts`

- Read `PATH_METADATA` from the controller class and from the handler method, join them, and pull
  out every `:name` token (tolerating a trailing `?` and a `(regex)` suffix).
- Collect the parameter names the handler declares: route-arg entries whose source is `@Param`. An
  entry with no `data` reads the whole params object and covers everything.
- Emit one finding per undeclared path parameter.
- Run the check even when the handler declares no arguments at all, so the current early return on
  missing route-arg metadata has to move.
- `@UnvalidatedInput` continues to exempt the whole handler.

## 4. Tests

- `apps/main/src/common/validation/audit-handler-inputs.spec.ts`: undeclared controller-level param
  is flagged; undeclared method-level param is flagged; declared param passes; bare `@Param()`
  passes; multi-segment path with one of two params declared reports exactly one finding; handler
  with no decorated arguments at all on a parameterised route is flagged; `@UnvalidatedInput`
  handler is skipped.
- `apps/main/src/sync/sync.controller.spec.ts`: a job created under connection A returns 404 on
  `GET`/`DELETE` under a different connection id, and still 200/204 under its own. Another user's
  `GET` returns 404 with a body identical to the unknown-job 404, and their `DELETE` returns 404.
- `apps/main/src/sync/sync.service.spec.ts`: update the existing `getJob` call to pass
  `connectionId`.

## 5. Verify

- `pnpm --filter @ctm/main test` (the integration suites boot `AppModule`, so a new audit finding
  anywhere in the app fails startup and is caught here).
- `pnpm lint`, `pnpm format`.
