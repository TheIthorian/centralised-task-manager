# Centralised Task Manager — Design Spec

**Date:** 2026-05-19
**Status:** Approved

---

## Problem

- Tasks are scattered across Google Tasks, Todoist, and other apps
- No unified CLI or MCP interface for agent-driven task management
- Source apps lack fuzzy deadlines ("sometime this week") with intelligent reminders

---

## Goals

1. Aggregate tasks from any REST-based task app into a single local mirror
2. Provide a REST API (web GUI), CLI, and MCP server as first-class interfaces
3. Store fuzzy deadlines as a local overlay — never written back to the source
4. Multi-user: each user connects their own apps via OAuth

---

## Non-Goals (V1)

- Real-time push / websocket updates (polling is sufficient)
- Mobile app
- Task creation from scratch without a connected source (may come later)
- Bi-directional fuzzy deadline sync

---

## Monorepo Structure

```
apps/
  main/       # NestJS REST API — auth, users, tasks, connectors, OAuth
  sync/       # NestJS worker — polling loop, token refresh, source writes
  web/        # Vite + React SPA (dashboard)
  docs/       # Docusaurus + OpenAPI reference

packages/
  connectors/ # Adapter interface + concrete implementations
  logger/     # Shared Pino logger
  errors/     # Shared error types
  http/       # Shared fetch wrapper
  ui/         # Shared React components
  tsconfig/   # Shared TypeScript configs
  config/     # Shared eslint / oxlint / oxfmt config
```

`apps/main` and `apps/sync` share one MongoDB instance. They communicate only through the database — no inter-service HTTP calls.

---

## Data Models

### User

```
id            ObjectId
email         string (unique)
passwordHash  string
createdAt     Date
```

### ConnectorConfig

```
id              ObjectId
userId          ObjectId (ref: User)
source          string           // "todoist" | "google_tasks" | ...
accessToken     string           // encrypted at rest (AES-256)
refreshToken    string           // encrypted at rest
tokenExpiresAt  Date
settings        Record<string, unknown>  // source-specific (e.g. project IDs)
lastSyncedAt    Date | null
enabled         boolean
createdAt       Date
```

### Task

```
id             ObjectId
userId         ObjectId (ref: User)
source         string           // "todoist" | "google_tasks" | ...
sourceId       string           // ID in the source system
title          string
description    string | null
status         "open" | "done" | "archived"
priority       1 | 2 | 3 | 4 | null
tags           string[]
sourceDueDate  Date | null      // from source, never modified locally
fuzzyDeadline  FuzzyDeadline | null  // local overlay only
syncedAt       Date
createdAt      Date
updatedAt      Date
```

Unique index: `{ userId, source, sourceId }` — prevents duplicate upserts.

### FuzzyDeadline (embedded)

```
type         "this_week" | "this_month" | "someday"
remindEvery  "daily" | "weekly" | null
```

### SyncLog

```
id                 ObjectId
connectorConfigId  ObjectId (ref: ConnectorConfig)
startedAt          Date
completedAt        Date | null
tasksUpserted      number
error              string | null
```

---

## packages/connectors — Adapter Interface

```ts
interface RemoteTask {
  sourceId: string;
  title: string;
  description: string | null;
  status: "open" | "done";
  priority: number | null;
  dueDate: Date | null;
  tags: string[];
}

interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface TaskConnector {
  readonly source: string;

  // OAuth
  getAuthUrl(userId: string): string;
  exchangeCode(code: string): Promise<OAuthTokens>;
  refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;

  // Sync (read)
  fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]>;

  // Write-through mutations
  createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask>;
  updateTask(
    tokens: OAuthTokens,
    sourceId: string,
    patch: UpdateTaskDto,
  ): Promise<RemoteTask>;
  completeTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
  deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
}
```

**V1 implementations:** `TodoistConnector`, `GoogleTasksConnector`. Both use OAuth2 with PKCE.

A `ConnectorRegistry` (NestJS injectable) maps `source` strings to connector instances. Both `apps/main` and `apps/sync` import and register it.

---

## apps/main — NestJS Modules

### AuthModule

- `POST /auth/register` — create user
- `POST /auth/login` — returns JWT
- Strategy: `@nestjs/passport` + `passport-local` (login) + `passport-jwt` (guard on all protected routes)
- JWT payload: `{ sub: userId, email }`

### UsersModule

- `GET /users/me` — current user profile
- `PATCH /users/me` — update profile

### ConnectorsModule

- `GET /connectors` — list available connector types
- `GET /connectors/configs` — list user's connected apps
- `POST /connectors/configs` — add a connector (triggers OAuth initiation)
- `GET /connectors/oauth/callback/:source` — OAuth redirect handler; exchanges code, encrypts tokens, saves `ConnectorConfig`
- `PATCH /connectors/configs/:id` — update settings / enable-disable
- `DELETE /connectors/configs/:id` — remove + delete associated tasks

### TasksModule

- `GET /tasks` — list tasks (filter by status, source, fuzzyDeadline type, tags; paginated)
- `GET /tasks/:id` — get single task
- `POST /tasks` — create task (writes to source via connector, then mirrors locally)
- `PATCH /tasks/:id` — update task; write-through to source then update local record
- `PATCH /tasks/:id/fuzzy-deadline` — set/update fuzzy deadline (local only, no source write)
- `DELETE /tasks/:id/fuzzy-deadline` — remove fuzzy deadline
- `POST /tasks/:id/complete` — mark done; write-through to source
- `DELETE /tasks/:id` — delete; write-through to source

