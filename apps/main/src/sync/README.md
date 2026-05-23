# sync

On-demand task sync module for `apps/main`.

## Responsibilities

- **Job lifecycle** — `SyncService.createJob` inserts a `TaskSyncJob` document then fires `runSync` asynchronously (fire-and-forget).
- **Sync stages** — `fetching` (connector API call) → `upserting` (bulk DB write) → `done` / `failed` / `cancelled`.
- **Cancellation** — `cancelJob` atomically flips status from `queued|running` → `cancelled`; the running coroutine checks for cancellation between stages.
- **Real-time progress** — `SyncGateway` is a Socket.IO gateway. Every stage transition emits `sync:progress` to the user's room (`user:<userId>`). Clients authenticate by passing a JWT in the handshake.

## HTTP endpoints

| Method   | Route          | Description                    |
| -------- | -------------- | ------------------------------ |
| `POST`   | `/sync`        | Start a sync job for a source  |
| `GET`    | `/sync/:jobId` | Poll job status                |
| `DELETE` | `/sync/:jobId` | Cancel a queued or running job |

## WebSocket events

Clients connect to the Socket.IO server and authenticate via `{ auth: { token } }` in the handshake.

| Event (server → client) | Payload                          |
| ----------------------- | -------------------------------- |
| `sync:progress`         | `SyncJobDto` — current job state |

## Schema

`TaskSyncJob` extends the `Job` discriminator (see `jobs/`). Extra fields: `source`, `stage`, `synced`, `skipped`, `error`.
