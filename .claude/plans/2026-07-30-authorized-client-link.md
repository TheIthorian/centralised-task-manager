# Plan: AuthorizedClient link

Spec: `.claude/specs/2026-07-30-authorized-client-link-design.md` · Issue #27

1. **Schema** — `apps/main/src/auth/schemas/authorized-client.schema.ts`. Fields per spec, unique
   compound index `{ userId: 1, clientId: 1 }`, `timestamps: true`.

2. **Service** — `apps/main/src/auth/authorized-client.service.ts` with
   `recordAuthorization({ userId, clientId, scopes, isDynamic })` (upsert, `$setOnInsert` on
   `authorizedAt`) and `findByUser(userId)`.

3. **Module wiring** — register the schema in `auth.module.ts`, provide and export
   `AuthorizedClientService`; `OAuthService` injects it through the already-imported `AuthModule`.

4. **Write path** — `OAuthService.issueTokens` calls `recordAuthorization` when `clientId` is set,
   reading `isDynamic` from `OAuthClientService.findByClientId`.

5. **Read path** — rewrite `AuthorizedAppsService.getAuthorizedApps` against the new collection;
   one `$in` join for client names.

6. **Revoke path** — `revokeAuthorizedApp` deletes the link(s) as well as the tokens; falls back to
   the link's `isDynamic` when the client document is gone; throws `NotFoundError` from
   `@ctm/errors` when neither exists.

7. **Deployment** — no migration. Document the drop of `oauthclients` and the client-bound refresh
   tokens in `DEPLOYMENT.md` as a step run against production before the release.

8. **Tests** — rewrite `authorized-apps.service.spec.ts` against the new collection, add
   `authorized-client.service.spec.ts`. Real MongoDB, unique ids from `Date.now()`, no cleanup.

9. **Verify** — `pnpm --filter @ctm/main test`, `pnpm lint`, `pnpm format`.