Write-through rule: if the remote mutation fails, the local record is not updated. Source is system of record.

### RemindersModule

- NestJS `@Cron` job runs daily
- Queries tasks with `fuzzyDeadline.remindEvery = "daily"` or `"weekly"` (weekly only on Mondays)
- Emits a reminder notification (initially: console log + future email/push hook)

---

## apps/sync — NestJS Worker

No HTTP server. Pure background worker.

### SyncScheduler

- NestJS `@Cron` job, configurable interval (default: every 15 minutes)
- Fetches all enabled `ConnectorConfig` records
- For each config:
  1. Refresh token if `tokenExpiresAt` is within 5 minutes
  2. Call `connector.fetchTasks(tokens)`
  3. Upsert each `RemoteTask` into the `Task` collection (match on `userId + source + sourceId`)
  4. Do not overwrite `fuzzyDeadline` or local-only fields during upsert
  5. Write a `SyncLog` entry (success or error)
- Runs configs concurrently with a concurrency limit (default: 5)

### TokenRefreshService (lives in `packages/connectors`)

- Shared utility imported by both `apps/sync` and `apps/main`
- Handles refresh, re-encryption, and saving updated tokens back to `ConnectorConfig`

---

## Fuzzy Deadline Logic

Stored on `Task.fuzzyDeadline`. Never written to the source.

| Type         | Meaning                         | Default remind cadence |
| ------------ | ------------------------------- | ---------------------- |
| `this_week`  | Due before end of current week  | Daily                  |
| `this_month` | Due before end of current month | Weekly                 |
| `someday`    | No urgency                      | null (no reminders)    |

`RemindersModule` surfaces tasks based on cadence. In V1, "surfacing" means they appear at the top of `GET /tasks` when queried with `?surfaced=true`, and a log entry is written. Email/push notification integration is a future extension point.

---

## CLI (`apps/main` companion — or standalone package)

Thin Node.js CLI that calls the REST API. Auth token stored in `~/.config/ctm/token`.

```
ctm login
ctm tasks list [--status open] [--source todoist] [--fuzzy this_week]
ctm tasks complete <id>
ctm tasks set-fuzzy <id> this_week
ctm connectors list
ctm connectors add todoist
ctm sync now
```

Implemented as a separate `apps/cli` NestJS CLI app (using `@nestjs/cli` commander integration) or a simple standalone `packages/cli` using `commander`. Implemented as `apps/cli` using `commander` — lightweight, no NestJS overhead needed.

---

## MCP Server (`apps/mcp`)

Exposes a subset of the task API as MCP tools for Claude and other agents.

**Tools:**

- `list_tasks` — query tasks (filters: status, source, fuzzy type)
- `complete_task` — mark a task done
- `set_fuzzy_deadline` — set a fuzzy deadline on a task
- `create_task` — create a new task in a specified source
- `update_task` — update title/description/priority

Implemented using the official MCP SDK (`@modelcontextprotocol/sdk`). Auth via a long-lived API token (separate from the web JWT — stored in `~/.config/ctm/mcp-token`). Tokens are issued via `POST /auth/tokens` (also used by the CLI) and stored in a `ApiToken` collection (`userId`, `tokenHash`, `label`, `lastUsedAt`, `createdAt`).

---

## Auth Summary

| Layer              | Mechanism                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Web GUI / REST API | JWT via `@nestjs/passport` + `passport-jwt`                                              |
| CLI                | Long-lived API token issued via `POST /auth/tokens`, stored in `~/.config/ctm/token`     |
| MCP server         | Long-lived API token issued via `POST /auth/tokens`, stored in `~/.config/ctm/mcp-token` |
| Connector OAuth    | Per-user OAuth2 PKCE; tokens encrypted (AES-256) in `ConnectorConfig`                    |

---

## Error Handling

- Connector fetch failures: logged to `SyncLog`, connector marked with last error, sync continues for other connectors
- Write-through failures: return 502 to client with source error details; local record unchanged
- Token refresh failures: connector disabled, user notified via `ConnectorConfig.enabled = false`
- All errors use `packages/errors` shared types

---

## Testing Strategy

- Co-located `*.spec.ts` files per source file
- Integration tests hit a real MongoDB instance (via `vitest.setup.ts`)
- `packages/connectors` unit-tested with recorded HTTP fixtures (no live API calls in CI)
- Sync flow tested end-to-end against a stub connector implementation
- No test cleanup — use unique identifiers per run

---

## Deployment (Dev)

```yaml
# docker-compose.yml services
main     # apps/main
sync     # apps/sync
cli      # (not containerised — runs locally)
mcp      # apps/mcp
mongodb  # shared DB
```

Each app has its own `Dockerfile`. Turbo `dev` task starts all apps in watch mode.

---

## V1 Scope Boundary

In scope:

- Full monorepo scaffold
- `apps/main`: auth, users, connectors, tasks, reminders
- `apps/sync`: polling sync worker
- `packages/connectors`: interface + Todoist + Google Tasks adapters
- `apps/cli`: commander-based CLI
- `apps/mcp`: MCP server with 5 tools
- `apps/web`: basic task list dashboard

Out of scope for V1:

- Email/push notifications (reminder hook exists, delivery TBD)
- Task creation without a connected source
- Real-time UI updates
- Connector for GitHub Issues, Linear, Jira
