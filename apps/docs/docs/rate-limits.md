---
id: rate-limits
title: Rate limits
sidebar_position: 7
---

# Rate limits

The API is rate limited to keep one misbehaving client from degrading the service for
everyone. The limits are set for fair use — normal interactive use, CLI use and MCP use
stay well inside them.

## Request limits

There are two windows, and both must have budget left for a request to be served:

| Window    | Setting                         | Default |
| --------- | ------------------------------- | ------- |
| Burst     | `RATE_LIMIT_BURST_PER_MINUTE`   | 400     |
| Sustained | `RATE_LIMIT_SUSTAINED_PER_HOUR` | 8000    |

One budget covers your whole account: the web app, the CLI, MCP and direct API calls all
draw on it, and extra API tokens do not buy more.

## Per-client fence

Under the account ceiling, each app you have authorised gets its own smaller allowance
(`RATE_LIMIT_CLIENT_BURST_PER_MINUTE`, default 240, and `RATE_LIMIT_CLIENT_SUSTAINED_PER_HOUR`,
default 4000). This is not extra quota — the account limits still apply on top. It exists so
a busy script cannot spend your whole budget and lock your browser session out; the noisy
client gets the `429` and everything else keeps working.

A response rejected by this layer says `This client is sending too many requests`, rather
than the account-level message.

## Stricter limits on the sign-in surface

`POST /auth/register`, `POST /auth/login` and `POST /oauth/token` get a tighter budget of
their own (`RATE_LIMIT_STRICT_BURST_PER_MINUTE`, default 40, and
`RATE_LIMIT_STRICT_SUSTAINED_PER_HOUR`, default 400), counted separately for each endpoint.

## Token refresh

`POST /auth/refresh` has its own separate budget (`RATE_LIMIT_REFRESH_BURST_PER_MINUTE`,
default 120, and `RATE_LIMIT_REFRESH_SUSTAINED_PER_HOUR`, default 2400). Refreshes are paced
by expiring access tokens rather than by anything you do, so they neither spend your request
budget nor compete with sign-in attempts.

## Account lockout

After `LOGIN_MAX_FAILED_ATTEMPTS` (default 5) consecutive failed logins, an account is locked for
`LOGIN_LOCKOUT_MINUTES` (default 15). During the lockout every login attempt is rejected with `429`,
including one with the correct password. The counter resets on a successful login.

## Response headers

Every response carries the state of the burst window, and the sustained window is reported
alongside it with a `-sustained` suffix:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 98
X-RateLimit-Reset: 41
X-RateLimit-Limit-sustained: 2000
X-RateLimit-Remaining-sustained: 1934
X-RateLimit-Limit-client: 60
X-RateLimit-Remaining-client: 58
```

The `-client` pair reports the calling app's own allowance.

`X-RateLimit-Reset` is the number of seconds until the window rolls over.

## Handling a 429

A throttled request returns `429 Too Many Requests` with a `Retry-After` header and a body of:

```json
{
    "statusCode": 429,
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Slow down and retry later."
}
```

Wait for `Retry-After` seconds before retrying, and back off rather than retrying in a
tight loop. The `@ctm/api-client` package exposes this directly:

```ts
try {
    await client.listTasks({});
} catch (error) {
    if (error instanceof ApiClientError && error.isRateLimited) {
        await sleep((error.retryAfterSeconds ?? 60) * 1000);
    }
}
```

## Account caps

| Cap                         | Limit |
| --------------------------- | ----- |
| Accounts per connector type | 5     |
| Tasks stored                | 10000 |

Connecting an additional account beyond the connector cap returns `403` with code
`QUOTA_EXCEEDED`; re-authorising an account you have already connected is always allowed.
Creating a task beyond the task cap returns the same error. A sync that would push you over
the task cap stops inserting new tasks rather than failing, so tasks already stored keep
syncing; the job reports how many were left out in `droppedOverQuota`, and the app shows
that on the connection once the sync finishes.
