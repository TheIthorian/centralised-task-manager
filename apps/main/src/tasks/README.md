# tasks

Task management module for `apps/main`.

## Responsibilities

- **CRUD with write-through** — create, update, delete operations call the appropriate connector first, then persist the result locally. Source `"local"` skips the connector entirely.
- **Status** — `setStatus` calls `connector.completeTask` for remote sources when marking done. Uncompleting is local-only (no connector method exists for it).
- **Fuzzy deadlines** — `setFuzzyDeadline` / `removeFuzzyDeadline` are local-only annotations (never written to the source).
- **Sync ingestion** — `upsertFromRemote` bulk-upserts tasks from a connector fetch. Tasks with local edits (`updatedAt > syncedAt`) are skipped to preserve user changes.
- **Filtering / pagination** — `list` supports `status`, `source`, `fuzzy`, and `surfaced` (tasks due today based on `remindEvery`).

## Schema

`Task` (`tasks` collection) — key fields:

| Field           | Notes                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| `source`        | Connector name or `"local"`                                                 |
| `sourceId`      | Remote task ID (stable across syncs)                                        |
| `status`        | `"open"` \| `"done"`                                                        |
| `fuzzyDeadline` | Local-only: `{ type, remindEvery }`                                         |
| `syncedAt`      | Set on every sync write; compared against `updatedAt` to detect local edits |

## Write-through pattern

```
create/update/delete
  └─ connector.createTask / updateTask / deleteTask  (skipped for source="local")
  └─ taskModel.create / findByIdAndUpdate / deleteOne
```

Sync writes use `timestamps: false` in `bulkWrite` so Mongoose does not bump `updatedAt`, preserving the local-edit signal.
