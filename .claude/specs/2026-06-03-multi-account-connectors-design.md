# Multi-Account Connectors — Design

**Date:** 2026-06-03
**Status:** Approved (design), pending implementation plan
**Scope:** Pull + UI only. Push/write-back to specific accounts is a later spec.

## Goal

Let a user connect any number of accounts per connector source (e.g. 3 Google
accounts, 2 Notion accounts). The Sources UI shows a per-source group listing the
connected accounts (by email/label) with a "+ Add account" action. The backend
tracks each account by its external account id, pulls tasks from all of them, and
each task remembers which account it came from.

## Current State (constraints)

- `ConnectorConfig` schema: one document per `(userId, source)`, enforced by a
  unique index `{ userId: 1, source: 1 }`. This is a hard singleton today.
- `Task` schema: unique index `{ userId, source, sourceId }`. No notion of which
  account a task came from.
- `ConnectorsService`, `SyncService`, and the connectors controller key nearly
  every operation by `(userId, source)` — `ensureFreshTokens`, `getSettings`,
  `getDecryptedTokens`, `updateLastSyncedAt`, `getConfigIdBySource`,
  `removeBySource`, `handleCallback` (upsert by `{userId, source}`).
- `TaskSyncJob` schema is keyed by `source` only.
- `OAuthConnector` interface has no way to resolve the external account identity.
- Web `SourceCard` renders one card per source with a single Connect/Disconnect.

## Decisions

| Topic | Decision |
| --- | --- |
| Account key | Provider's stable **external account id**, with email/label captured for display. |
| Task linkage | Task stores **`externalAccountId`** (provider id string), not internal FK. |
| Push (write-back) | **Out of scope** for this spec. |
| Migration | **Lazy backfill on next sync** — no migration script. |
| Re-auth same account | **Update in place**, deduped by `externalAccountId`. No duplicate row. |

## Data Model Changes

### Connection (was `ConnectorConfig`)

Keep the class/collection but generalise from singleton to per-account. Add:

- `externalAccountId: string` — provider's stable account id (required after backfill).
- `email: string | null` — account email for display.
- `label: string | null` — human label (e.g. Notion workspace name) when no email.

Index changes:

- **Drop** unique `{ userId: 1, source: 1 }`.
- **Add** unique `{ userId: 1, source: 1, externalAccountId: 1 }`.
- Keep `{ userId: 1 }` for listing.

> Rename is optional; the class may stay `ConnectorConfig` to limit churn. The
> implementation plan decides. Referred to here as "Connection".

### Task

- Add `externalAccountId: string` (required after backfill).
- **Drop** unique `{ userId, source, sourceId }`.
- **Add** unique `{ userId, source, externalAccountId, sourceId }`.

## Connector Interface Change

Add to `OAuthConnector`:

```ts
/** Resolve the external account identity for a freshly-connected token set. */
resolveAccountIdentity(tokens: OAuthTokens): Promise<{
    externalAccountId: string;
    email?: string;
    label?: string;
}>;
```

Per-connector implementation:

- **Google Tasks:** add `openid email` to the auth scope; call the userinfo
  endpoint (or `tokeninfo`) to read `sub` (→ externalAccountId) and `email`.
- **Notion:** the token exchange response already returns `workspace_id`,
  `workspace_name`, and `owner.user.person.email`. Use `workspace_id` (or bot/user
  id) as externalAccountId, `workspace_name` as label, email when present. Requires
  surfacing those fields from `exchangeCode` (extend `NotionTokenResponse` plumb).
- **Todoist:** GET the Todoist user → `id` (→ externalAccountId) and `email`.

`handleCallback` calls `resolveAccountIdentity`, then upserts keyed by
`{ userId, source, externalAccountId }`, setting email/label and tokens.

## Service / Sync Rework

Re-key per-account operations from `source` to a **connection** (by `connectionId`
or `{ source, externalAccountId }`):

- `ensureFreshTokens`, `getDecryptedTokens`, `getSettings`, `updateLastSyncedAt`
  take a connection identifier instead of just `source`.
- `removeBySource` → `removeConnection(connectionId)`.
- `listConfigs` stays (lists all connections for the user).
- New helper: `listConnectionsForSource({ userId, source })`.

`SyncService`:

- `createJob` takes a `connectionId` (one job per account). `TaskSyncJob` schema
  gains `connectionId` (and keeps `source` for display).
- `runSync` loads tokens/settings for that connection, fetches, and upserts with
  the connection's `externalAccountId` stamped on each task.
- Health-check and any "sync all" iterate over every connection of every source.

`TasksService.upsertFromRemote` gains `externalAccountId` and stamps it on each
upserted task; uniqueness now includes it.

## API + Web

### API (`@ctm/api-client` types first, then controller)

- `GET /connectors` returns sources, each with an `accounts[]` array:
  `{ connectionId, externalAccountId, email, label, lastSynced, setupRequired }`.
- Health stays but is reported per connection.
- Sync / disconnect / set-connection-details / configure now take `connectionId`.
- Add-account = existing `GET /connectors/:source/auth` (returns OAuth URL); the
  "+" button just reuses it. OAuth callback creates/updates by externalAccountId.

### Web

- `SourcesPage` groups by source.
- `SourceCard` becomes a **source group**: header (source name/icon) + a row per
  connected account (email/label, last synced, Sync, Configure, Disconnect) + a
  "+ Add account" button that triggers the OAuth URL flow.
- Sync job tracking keyed by `connectionId` instead of `source`.

### MCP / CLI

Connection-scoped tools (`sync_connector`, `disconnect_connector`,
`set_connection_details`, `get_connector_health`, `list_connectors`) updated to
accept/return `connectionId` and list accounts. (CLI/MCP parity per existing
project rule; can be a follow-up task if the plan splits it.)

## Migration (lazy backfill)

- Drop the old unique indexes; add the new ones (sparse/partial while
  `externalAccountId` may be absent on legacy rows).
- On a connection's next OAuth refresh or sync, call `resolveAccountIdentity` and
  fill `externalAccountId` + email/label.
- Backfill each legacy task's `externalAccountId` from its source's single
  connection during that connection's next `upsertFromRemote` run.
- No standalone migration script.

## Error Handling

- Use typed errors from `@ctm/errors` (no raw `throw new Error`).
- `resolveAccountIdentity` failure during callback → surface a connect error
  (redirect with `error=` like today); do not create a half-keyed row.
- Unique-index violation on re-auth is expected → treated as update-in-place via
  upsert on `{ userId, source, externalAccountId }`.

## Testing

- Integration tests against the real DB (per project rules), unique ids via
  `Date.now()`, no cleanup.
- New tests: two connections same source pull into distinct tasks; re-auth same
  account dedups (no second row); task `externalAccountId` correctly stamped and
  enforced by the unique index; lazy backfill fills legacy rows/tasks.
- Per-connector `resolveAccountIdentity` unit tests (mock provider HTTP).

## Out of Scope

- Push / write-back routing to a specific account.
- Renaming accounts manually in the UI.
- Cross-account dedup of identical tasks.
