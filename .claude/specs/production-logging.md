# Spec: production logging

Closes #44.

## Goal

Backend logs that can be read during an incident: every line ties back to a request and a user,
every failure carries a structured error, no secret is ever written to stdout, and the level of a
line predicts how urgent it is.

## Level conventions

| Level   | Meaning                                                                                |
| ------- | -------------------------------------------------------------------------------------- |
| `fatal` | The process cannot continue. Only `uncaughtException` / `unhandledRejection`.          |
| `error` | A request or job failed and nobody downstream can recover it. Always carries `err`.    |
| `warn`  | A request was rejected for a reason the caller controls (4xx), or a degraded fallback. |
| `info`  | One line per completed request, plus lifecycle events (boot, shutdown).                |
| `debug` | Routine protocol detail: OAuth step-by-step, expected-and-handled branches.            |
| `trace` | Off in production. Nest's `verbose`.                                                   |

A caught error is never silent. If a branch swallows an error on purpose, it logs at `debug` with
the error attached and a reason.

## Correlation

`@ctm/logger` owns an `AsyncLocalStorage<RequestContext>` holding `{ requestId, userId? }`.

- `RequestLoggingMiddleware` accepts an inbound `x-request-id` (bounded, sanitised) or mints a
  UUID, echoes it back on the response header, and runs the rest of the request inside the store.
- `JwtStrategy.validate` binds `userId` onto the live store once the token is verified.
- `createLogger` installs a pino `mixin` that reads the store, so every line from every logger in
  the request carries `requestId` and `userId` without any call site passing them.
- `RequestLog` gains `requestId` and `userId`.

The store lives in `@ctm/logger` rather than `@ctm/request-logger` so the mixin does not create a
dependency from the logger onto the Nest-aware package.

## Configuration

Three variables, read by `readLoggerConfig` in `@ctm/logger`: `LOG_LEVEL`, `LOG_PRETTY` and
`LOG_REDACT`. Nothing is inferred from `NODE_ENV`; `LOG_PRETTY` replaces the previous
behaviour of selecting pino-pretty whenever `NODE_ENV` was not production.

`LOG_LEVEL` is required. The two switches default to `LOGGER_CONFIG_DEFAULTS`
(`pretty: false`, `redact: true`), the safe end of each. A value that is present but
unparseable is a `ConfigurationError` rather than a silent fall back to the default.

`readLoggerConfig` runs before Nest validates anything, since bootstrap builds a logger
first, so it and the apps' Joi schemas have to agree exactly. A rule stricter in the logger
kills the process before the schema is consulted, making the schema's version unreachable;
the defaults are therefore imported from `@ctm/logger` rather than restated in Joi.

`LOG_REDACT=false` exists so keys can be eyeballed locally. Both the logger and each app's
Joi env schema refuse to boot when `NODE_ENV=production` is combined with `LOG_PRETTY=true`
(pino-pretty is absent from production images) or `LOG_REDACT=false` (it would write live
credentials to the log collector).

## Redaction

`createLogger` sets a pino `redact` list covering authorization and cookie headers, passwords and
hashes, every token flavour (`access_token`, `refresh_token`, `id_token`, `botToken`, ...), OAuth
`code`, `code_verifier`, `state` and `client_secret`. Each key is listed bare, one level deep
(`*.key`) and under `req.headers`, because pino redaction paths are static and cannot recurse.

Serializers: pino's `err`, plus `req` / `res` reduced to method, url and status.

## Error logging

- `AppErrorFilter` logs 5xx at `error` with the error object, everything else at `warn`.
- `McpUnauthorizedFilter` logs at `warn`.
- `installProcessErrorHandlers` logs `uncaughtException` / `unhandledRejection` at `fatal`.
- Call sites pass the error object (`{ err }`) instead of interpolating `err.message`.
- `PinoLoggerService` stops guessing the stack by scanning strings and reads Nest's documented
  `(message, stack?, context?)` arity instead. An `Error` passed as the message is logged as `err`.

## Plumbing

- `PinoLoggerService` moves to `@ctm/request-logger` so `apps/mcp` can install it too.
- `apps/mcp` validates `LOG_LEVEL` like `apps/main` does.
- The Nest `Logger` users move to `@ctm/logger` with object-first payloads.
- `pino-pretty` is selected only by `LOG_PRETTY`, never by `NODE_ENV`.

## Docs

`DEPLOYMENT.md` gains an Observability section: the level table, how to change `LOG_LEVEL` per
service, where the logs are, and how to trace one request by `x-request-id`.
