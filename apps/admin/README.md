# @ctm/admin

Operator surface for the people running the deployment. Not for end users.

Runs on its own origin, against the same MongoDB as `apps/main`, reading its collection shapes from
`@ctm/db`. Its only client is `apps/admin-web`.

## Running it

```bash
cp .env.example .env        # then set ADMIN_DEV_BYPASS_EMAIL
pnpm --filter @ctm/admin dev
pnpm --filter @ctm/admin test
```

The Access specs stub only the JWKS network fetch; signature, issuer, audience and expiry checks run
for real against a locally generated key. Other specs use a real MongoDB at `MONGODB_URI` (see
`.env.test`) and leave their data behind, so give fixtures unique identifiers.

## Endpoints

| Route                                           | What it does                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /metrics`                                  | Deployment totals: accounts, tasks by status and source, connectors, sync health |
| `GET /audit-log`                                | The audit log, newest first, filterable by action or target                      |
| `GET /oauth-clients`, `/:clientId`              | Registered OAuth clients, filterable by `search` or `isDynamic`                  |
| `POST`, `PATCH /:clientId`, `DELETE /:clientId` | Create, configure and revoke a client without RFC 7591 registration              |
| `GET /oauth-clients/available-scopes`           | The scope registry, for the client editor                                        |
| `GET /auth/me`                                  | The operator Access identified                                                   |

Clients seeded from code (`isDynamic: false`) are listed but not editable: a write here would be
reverted by the next deploy of `apps/main`.

## Auth

Cloudflare Access authenticates the operator. This app stores no credential and has no login route:
it verifies the RS256 token Access signs, against the team's JWKS. The verified `email` claim becomes
the audit log's actor. `AdminGuard` is registered globally and has no `@Public()` escape hatch.

Setting up the Access application, and the deployment requirement that this app is only ever reached
through it, are in [`DEPLOYMENT.md`](../../DEPLOYMENT.md).

There is no Access in front of a laptop, so `ADMIN_DEV_BYPASS_EMAIL` treats every request as that
operator. The env schema refuses to start when it is set and `NODE_ENV=production`.

## Database connection

The connection is opened on the first request that needs it and closed again
`MONGODB_IDLE_TIMEOUT_MS` after the last one finishes, so an idle container is network-silent and
the platform can sleep it. The cost is a cold start after an idle period.

## Metrics

Totals only, deliberately: time series belong in a product analytics tool rather than in aggregations
this app maintains. Nothing is cached, and the aggregations scan the window on every call. That is
fine at this size; if it stops being fine, cache here rather than in the SPA.

Reads are not written to the audit log. The log records what an operator changed, and a dashboard
that logs every page view buries the entries that matter.

## Audit log

Append-only, in the `auditlogs` collection, with no update or delete path. Entries denormalise the
target's id and label, because the log has to stay readable after the account it describes is purged.

## No OpenAPI

This app publishes no OpenAPI document and is absent from `apps/docs`, so the rule in `CLAUDE.md`
about controllers returning a DTO **class** does not apply here — that rule exists because
`@nestjs/swagger` cannot see an erased type alias. Controllers return the `@ctm/api-client` type.
Request DTOs still go through `createZodDto`, which Nest needs for parameter metatypes regardless.
