# Plan: RFC 7591 client metadata (#28)

Spec: `.claude/specs/2026-07-30-oauth-client-metadata-design.md`

1. `packages/api-client/src/types.ts` — add `clientUri`, `tosUri`, `policyUri`, `contacts`,
   `softwareId` as optional fields on `AuthorizedAppDto`. No `logoUri`.
2. `apps/main/src/auth/oauth-client.service.ts` — add the six snake_case fields to
   `RegisterClientInput` and `RegisterClientOutput`; persist them in `register`, echoing back only
   what was supplied (RFC 7591 §3.2.1).
3. `apps/main/src/auth/dto/register-client.dto.ts` — `isDisplayableHttpsUri` helper plus the new
   optional schema entries.
4. `apps/main/src/auth/schemas/oauth-client.schema.ts` — optional props `logoUri`, `clientUri`,
   `tosUri`, `policyUri`, `contacts`, `softwareId`.
5. `apps/main/src/auth/dto/auth-response.dto.ts` — mirror both DTO classes.
6. `apps/main/src/auth/authorized-apps.service.ts` — populate the new response fields.
7. `apps/web/src/i18n/en.json` + `AuthorizedAppsPage.tsx` — render an "provided by this app" block:
   website, terms, privacy, contacts, software id, all as plain text.
8. Tests: registration accept/reject cases in `well-known.controller.spec.ts`, metadata pass-through
   in `authorized-apps.service.spec.ts`, page render in a new `AuthorizedAppsPage.spec.tsx`.
9. `pnpm lint`, `pnpm format`, `pnpm --filter @ctm/main test`, `pnpm --filter @ctm/web test`.
10. Open a follow-up issue for the server-side logo proxy.
