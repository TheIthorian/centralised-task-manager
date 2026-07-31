# Plan: api-client domain modules

Spec: `.claude/specs/api-client-domain-modules.md` · Issue #26

1. **http layer** — extract `ApiClientError` into `http/api-client.error.ts`, the axios instance and
   `request()` into `http/api-http-client.ts`, and `ApiClientOptions` / `RequestOptions` /
   `DomainClientOptions` into `http/http.types.ts`. The private axios-error mapping helpers become
   module-level functions declared below their caller.

2. **Domain types** — move each DTO and `*Params` type from `types.ts` / `client.types.ts` into
   `domains/<domain>/<domain>.types.ts`. `OkDto` goes to `domains/shared.types.ts`.

3. **Domain clients** — one class per domain, `constructor({ http }: DomainClientOptions)`, methods
   copied verbatim with `this.request` rewritten to `this.http.request`. `AuthClient` also takes the
   constructor refresh token, since `refresh()` and `logout()` fall back to it. `TasksClient` keeps
   the private `filterToParams` helper.

4. **Facade** — `client.ts` builds one `ApiHttpClient` and one instance of each domain client, and
   re-declares all 45 methods as one-line delegations with their original JSDoc and signatures.

5. **Barrels** — `types.ts` and `client.types.ts` re-export the moved names. `index.ts` keeps its
   current export list unchanged.

6. **Specs** — split `client.spec.ts`: auth cases to `domains/auth/auth.client.spec.ts`, the filter
   mapping to `domains/tasks`, export/import to `domains/data-portability`, and the bearer header
   plus error mapping to `http/api-http-client.spec.ts`. Add `client.spec.ts` covering that the
   facade delegates.

7. **CLAUDE.md** — update the request/response types rule to point at
   `packages/api-client/src/domains/<domain>/<domain>.types.ts`.

8. **Verify** — `pnpm lint`, `pnpm format`, `pnpm build`, `pnpm test`.
