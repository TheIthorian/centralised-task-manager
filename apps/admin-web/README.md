# @ctm/admin-web

Operator console for `@ctm/admin`. Three pages: deployment metrics, OAuth clients, audit log.

## Auth

There is no login route, no auth guard and no token. Cloudflare Access decides whether the document
is served at all, so by the time React runs the operator is already authenticated. "Sign out" is a
link to `/cdn-cgi/access/logout`, because Access owns the session.

## Why the API is proxied

The browser never calls the operator API directly. The Access credential is a cookie on this
hostname, so a cross-origin request to the API would carry no operator identity at all.

Instead `/api/*` goes to a Pages Function on this same origin. That request passes through Access
first, which stamps it with a signed `Cf-Access-Jwt-Assertion`, and the Function forwards it
unchanged to `ADMIN_API_ORIGIN`. The API verifies that signature itself, so the header is a
credential rather than a claim.

The Function refuses a request that arrives without an assertion. That state means the Pages project
is not behind an Access application, and failing closed turns it into one visible error instead of a
console full of 401s.

In development there is no Access, so the Vite proxy does the same rewrite and the API's
`ADMIN_DEV_BYPASS_EMAIL` supplies the operator.

## Design

Tokens and components come from `@ctm/ui`; this app adds only what is specific to an operator
console. Copy is `t('key')` from `src/i18n/en.json`, with `fallbackLng` off so a missing key is a
visible bug.

Reads that fail render an inline banner with a retry, next to the thing that is missing. Toasts are
only for something the operator did. There are no optimistic writes: a mutation posts, invalidates,
and the list re-renders from server data.

No charts. Totals are what the dashboard shows; trends belong in a product analytics tool.

## Running it

```bash
cp .env.example .env        # ADMIN_API_ORIGIN, the origin of apps/admin
pnpm --filter @ctm/admin-web dev
```

Serves on :5174, because `apps/web` holds :5173 and `pnpm dev` starts both.

## Tests

```bash
pnpm --filter @ctm/admin-web test
```

Page specs render against a stub client through `src/test-utils.tsx`. The proxy spec runs in the
node environment, because Workers matches undici rather than jsdom.
