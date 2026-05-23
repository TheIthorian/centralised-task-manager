# sync

On-demand task sync module for `apps/main`.

Syncing pulls tasks from an external source (e.g. Todoist) and upserts them into the local MongoDB, so the app has a fast local copy to query without hitting the connector API on every request.

## Responsibilities

- **Job lifecycle** — sync runs are tracked as persistent jobs so clients can poll or receive real-time progress, and so failed syncs are visible rather than silent.
- **Cancellation** — long-running syncs can be cancelled mid-flight, which matters when a user disconnects a source or triggers a fresh sync.
- **Real-time progress** — Socket.IO pushes stage transitions to the client so the UI can show live feedback without polling.
