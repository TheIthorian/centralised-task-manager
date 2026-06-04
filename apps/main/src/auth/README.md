# auth

User authentication module for `apps/main`.

## Responsibilities

- **Registration / login** — issues short-lived JWT access tokens and long-lived opaque refresh tokens so clients don't need to re-authenticate on every request.
- **Token rotation** — refresh tokens are single-use and hashed at rest so a stolen token can't be replayed after it's been consumed.
- **Long-lived API tokens** — CLI and MCP consumers need tokens that survive process restarts; these are issued separately and never expire.
- **OAuth clients** — the MCP app authenticates users via an OAuth 2.0 flow; client registration lives here so the OAuth module can look up redirect URIs and scopes.

## Token lifetimes

| Token            | Default lifetime | Config var                   |
| ---------------- | ---------------- | ---------------------------- |
| JWT access token | 120 s            | `JWT_ACCESS_EXPIRES` (seconds) |
| Refresh token    | 30 days          | `REFRESH_TOKEN_EXPIRES_DAYS` |
| API token        | Never expires    | —                            |
