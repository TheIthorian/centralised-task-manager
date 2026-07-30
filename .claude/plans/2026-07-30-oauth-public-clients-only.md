# Plan: OAuth public clients only

Spec: `.claude/specs/2026-07-30-oauth-public-clients-only.md` (issue #23).

1. `apps/main/src/auth/oauth-client.service.ts`
    - Drop `generateClientSecret`, the `bcrypt` import, and the hash write.
    - `RegisterClientOutput`: replace `client_secret` with `token_endpoint_auth_method: 'none'`.
2. `apps/main/src/auth/schemas/oauth-client.schema.ts` — remove the `clientSecretHash` prop.
3. `apps/main/src/auth/dto/auth-response.dto.ts` — mirror the output type on
   `RegisterClientResponseDto`.
4. `apps/main/src/auth/well-known.controller.ts` — update the `@ApiResponse` description and the
   doc comment, which both mention the secret and its bcrypt cost.
5. Tests
    - `apps/main/src/auth/well-known.controller.spec.ts`: assert no `client_secret` in the response
      and `token_endpoint_auth_method === 'none'`; the uniqueness test covers `client_id` only.
    - `apps/main/src/oauth/well-known.controller.spec.ts`: same assertion on the registration case,
      plus a check that the registered method matches
      `token_endpoint_auth_methods_supported` in both discovery documents.
    - `apps/main/src/auth/authorized-apps.service.spec.ts`: drop the `clientSecretHash` fixtures.
    - Add a token-endpoint test proving an authorization-code exchange still succeeds without any
      client credential.
6. `pnpm lint`, `pnpm format`, `pnpm --filter @ctm/main test`.

Overlaps with issue #24 (`code_challenge_method` enforcement) in `apps/main/src/oauth`; this change
touches neither `authorize-query.dto.ts` nor `oauth.service.ts`, so the diffs should not collide.
