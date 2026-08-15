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
