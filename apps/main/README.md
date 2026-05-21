# @ctm/main

NestJS REST API — the primary backend. Handles auth, task aggregation, OAuth flows, API token issuance, and serves the web SPA in production.

## Responsibilities

- **Auth** — JWT-based login/register (`passport-local` + `passport-jwt`), refresh tokens, long-lived API tokens (hashed in MongoDB)
- **Tasks** — CRUD for aggregated tasks; sourced from connected third-party providers
- **Connectors** — OAuth flows and encrypted token storage for Todoist and Google Tasks
- **Reminders** — scheduled task reminders
- **SPA serving** — serves the built `apps/web` output in production

## Stack

- NestJS with Fastify adapter
- MongoDB via Mongoose
- `@nestjs/schedule` for cron jobs
- `@nestjs/swagger` for OpenAPI spec generation

## Setup

```bash
cp .env.example .env   # fill in values
pnpm --filter @ctm/main dev
```

### Environment Variables

| Variable                        | Description                                         |
| ------------------------------- | --------------------------------------------------- |
| `MONGODB_URI`                   | MongoDB connection string                           |
| `JWT_SECRET`                    | Secret for JWT signing                              |
| `ENCRYPTION_KEY`                | 64 hex chars — used to encrypt OAuth tokens at rest |
| `RSA_PRIVATE_KEY`               | Base64-encoded PKCS8 private key PEM                |
| `RSA_PUBLIC_KEY`                | Base64-encoded SPKI public key PEM                  |
| `JWT_ACCESS_EXPIRES`            | Access token TTL (e.g. `15m`)                       |
| `REFRESH_TOKEN_EXPIRES_DAYS`    | Refresh token TTL in days                           |
| `TODOIST_CLIENT_ID` / `_SECRET` | Todoist OAuth app credentials                       |
| `GOOGLE_CLIENT_ID` / `_SECRET`  | Google OAuth app credentials                        |
| `REDIRECT_BASE_URL`             | Base URL for OAuth redirect callbacks               |
| `PORT`                          | HTTP port (default `3000`)                          |
| `CORS_ORIGIN`                   | Comma-separated allowed origins, or omit for `*`    |

## Commands

```bash
pnpm dev                  # dev server with watch
pnpm build                # compile to dist/
pnpm start                # run compiled output
pnpm test                 # vitest
pnpm generate-openapi     # emit openapi.json to disk
```

## Module Structure

```
src/
  auth/         # login, register, JWT strategy, API tokens
  tasks/        # task CRUD
  connectors/   # OAuth + encrypted token storage
  oauth/        # OAuth callback handling
  reminders/    # scheduled reminders
  users/        # user profile
  database/     # Mongoose connection
  config/       # env schema validation
```
