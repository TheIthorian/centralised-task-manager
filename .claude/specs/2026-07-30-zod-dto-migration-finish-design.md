# Finish the class-validator to Zod DTO migration (#20)

## Problem

Issue #20 asks for the remaining `apps/main/src/**/dto/*.ts` request DTOs to move from
class-validator to Zod, then for `common/zod/class-validator.pipe.ts` and the class-validator
dependency to be removed.

An audit of `main` shows the bulk of that already landed with the input-validation sweep (#25):
there is no `class-validator` or `class-transformer` import anywhere in `apps/`, no
`class-validator.pipe.ts`, no class-validator entry in any `package.json`, and CLAUDE.md already
declares Zod canonical with no coexistence note. What survives are the loose ends the sweep left
behind.

### Loose ends

1. `data-portability/dto/import-request.dto.ts` is still a hand-written class with a bare
   `onConflict!` property and no schema. The controller parses the same multipart field with an
   inline `if (value === 'replace' || value === 'ignore')`, so an unrecognised value is silently
   coerced to `ignore` rather than rejected, and the DTO class is unreferenced.
2. `auth/dto/login.dto.ts` exports a `LoginDto` nothing imports. `POST /auth/login` is guarded by
   the local Passport strategy, so the handler declares no body parameter and the OpenAPI document
   describes the endpoint with no request body at all.
3. Six DTOs use `z.strictObject` where CLAUDE.md prescribes `requestObject` for app endpoints:
   `login`, `register`, `add-reminder`, `set-task-status`, `task-relation` and
   `list-notifications-query`. `requestObject` is `strictObject` plus null-stripping, which is what
   lets a client round-trip a response back as a request.
4. `login`, `register` and `refresh` build their DTO class without an api-client type parameter, so
   the schema and the wire contract can drift apart unchecked.

## Approach

Close the loose ends and leave the migration provably finished. Nothing here changes an endpoint's
happy path; the behavioural deltas are that explicit `null`s are now stripped rather than rejected
on six endpoints, and that an unknown `onConflict` value is now a 400 rather than a silent default.

`apps/main/src/oauth` and `.well-known` are untouched: their DTOs are protocol endpoints and stay on
plain `z.object` per RFC 7591 §3.1, and other work is in flight there.

### Import request

Give `ImportRequestDto` a real schema and use it:

```ts
export const importRequestSchema = requestObject({
    onConflict: z.enum(['replace', 'ignore']).default('ignore'),
});
```

The controller parses the multipart field through `importRequestSchema` instead of the inline
comparison. `@ValidatedBody` cannot be used: the body is a `multipart/form-data` stream the handler
consumes itself with `req.parts()`, so the handler carries `@UnvalidatedInput` with that reason and
does the parse explicitly.

### Login body

`POST /auth/login` gains `@ApiBody({ type: LoginDto })`. The credentials themselves are still
checked by the local strategy, which is what turns a bad body into a 401 before any pipe could run;
the annotation exists so the published contract names the fields and `LoginDto` is no longer an
orphan.

### Wire types

Add `LoginDto`, `RegisterDto` and `RefreshDto` to `packages/api-client/src/types.ts`, export them,
and alias the existing `LoginParams` / `RegisterParams` / `RefreshParams` to them so there is one
definition rather than two. Each `apps/main` DTO then passes its api-client type to `createZodDto`.

## Out of scope

- Response DTOs: they need swagger metadata, not validation.
- Query DTOs (`ListTasksQueryDto`, `ListNotificationsQueryDto`) do not get an api-client type
  parameter. Their schemas apply `.default()`, so the parsed output type and the type a caller
  sends differ, and a single wire type cannot describe both without a second input type per query.
- `apps/main/src/oauth`.
