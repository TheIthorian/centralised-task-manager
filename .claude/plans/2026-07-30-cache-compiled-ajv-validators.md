# Plan: cache compiled Ajv validators per connector

Spec: `.claude/specs/2026-07-30-cache-compiled-ajv-validators-design.md`
Issue: #21

## 1. Add `ConnectionDetailsValidator`

`apps/main/src/connectors/connection-details-validator.service.ts`

- `@Injectable()`, `implements OnModuleInit`, constructor takes `OAuthConnectorRegistry`.
- Private `ajv = new Ajv()` and `validators = new Map<ConnectorName, ValidateFunction | null>()`.
- `onModuleInit()` walks `registry.list()` and fills the map.
- `validate({ connectorName, details })`: `NotFoundError` for an unregistered name, early return on
  a `null` entry, `ValidationError` with `ajv.errorsText(...)` when the body is rejected.
- Module-level helper `compileConnectionDetailsSchema({ ajv, schema })` declared below the class,
  returning `null` for an empty schema.

## 2. Wire it up

- `connectors.module.ts`: add `ConnectionDetailsValidator` to `providers`.
- `connectors.controller.ts`: inject it, drop the `Ajv` import and the `ajv` field, replace the
  inline compile block in `setConnectionDetails` with one `validate(...)` call, and update the
  `@UnvalidatedInput` reason to name the new service.

## 3. Tests

`apps/main/src/connectors/connection-details-validator.spec.ts`, unit-level against a real
`OAuthConnectorRegistry` seeded with stub connectors:

- accepts a valid body
- rejects a missing required field with `ValidationError`
- rejects an unknown property with `ValidationError`
- accepts anything for a connector with an empty schema
- throws `NotFoundError` for an unregistered connector
- compiles once: a connector whose `connectionDetailsSchema` is a counting getter is read during
  `onModuleInit` and not again across repeated `validate` calls

## 4. Verify

`pnpm lint`, `pnpm format`, `pnpm --filter @ctm/main test`.
