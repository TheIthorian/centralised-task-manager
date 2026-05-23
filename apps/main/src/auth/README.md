# auth

User authentication module for `apps/main`.

## Responsibilities

- **Registration / login** — `AuthService.register` hashes the password and issues a `TokenPair` (JWT access token + opaque refresh token).
- **Token refresh** — `AuthService.refreshTokens` validates the hashed refresh token, deletes it (rotation), and issues a new pair.
- **Logout** — `AuthService.revokeAllRefreshTokens` purges all refresh tokens for a user (logs out all devices).
- **Long-lived API tokens** — `ApiTokenService` issues SHA-256-hashed tokens for CLI and MCP consumers (`POST /auth/tokens`).
- **OAuth clients** — `OAuthClientService` registers and retrieves OAuth 2.0 clients (used by the MCP OAuth flow).

## Strategies & Guards

| File | Purpose |
|------|---------|
| `strategies/local.strategy.ts` | Passport local strategy — validates email + password on login |
| `strategies/jwt.strategy.ts` | Passport JWT strategy — validates Bearer token on protected routes |
| `guards/jwt-auth.guard.ts` | Standard JWT guard |
| `guards/combined-auth.guard.ts` | Accepts either a JWT or a hashed API token |

## Schemas

| Schema | Collection |
|--------|-----------|
| `RefreshToken` | `refreshtokens` — hashed refresh tokens with expiry |
| `ApiToken` | `apitokens` — hashed long-lived tokens |
| `OAuthClient` | `oauthclients` — registered OAuth 2.0 clients |

## Token lifetimes

| Token | Default lifetime | Config var |
|-------|-----------------|-----------|
| JWT access token | 15 min | `JWT_ACCESS_EXPIRES` |
| Refresh token | 30 days | `REFRESH_TOKEN_EXPIRES_DAYS` |
| API token | Never expires | — |
