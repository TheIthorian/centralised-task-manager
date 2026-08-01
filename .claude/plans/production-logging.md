# Plan: production logging

Implements `.claude/specs/production-logging.md`.

## 1. `packages/logger`

- `src/request-context.ts` — `AsyncLocalStorage<RequestContext>`, `runWithRequestContext`,
  `getRequestContext`, `bindRequestUser`. Spec covers propagation across awaits and the no-context
  case.
- `src/redaction.ts` — `REDACT_PATHS`. Spec asserts a secret-bearing payload comes out redacted.
- `src/process-errors.ts` — `installProcessErrorHandlers({ logger })`, returns an uninstall fn.
- `src/config.ts` — `readLoggerConfig` reads and validates `LOG_LEVEL`, `LOG_PRETTY` and
  `LOG_REDACT`, all required, plus `assertSafeInProduction` for the two combinations production
  rejects. Spec covers each missing var, a bad level, a non-boolean, and both production guards.
- `src/index.ts` — wire `redact` (behind `LOG_REDACT`), `serializers`, `mixin`; pretty transport
  behind `LOG_PRETTY`.

## 2. `packages/request-logger`

- `logging.ts` — `RequestLog` gains `requestId` / `userId`, sourced from the context store.
- `request-logging.middleware.ts` — resolve the request id, echo the response header, run inside
  the store.
- `nest-logger.service.ts` — `PinoLoggerService` moved from `apps/main`, arity-based arg handling.
- Re-export everything from `index.ts`.

## 3. `apps/main`

- Delete `src/logging/pino-logger.service.ts`; `bootstrap.ts` imports from `@ctm/request-logger`
  and installs the process error handlers.
- `AppErrorFilter` logs by status class.
- `JwtStrategy.validate` calls `bindRequestUser`.
- Move `new Logger(...)` users onto `createLogger` with object-first payloads and fix the levels:
  `connectors.controller`, `oauth.controller`, `sync.service`, `sync.gateway`,
  `notifications.service`, `notifications.gateway`, `reminders.service`, `channels/email.channel`.
- Log the swallowed branches in `users.service`, `import.service`, `channels/discord.channel`.

## 4. `apps/mcp`

- `bootstrap.ts` installs `PinoLoggerService('mcp')` and the process error handlers.
- `config/env.schema.ts` requires all three logging variables and repeats the production guards;
  `.env.example` / `.env.test` gain them, and a new `env.schema.spec.ts` covers them.
- `McpUnauthorizedFilter` logs at `warn`.

## 5. Docs

- `DEPLOYMENT.md` Observability section.

## Verification

`pnpm lint`, `pnpm format`, `pnpm --filter @ctm/logger test`,
`pnpm --filter @ctm/request-logger test`, `pnpm --filter @ctm/main test`,
`pnpm --filter @ctm/mcp test`, `pnpm build`.
