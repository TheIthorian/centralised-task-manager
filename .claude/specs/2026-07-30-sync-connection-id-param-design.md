# SyncController honours `connectionId`

Issue: #30

## Problem

`SyncController` is mounted at `connectors/connections/:connectionId/sync`. `getJob` and `cancelJob`
never read `connectionId`, so:

- `GET /connectors/connections/<any-objectid>/sync/<jobId>` returns the job regardless of which
  connection the job actually belongs to. Two URLs address one resource and a 200 tells the caller
  nothing about whether it asked the right question.
- `redocly lint` reports `path-parameters-defined` on both operations, because the path template
  declares `{connectionId}` and neither operation declares a parameter for it.

This is not an authorization hole: `SyncService.getJob` compares `job.userId` with the caller, so
another user's job is still refused.

The startup audit in `HandlerValidationModule` cannot see the mistake. It walks the arguments a
handler declares, so a path parameter the handler never declares is invisible to it.

## Design

### Scope the lookup

`SyncService.getJob` takes `connectionId` alongside `userId` and `jobId`. The job is fetched by id,
and a 404 with one message covers all three misses: no such job, a job owned by another user, and a
job that sits on another connection.

A single status is the point. A 403 on someone else's job confirms that the id exists, which is a
job count and a job id an unrelated account can enumerate. The caller is authenticated either way,
so nothing legitimate can tell the three cases apart, and the response body is byte-identical.

`cancelJob` takes the same argument and delegates its check to `getJob`, as it already does.

`SyncController.getJob` and `cancelJob` read `connectionId` through
`ValidatedParam({ name: 'connectionId', schema: objectIdSchema })` and pass it down.

### Close the audit blind spot

`auditHandlerInputs` gains a second check: every `:param` in a handler's full route path
(controller path plus method path) must be declared by that handler. A handler that reads the whole
params object (`@Param()` with no name) covers every parameter, and `@UnvalidatedInput` still
exempts a handler entirely.

Unread path parameters are a validation problem in the same sense the existing findings are: the
value reaches the application through route matching, is part of the resource identity, and
nothing checks it. Reporting it at boot makes the OpenAPI document valid by construction.

## Out of scope

The other `path-parameters-defined` errors `redocly lint` reports, if any remain, and the rest of
the 22 lint errors.
