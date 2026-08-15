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

`GET /metrics/growth?days=30` returns new users and tasks per calendar day (UTC), oldest first. Days
with no activity are present with zeroes rather than omitted — a chart that closes the gap implies
activity that did not happen.

Nothing is cached. `generatedAt` is request time, and the aggregations scan the window each call.
That is fine at this size; if it stops being fine, cache here rather than in the SPA.

Reads are not written to the audit log. The log records what an operator changed, and a dashboard
that logs every page view buries the entries that matter.

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
