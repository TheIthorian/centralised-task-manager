# Plan: unverified clients on the consent screen

Spec: `.claude/specs/consent-unverified-client.md`. Closes #22.

1. **`packages/api-client/src/types.ts`** — add `OAuthClientInfoDto` (`clientId`, `clientName`,
   `isDynamic`, `redirectHosts`). Export from `index.ts`.
2. **`packages/api-client/src/client.ts`** — `getOAuthClientInfo({ clientId })`, GET
   `/oauth/client-info`. Params type in `client.types.ts`.
3. **`apps/main/src/auth/oauth-client.service.ts`** — `getPublicClientInfo({ clientId })` reads the
   client and maps redirect URIs to distinct hosts; `null` when unknown. Unit covered through the
   controller spec.
4. **`apps/main/src/oauth/dto/client-info-response.dto.ts`** — response class implementing the
   api-client type.
5. **`apps/main/src/oauth/oauth.controller.ts`** — `GET client-info`, `JwtAuthGuard`,
   `ValidatedQueryValue` for `client_id`, 404 on unknown.
6. **`packages/ui/src/UnverifiedAppNotice.tsx`** (+ `.spec.tsx`, `.stories.tsx`) — presentational
   warning panel: glyph, heading, body, host list. All copy via props.
7. **`apps/web/src/i18n/en.json`** — `oauth.*` keys, including the existing consent copy that this
   page still hardcodes, so the page is consistent once it is touched.
8. **`apps/web/src/pages/OAuthConsentPage.tsx`** — `useQuery` for client info when `client_id` is
   present, render the notice for a dynamic client, name the client in the header, move copy to
   `t()`.
9. **Tests** — `oauth.controller.spec.ts` cases for dynamic/static/unknown/unauthenticated;
   `OAuthConsentPage.spec.tsx` cases for notice shown, notice absent, hosts listed, lookup failure.
10. `pnpm lint`, `pnpm format`, `pnpm --filter @ctm/ui test`, `pnpm --filter @ctm/web test`,
    `pnpm --filter @ctm/main test`.
