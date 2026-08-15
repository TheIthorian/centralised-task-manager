# @ctm/env

Environment validation for the Node services.

Each app owns its own `env.schema.ts` — the variables it needs are the one part that genuinely
differs. Everything around that schema is the same in every app, and was previously copied into
each: `apps/main`, `apps/mcp` and `apps/admin` had three versions that had already drifted in
whether `validate` was extracted and in what the comments claimed.

## Using it

```ts
// src/config/load-env.ts
import { createEnvLoader } from '@ctm/env';
import { envSchema } from './env.schema.js';

export const { loadEnv, toLoggerConfig, resetEnvCache } = createEnvLoader({ schema: envSchema });
```

Each loader owns a private cache, so validation happens once per app. Bootstrap calls `loadEnv()`
before Nest exists in order to build a logger from the result, and `ConfigModule` is handed the same
cached object rather than re-validating: two validation points drift, and the earlier one wins
silently.

`toLoggerConfig` narrows a validated environment to a `LoggerConfig`, so `@ctm/logger` never reads
`process.env` itself. It supplies no defaults of its own — the schema already applied them, and a
second set here would be the pair of definitions that let the first pair drift apart.

## The bypass

`createEnvLoader({ schema, bypass })` takes an optional function returning a substitute environment,
or `undefined` to validate normally. It exists for the case where an app is booted by a tool that
has no environment at all — `apps/main`'s OpenAPI generator boots the app module in Nest preview
mode, where no provider is instantiated and nothing reads configuration.

A bypass is not a defaulting mechanism. If a variable has a sensible default, that belongs in the
schema.
