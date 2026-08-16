# @ctm/admin

Operator surface for the people running the deployment. Not for end users.

Runs on its own origin, against the same MongoDB as `apps/main`, reading its collection shapes from
`@ctm/db`.

## Auth

Cloudflare Access authenticates the operator. This app stores no credential and has no login route:
it verifies the RS256 token Access signs, against the team's JWKS, checking issuer, audience and
expiry. The verified `email` claim becomes the audit log's actor.

`CF_ACCESS_AUD` is not optional. Every Access application in a team is signed by the same keys, so
without an audience check a token minted for any other application in the team would verify here.

`AdminGuard` is registered globally and has no `@Public()` escape hatch: nothing on an operator
surface should be reachable without an identity.

> **Deployment requirement:** this app must only ever be reachable through Access. If its origin is
> exposed directly, the `Cf-Access-Jwt-Assertion` header is the only thing in front of it, and a
> header is trivial to forge. Put it behind an Access application and restrict the origin to
> Cloudflare.

For local development there is no Access in front of a laptop, so `ADMIN_DEV_BYPASS_EMAIL` treats
every request as that operator. The env schema refuses to start when it is set and
`NODE_ENV=production`.

## Database connection

The connection is opened on the first request and closed again `MONGODB_IDLE_TIMEOUT_MS` after the
last one finishes, rather than held for the process lifetime.

This is about the driver's topology monitor, not the pool. It keeps a socket to every replica-set
member and sends `hello` on each every `heartbeatFrequencyMS`, so an open connection is constant
network traffic and the container never looks idle to the platform. Raising the heartbeat interval
or emptying the pool thins that traffic but never stops it: monitors are separate from the pool and
outlive it. Scale-to-zero needs silence.

`DatabaseModule` therefore provides a connection built with no URI, which is inert, instead of using
`MongooseModule.forRoot`. Nothing during bootstrap touches the database, so nothing waits on it.
`DatabaseConnectionInterceptor` opens the connection before a handler runs and releases it when the
response completes. Nest runs guards first, so an unauthenticated request is rejected by `AdminGuard`
without ever waking the database.

The trade is a cold start on the first request after an idle period, which for an internal tool used
occasionally by one operator is cheaper than an always-on container.

## No OpenAPI

This app publishes no OpenAPI document and is absent from `apps/docs`. Its only client is the admin
SPA in this repo, which imports the response types from `@ctm/api-client` directly.

So the rule in `CLAUDE.md` about controllers returning a DTO **class** does not apply here — that
rule exists because `@nestjs/swagger` cannot see an erased type alias. Controllers return the
`@ctm/api-client` type. Request DTOs still go through `createZodDto`, which Nest needs for parameter
metatypes regardless.

## Metrics

`GET /metrics` returns counts across the deployment: accounts and how many are recent, tasks by
status and by source, connectors with a separate count of those whose last sync recorded an error,
and sync health derived from job status over the trailing 24 hours.

Totals only, deliberately: time series belong in a product analytics tool rather than in aggregations
this app maintains.

Nothing is cached. `generatedAt` is request time, and the aggregations scan the window each call.
That is fine at this size; if it stops being fine, cache here rather than in the SPA.

Reads are not written to the audit log. The log records what an operator changed, and a dashboard
that logs every page view buries the entries that matter.

## OAuth clients

`GET /oauth-clients` lists registered clients, filterable by `search` or `isDynamic`. `POST`,
`PATCH /:clientId` and `DELETE /:clientId` create, configure and revoke them, so a client can be set
up from the UI instead of through RFC 7591 dynamic registration.
`GET /oauth-clients/available-scopes` returns the scope registry for the editor.

**Clients seeded from code are read-only here.** `isDynamic: false` is set only by
`FirstPartyClientsService` in `apps/main`, which re-applies its definition on every boot. A write
from the admin API would be reverted by the next deploy, and the client would be broken until then,
so the write is refused with a 409 rather than silently undone later. They are still listed, since
the operator needs to see that `ctm-cli` exists and when it was last used.

Scopes are validated against `SCOPE_REGISTRY` in `@ctm/db`, so a client cannot be granted a scope
the authorization server does not implement.

## Audit log

Every operator action is recorded, append-only, in the `auditlogs` collection. There is no update
or delete path: an operator surface whose record of what the operator did can be edited by the
operator records nothing.

Entries denormalise the target's id and label, because the log has to stay readable after the
account it describes is purged.

`GET /audit-log` reads it newest-first, filterable by action or target.

## Running it

```bash
cp .env.example .env        # then fill in CF_ACCESS_AUD, or set ADMIN_DEV_BYPASS_EMAIL
pnpm --filter @ctm/admin dev
```

## Tests

```bash
pnpm --filter @ctm/admin test
```

The Access specs stub only the JWKS network fetch; signature, issuer, audience and expiry checks
run for real against a locally generated key. Other specs use a real MongoDB at `MONGODB_URI` (see
`.env.test`) and leave their data behind, so give fixtures unique identifiers.
