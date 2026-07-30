# OAuth: enforce `code_challenge_method`

## Problem

`AuthCode.codeChallengeMethod` is persisted but never read. `OAuthService.exchangeCode` always
hashes the verifier with SHA-256, so a stored method other than `S256` is silently treated as
`S256`. The flow fails closed (the digests will not match), but the client sees
"code_verifier does not match code_challenge" rather than a statement of what is unsupported.

The authorize DTO already constrains the query parameter to `S256`, and discovery advertises
`code_challenge_methods_supported: ['S256']`, so the two ends agree; only the middle is unchecked.

## Decision

S256 only. `plain` stays unsupported: RFC 7636 §4.4.1 keeps it purely for clients that cannot
compute a digest, and OAuth 2.1 requires S256 for public clients, which is every client here.

Make the single supported method one exported constant that the DTO, the Mongoose schema, the
discovery documents and the verifier all read, and have `exchangeCode` check the stored method
before verifying.

## Design

New `apps/main/src/oauth/pkce.ts`:

- `CODE_CHALLENGE_METHODS = ['S256'] as const` and `type CodeChallengeMethod`.
- `codeChallengeMethodSchema` — the Zod enum the authorize DTO uses.
- `isSupportedCodeChallengeMethod(method)` — type guard over the stored string.
- `verifyCodeChallenge({ codeVerifier, codeChallenge, codeChallengeMethod })` — computes the
  transform for the given method and compares. Exhaustive over `CodeChallengeMethod`, so adding a
  method to the constant is a type error until the transform exists.

Changes:

- `AuthCode.codeChallengeMethod` typed `CodeChallengeMethod` with a Mongoose `enum`.
- `createAuthCode` takes `codeChallengeMethod` and stores what the client asked for, instead of
  relying on the schema default.
- `OAuthController.authorizePost` passes `query.code_challenge_method ?? 'S256'`. RFC 7636 §4.3
  makes the parameter optional and defaults it to `plain`; this server defaults it to `S256`
  because it never accepts a `plain` challenge, so treating an omitted method as `plain` would
  reject every client that relies on the parameter being optional.
- `exchangeCode` rejects an unrecognised stored method with `unsupported code_challenge_method`
  before verifying, then verifies through `verifyCodeChallenge`.
- Discovery metadata renders `CODE_CHALLENGE_METHODS` rather than a repeated literal.

## Out of scope

Codes written by an earlier deploy carry `codeChallengeMethod: 'S256'` from the schema default and
keep verifying. Auth codes live five minutes, so no backfill is needed.
