# auth / oauth module boundary

Audit of `apps/main/src/auth` and `apps/main/src/oauth`. No code changed yet; this is the proposal.

## The intended split

- `auth` owns **the user**: credentials, sessions for our own first-party clients (web SPA), lockout.
- `oauth` owns **third-party delegation**: clients, consent, authorization codes, PKCE, protocol metadata.

Nothing in the current layout says which side owns tokens, and that is where every problem below starts.

## What is actually wrong

### 1. One refresh-token collection, two issuers, no fence between them

`AuthService.issueTokens` and `OAuthService.issueTokens` both mint `rt_<hex>` tokens, both SHA-256 them, and both write to the same `RefreshToken` collection, which both modules register with `MongooseModule.forFeature`. Neither lookup filters on who issued the token.

Consequences, both reachable today:

- A third-party client's refresh token works at `POST /auth/refresh`. It comes back as a first-party token pair with no `client_id` claim and no scopes, so the client escapes both its rate-limit fence and its scope restriction. This is a privilege escalation and should be fixed regardless of what happens to the module structure.
- A first-party refresh token works at `POST /oauth/token`. The stored record has no `scopes`, so `refreshAccessToken` hands `undefined` to `scopes.join(' ')`.

Fix: mark each record with its issuer (or split the collection) and filter on it in both lookups. Add a spec per direction.

### 2. Access-token claims are defined twice

`auth` signs `{ sub, email }` with the module-level `signOptions`. `oauth` signs `{ sub, email, iss, aud, client_id }` with its own `expiresIn`. One `JwtStrategy` verifies both, so the guard's contract is the intersection of two independently maintained payloads. Any future claim (roles, `scope`) has to be added in two files or it silently does not exist on half the tokens.

Fix: a single token-minting service owns claims and lifetimes; both flows call it with different inputs.

### 3. `oauth` reads config with silent defaults

`OAuthService` uses `config.get('JWT_ACCESS_EXPIRES', 120)` and `config.get('REFRESH_TOKEN_EXPIRES_DAYS', 30)`; `AuthService` uses `getOrThrow` for the same variables. A missing variable is a hard failure on one path and a quiet different lifetime on the other. `REDIRECT_BASE_URL` is read as `config.get(...)!` in two places, so an unset issuer produces `undefined/oauth/authorize` in the discovery document rather than a boot failure.

Fix: `getOrThrow` everywhere, or move these into the env validator.

### 4. Login lockout does not cover the OAuth login form

`LocalStrategy` calls `LoginAttemptsService.assertNotLocked` / `recordFailure` / `clear`. `POST /oauth/authorize` authenticates through `OAuthService.validatePassword`, which is a third bcrypt comparison with no lockout, no failure recording, and no attempt clearing. The consent screen is an unthrottled password oracle for the same accounts the login endpoint protects.

Fix: one credential-validation path used by both, with lockout inside it.

### 5. The OAuth data model lives in `auth`

`OAuthClient` + `OAuthClientService`, `AuthorizedClient` + `AuthorizedClientService`, and `AuthorizedAppsService` are all in `auth`, while only `AuthCode` is in `oauth`. `OAuthModule` therefore imports `AuthModule` to get its own domain objects, and `AuthModule` needs `forwardRef` for `UsersModule`.

Fix: move client registration, authorized clients and the authorized-apps read model into `oauth`. `auth` keeps users, sessions and lockout. `GET`/`DELETE /auth/me/authorized-apps` can stay on the `auth` controller and call into `oauth`, since it is a user-account surface, but the data belongs on the oauth side.

### 6. Two `WellKnownController` classes on the same route prefix

`auth/well-known.controller.ts` serves `POST /.well-known/oauth-client`; `oauth/well-known.controller.ts` serves the three GET metadata documents and has to hardcode the path of the endpoint the other module implements (`registrationEndpoint`). Identical class names in one Nest app make stack traces and DI errors ambiguous.

Fix: one `WellKnownController` in `oauth`. It is all OAuth protocol surface.

### 7. Smaller items in the same files

- `oauth/well-known.controller.ts` returns `object` from all three handlers, so the OpenAPI document has empty response schemas. The project rule is a DTO class that `implements` the api-client type.
- `auth/README.md` documents "Long-lived API tokens" that never expire. There is no such thing in the codebase; the OAuth server replaced it. Delete that row and the bullet.
- `oauth.service.ts` imports from `'crypto'`, `auth.service.ts` from `'node:crypto'`.

## Suggested order

1. Refresh-token issuer fence (#1) and lockout on the OAuth login form (#4). These are behavioural and worth landing on their own, before anything moves.
2. Config strictness (#3) and the small items (#7).
3. Single token-minting service (#2).
4. Move the client/authorization data model and the well-known controller into `oauth` (#5, #6). Mongoose collection names are unchanged by the move, so no migration; it is imports plus module wiring.

Steps 1 to 3 are independently useful even if step 4 never happens.
