# Plan: finish the Zod DTO migration (#20)

Spec: `.claude/specs/2026-07-30-zod-dto-migration-finish-design.md`

Run `pnpm --filter @ctm/main test` after each step.

## 1. api-client wire types

- `packages/api-client/src/types.ts`: add `LoginDto`, `RegisterDto`, `RefreshDto`.
- `packages/api-client/src/client.types.ts`: alias `LoginParams`, `RegisterParams`, `RefreshParams`
  to the new types.
- `packages/api-client/src/index.ts`: export the three new types.

## 2. Auth DTOs

- `login.dto.ts`, `register.dto.ts`: `requestObject`, pass the api-client type.
- `refresh.dto.ts`: pass the api-client type.
- `auth.controller.ts`: `@ApiBody({ type: LoginDto })` on `login`.

## 3. Task and notification DTOs

`z.strictObject` to `requestObject` in `add-reminder.dto.ts`, `set-task-status.dto.ts`,
`task-relation.dto.ts`, `list-notifications-query.dto.ts`.

## 4. Import request DTO

- `import-request.dto.ts`: `importRequestSchema` + `createZodDto<IImportRequestDto>`.
- `data-portability.controller.ts`: parse the `onConflict` multipart field through the schema;
  add `@UnvalidatedInput` naming the multipart stream as the reason.

## 5. Tests

- New `apps/main/src/common/zod/request-dtos.spec.ts`: every app request DTO strips explicit
  `null`, rejects an unknown key, and enforces its bounds.
- New `apps/main/src/data-portability/dto/import-request.dto.spec.ts`: default, valid values,
  rejection of an unknown value.
- Extend `data-portability.controller.spec.ts` for the rejected `onConflict`.

## 6. Verify

`pnpm --filter @ctm/main run generate-openapi`, then `pnpm lint`, `pnpm format`, `pnpm build`,
`pnpm --filter @ctm/main test`.
