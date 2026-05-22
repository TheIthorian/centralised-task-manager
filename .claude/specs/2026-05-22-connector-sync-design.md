# Connector Sync — Design Spec

**Date:** 2026-05-22  
**Scope:** On-demand pull sync from connected sources (Todoist, Google Tasks) triggered via a UI button. No push from CTM to external systems.

---

## Overview

Users can trigger a manual sync per connector from the Sources settings page. The sync fetches tasks from the remote source and upserts them into CTM's MongoDB. CTM-local changes take priority — tasks modified in CTM after their last sync are not overwritten. Progress is streamed via WebSocket.

---

## Backend

### Generic Job Collection (`apps/main/src/jobs/`)

A MongoDB collection with Mongoose discriminators supports multiple job types in one collection.

**Base schema (`Job`):**
```
_id        ObjectId
userId     ObjectId   (ref: User)
type       string     (discriminator key)
status     enum: queued | running | done | failed | cancelled
startedAt  Date
completedAt Date?
error      string?
```

**`TaskSyncJob` discriminator (`type: 'task-sync'`):**
```
source  string           (e.g. 'todoist', 'google-tasks')
stage   enum: fetching | upserting  (nullable)
synced  number           (tasks upserted)
skipped number           (tasks skipped due to local CTM changes)
```

Future job types (e.g. exports) extend the base schema with their own discriminator variant.

### SyncService (`apps/main/src/sync/`)

Responsible for creating and executing `TaskSyncJob` documents.

**`createJob({ userId, source })`**
- Creates a `TaskSyncJob` with `status: queued`
- Kicks off async execution (no await), returns `jobId`

**Async sync execution:**
1. Set `status: running`, `stage: fetching` — emit WS progress
2. Call `connector.fetchTasks(tokens)` via `ConnectorsService.getDecryptedTokens` + `ConnectorRegistry`
3. Set `stage: upserting` — emit WS progress
4. For each remote task: upsert if `updatedAt <= syncedAt` (no local CTM changes), else increment `skipped`
5. Update `ConnectorConfig.lastSyncedAt`
6. Set `status: done`, emit final WS progress

On any thrown error: set `status: failed`, `error: message`, emit WS progress.

**CTM-priority upsert logic:**
- Match on `{ userId, source, sourceId }`
- If no existing doc → insert
- If existing and `updatedAt <= syncedAt` → update title, description, priority, dueDate, status, tags from remote; set `syncedAt: now`
- If existing and `updatedAt > syncedAt` → skip (local CTM change takes priority)

**`getJob({ userId, jobId })`** — returns job, throws 403 if `userId` mismatch.

**`cancelJob({ userId, jobId })`** — sets `status: cancelled` if `queued` or `running`. Running jobs check a cancellation flag before each stage.

### New Endpoints on `ConnectorsController`

```
POST   /connectors/:source/sync          → { jobId }
GET    /connectors/:source/sync/:jobId   → TaskSyncJobDto
DELETE /connectors/:source/sync/:jobId   → 204
```

All routes guarded by `CombinedAuthGuard`.

### SyncGateway (`apps/main/src/sync/sync.gateway.ts`)

Socket.io WS gateway. On client connect, authenticates via JWT in handshake and joins room `user:<userId>`.

Emits `sync:progress` events with the full `TaskSyncJobDto` payload after each stage write.

---

## Frontend

### API Client additions (`packages/api-client`)

```ts
syncConnector({ source })             // POST /connectors/:source/sync → { jobId }
getSyncJob({ source, jobId })         // GET  /connectors/:source/sync/:jobId
cancelSyncJob({ source, jobId })      // DELETE /connectors/:source/sync/:jobId
```

### SourcesPage (`apps/web/src/pages/SourcesPage.tsx`)

- Opens a socket.io-client connection on mount, authenticated with the access token
- Joins `user:<userId>` room
- Listens for `sync:progress` events; updates a `Map<source, TaskSyncJobDto>` in state
- On job `status: done` → `qc.invalidateQueries(['tasks'])` + refetch connectors query (updates `lastSynced`)
- Passes `syncJob` and `onSync` down to each `SourceCard`
- `syncMutation` calls `syncConnector`, stores returned `jobId` per source

### SourceCard (`apps/web/src/components/sources/SourceCard.tsx`)

New props:
```ts
onSync: (source: string) => void
syncJob?: TaskSyncJobDto
```

**When connected and no active sync job:** shows a "Sync" button alongside Disconnect.

**When `syncJob.status` is `queued` or `running`:**
- Progress bar (indeterminate) with stage label (`Fetching…` / `Upserting…`)
- Cancel button calls `cancelSyncJob`

**When `syncJob.status` is `done`:** brief success state, then resets.

**When `syncJob.status` is `failed`:** inline error message, sync button re-appears.

**When `syncJob.status` is `cancelled`:** sync button re-appears immediately.

Each connector tracks its own job independently — no shared pending state.

---

## Error Handling

- Connector fetch errors (bad tokens, network) → job `status: failed`, error shown inline on card
- WS disconnect → client reconnects automatically (socket.io default); last job state fetchable via `GET` poll as fallback
- Cancel on already-done job → 409, UI ignores

---

## Out of Scope

- Pushing CTM task changes to external systems
- Automatic background sync (that's the sync worker, not this feature)
- Granular per-task progress (stages are coarse: fetching / upserting)
- Job history UI
