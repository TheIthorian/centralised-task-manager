# tokens

Everything about the tokens `apps/main` issues: how they are signed, what they claim, how long they live, and how a refresh token is redeemed.

`auth` and `oauth` decide _who_ gets a token; neither mints its own. A claim added here appears on every token the server issues, rather than on whichever half of the codebase remembered to add it.

## Responsibilities

- **`AccessTokenService`** — signs access tokens and OIDC id tokens. Every access token carries `sub`, `email`, `iss`, `aud` and `client_id`; a first-party session records `first-party` as the client.
- **`RefreshTokenService`** — issues, redeems, and revokes opaque `rt_<hex>` tokens, stored as SHA-256 hashes. The `grant` is part of every lookup, so a token issued by one flow is not found at the other flow's endpoint.
- **`JwtStrategy`** and **`JwtAuthGuard`** — the single verification path for every protected route.

## Token lifetimes

| Token            | Config var                     |
| ---------------- | ------------------------------ |
| JWT access token | `JWT_ACCESS_EXPIRES` (seconds) |
| Refresh token    | `REFRESH_TOKEN_EXPIRES_DAYS`   |

Both are required environment variables: an unset one fails the boot rather than picking a lifetime of its own.
