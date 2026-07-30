# Plan: enforce `code_challenge_method`

Spec: `.claude/specs/2026-07-30-oauth-code-challenge-method-design.md`. Issue #24.

1. Add `apps/main/src/oauth/pkce.ts` with `CODE_CHALLENGE_METHODS`, `CodeChallengeMethod`,
   `codeChallengeMethodSchema`, `isSupportedCodeChallengeMethod`, `verifyCodeChallenge`.
2. Add `apps/main/src/oauth/pkce.spec.ts`: matching verifier passes, mismatched fails, a
   `plain`-style verifier equal to the challenge fails, the guard rejects `plain` and `''`.
3. `dto/authorize-query.dto.ts` — use `codeChallengeMethodSchema`.
4. `schemas/auth-code.schema.ts` — type the prop `CodeChallengeMethod`, add Mongoose `enum`.
5. `oauth.service.ts` — `createAuthCode` accepts and stores `codeChallengeMethod`; `exchangeCode`
   rejects an unsupported stored method, then calls `verifyCodeChallenge`.
6. `oauth.controller.ts` — pass the method through from the query.
7. `well-known.controller.ts` — render `CODE_CHALLENGE_METHODS`.
8. `oauth.controller.spec.ts` — assert `/oauth/authorize` rejects `code_challenge_method=plain`
   with 400, and that an S256 round trip still exchanges. Unsupported-stored-method rejection is
   covered at unit level in `pkce.spec.ts`, since no route can persist another method.
9. `pnpm lint`, `pnpm format`, `pnpm --filter @ctm/main test`.
