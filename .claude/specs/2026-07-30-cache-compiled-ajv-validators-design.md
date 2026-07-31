# Cache compiled Ajv validators per connector

## Problem

`ConnectorsController.setConnectionDetails` rebuilds the JSON Schema object from
`connector.connectionDetailsSchema` and calls `ajv.compile()` on every request. Compilation is the
expensive step in Ajv: it generates and evaluates source for a validation function. Running a
compiled function is cheap by comparison.

The schema is static per connector, so every compile after the first produces an identical function.

## Approach

A new `ConnectionDetailsValidator` provider in `apps/main/src/connectors/` owns the single Ajv
instance and a `Map<ConnectorName, ValidateFunction | null>`.

The map is filled in `onModuleInit` by walking `OAuthConnectorRegistry.list()`. Every registered
connector gets one entry:

- a compiled `ValidateFunction` when it declares connection fields,
- `null` when `connectionDetailsSchema` is empty, which means "this connector has nothing to
  validate" and preserves today's behaviour of accepting any body in that case.

`validate({ connectorName, details })` looks the entry up, returns early on `null`, and throws
`ValidationError` from `@ctm/errors` when the compiled function rejects the body.

## Cache growth

The cache is written only in `onModuleInit`, never from a request path. Its size is fixed at
bootstrap to the number of registered connectors, which is bounded by the `ConnectorName` enum.

The two properties that matter:

- The key is a connector name resolved from the connection document, not anything the caller sends.
  A name with no entry is a `NotFoundError`, not an insertion.
- The request body is validated against a cached function and is never itself a cache key, so a
  caller cannot mint new entries by varying its payload.

A lazily-populated cache would also have been bounded by the enum, but an eager map has no
insertion path reachable from a request at all, which is a cheaper property to keep true.

## Error type

The controller previously threw `BadRequestException`. The new service throws `ValidationError`,
per the repo rule that errors come from `@ctm/errors`. `AppErrorFilter` maps it to the same HTTP
400; only the response body's shape changes, from Nest's `{ statusCode, message, error }` to the
filter's `{ statusCode, code, message }`. Both carry `message`.

## Out of scope

`setConnectionDetails` still reads its body through Nest's `@Body` under `@UnvalidatedInput`,
because the schema is connector-supplied JSON Schema rather than a Zod DTO. That stays as it is.
