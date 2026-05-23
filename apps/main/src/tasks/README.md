# tasks

Task management module for `apps/main`.

Tasks are the core data model — sourced either from a connected external service (Todoist, Google Tasks) or created locally. The module acts as the single write path for tasks: mutations go to the connector first (if applicable), then to the local DB, keeping both in sync without requiring a full re-fetch.

## Responsibilities

- **Write-through** — mutations are applied to the remote source first, then persisted locally, so the local DB stays consistent with the connector without requiring a full sync.
- **Fuzzy deadlines** — deadline annotations (e.g. "this week", remind daily) are local-only enrichment that external sources don't support, stored alongside synced tasks without touching the connector.
- **Sync ingestion** — bulk upserts from connector fetches skip tasks that have been locally edited since the last sync, so user changes aren't overwritten.
- **Filtering** — the `surfaced` filter delegates to `RemindersService` so task listing and reminder logic stay in sync.
