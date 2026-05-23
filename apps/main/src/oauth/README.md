# oauth

OAuth 2.0 authorization server module for `apps/main`.

## Responsibilities

Implements a minimal OAuth 2.0 authorization code flow with PKCE, used by the MCP app to obtain tokens on behalf of users.

- **Authorization endpoint** — `GET /oauth/authorize` renders a login/consent page; on success calls `OAuthService.createAuthCode` to store a short-lived (5 min) code with the PKCE code challenge.
- **Token endpoint** — `POST /oauth/token` exchanges the code for `access_token + id_token + refresh_token` after verifying PKCE (`SHA-256(code_verifier) == code_challenge`).
- **Refresh** — `POST /oauth/token` with `grant_type=refresh_token` rotates the refresh token.
- **RSA signing** — tokens are signed with the RSA private key (`RSA_PRIVATE_KEY`) so the MCP app can verify them using the JWKS endpoint.
- **JWKS / discovery** — `well-known.controller.ts` serves `/.well-known/oauth-authorization-server` and `/.well-known/jwks.json` via `OAuthKeyService`.

## Schema

`AuthCode` (`authcodes` collection) — short-lived authorization codes with PKCE challenge, redirect URI, scopes, and expiry.

## Key service: `OAuthKeyService`

Parses `RSA_PRIVATE_KEY` / `RSA_PUBLIC_KEY` from env, exposes the public key as a JWKS document.
