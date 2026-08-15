# auth

User authentication module for `apps/main`.

## Responsibilities

- **Registration / login** — validates credentials and asks `tokens` for a pair, so clients don't need to re-authenticate on every request.
- **Sessions** — the first-party surface (`POST /auth/login`, `/auth/refresh`, `/auth/logout`) and the refresh cookie web clients use instead of a bearer token.
- **Login lockout** — repeated failures against one account are counted and locked out here, on the only credential path there is.

Third-party delegation is not part of this module: clients, consent and the OAuth protocol surface live in `oauth`, and the tokens themselves in `tokens`. `GET`/`DELETE /auth/me/authorized-apps` is served here because it is a user-account surface, but it reads the grants `oauth` owns.
