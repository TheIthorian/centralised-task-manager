# OAuth: dynamically registered clients are public

## Problem

Discovery advertises `token_endpoint_auth_methods_supported: ['none']`, but
`POST /.well-known/oauth-client` mints a `client_secret`, stores it bcrypt-hashed, and returns it.
`POST /oauth/token` never authenticates the client, so the secret is never checked. It costs a
bcrypt hash per registration and implies a confidential-client property the server does not have.

## Decision

Option 1 from the issue: all dynamically registered clients are public. Security rests on PKCE
(`S256` required) plus exact redirect-URI matching, which is what RFC 8252 prescribes for native
and browser clients. No current consumer wants a confidential flow: `apps/cli/src/oauth.ts` reads
only `client_id` from the registration response, and `apps/mcp` never reads one.

## Behaviour

- Registration no longer generates, hashes, stores, or returns a `client_secret`.
- The registration response gains `token_endpoint_auth_method: 'none'`, so a client learns its
  authentication method from its own registration rather than inferring it from discovery
  (RFC 7591 §3.2.1: the server returns the metadata it actually registered).
- `clientSecretHash` is removed from the `OAuthClient` schema.
- Discovery metadata is unchanged: it already says `none`.
- The token endpoint is unchanged. It never authenticated clients, so nothing is weakened. A
  `client_secret` sent by a client is stripped by the DTO schema, as any unrecognised field is.

## Out of scope

Confidential clients, per-client auth methods, and client-secret rotation. If a future integration
needs one, it is a new capability rather than a repair of this one.
