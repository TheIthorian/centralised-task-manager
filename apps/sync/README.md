# @ctm/sync

NestJS background worker. No HTTP server. Polls connected task sources every 15 minutes, upserts tasks into MongoDB, and refreshes OAuth tokens as needed.

## Responsibilities

- Poll all active connector accounts on a schedule
- Upsert remote tasks into MongoDB (keyed by `sourceId`)
- Refresh OAuth tokens before they expire

## Stack

- NestJS (no HTTP adapter)
- MongoDB via Mongoose
- `@nestjs/schedule` for polling

## Setup

```bash
docker compose up sync   # recommended — runs alongside MongoDB
```

Or standalone (requires `MONGODB_URI` etc. in env):

```bash
pnpm --filter @ctm/sync dev
```

### Environment Variables

Shares the same variables as `apps/main`:

| Variable                        | Description                                                  |
| ------------------------------- | ------------------------------------------------------------ |
| `MONGODB_URI`                   | MongoDB connection string                                    |
| `ENCRYPTION_KEY`                | Must match `apps/main` — used to decrypt stored OAuth tokens |
| `TODOIST_CLIENT_ID` / `_SECRET` | Todoist OAuth credentials                                    |
| `GOOGLE_CLIENT_ID` / `_SECRET`  | Google OAuth credentials                                     |
