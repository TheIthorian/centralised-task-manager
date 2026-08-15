# @ctm/admin

Operator surface for the people running the deployment. Not for end users.

Runs on its own origin, against the same MongoDB as `apps/main`, reading its collection shapes from
`@ctm/db`.

## Auth

One operator, so one credential: `ADMIN_USERNAME` and a bcrypt `ADMIN_PASSWORD_HASH`.
`POST /auth/login` checks it and sets a short-lived httpOnly, `SameSite=Strict` session cookie
signed with `ADMIN_JWT_SECRET`.

`apps/main` never learns `ADMIN_JWT_SECRET` and this app never learns main's signing key, so an
admin session is not a bearer token for the task API and an app token cannot reach this surface.

`AdminGuard` is registered globally: a new endpoint is closed by default, and opening one takes the
deliberate act of marking it `@Public()`. Only the login and logout routes are public.

Repeated failures lock the credential out for `ADMIN_LOCKOUT_MINUTES`, counted in the shared
`LoginAttempt` collection under an `admin:` key so it cannot collide with an app user.

## Audit log

Every operator action is recorded, append-only, in the `auditlogs` collection. There is no update
or delete path: an operator surface whose record of what the operator did can be edited by the
operator records nothing.

Entries denormalise the target's id and label, because the log has to stay readable after the
account it describes is purged.

`GET /audit-log` reads it newest-first, filterable by action or target.

## Running it

```bash
cp .env.example .env        # then fill in ADMIN_PASSWORD_HASH and ADMIN_JWT_SECRET
pnpm --filter @ctm/admin dev
```

## Tests

```bash
pnpm --filter @ctm/admin test
```

Specs run against a real MongoDB at `MONGODB_URI` (see `.env.test`) and leave their data behind, so
give fixtures unique identifiers.
