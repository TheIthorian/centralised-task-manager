# config

Environment validation for `apps/main`.

`env.schema.ts` exports a Joi schema used by `@nestjs/config` (`validationSchema`) to validate and coerce process environment variables at startup. The app will refuse to start if any required variable is missing or invalid.

## Required variables

| Variable          | Type                  | Notes                                          |
| ----------------- | --------------------- | ---------------------------------------------- |
| `MONGODB_URI`     | string                | MongoDB connection string                      |
| `ENCRYPTION_KEY`  | hex string (64 chars) | AES-256-GCM key for connector token encryption |
| `RSA_PRIVATE_KEY` | string                | PEM — used to sign OAuth JWTs                  |
| `RSA_PUBLIC_KEY`  | string                | PEM — served via JWKS endpoint                 |

See `.env.example` at the repo root for the full list with defaults.
