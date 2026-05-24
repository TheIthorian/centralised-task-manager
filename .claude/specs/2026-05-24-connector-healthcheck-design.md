# Connector Healthcheck Design

**Date:** 2026-05-24  
**Status:** Approved

## Problem

Token expiry and revocation are only discovered during sync, causing unexpected errors and poor UX. Users have no indication that a connector needs attention until a sync fails.

## Goal

When a user visits the settings (Sources) page, proactively check the health of each connected connector and surface a warning if action is needed — before they attempt a sync.

---

## Architecture

### 1. `ensureFreshTokens()` — `ConnectorsService`

New shared method called before any external connector request.

- Reads `tokenExpiresAt` from the stored `ConnectorConfig`
- If expiry is within 5 minutes (or already expired), calls `connector.refreshToken(tokens)`
- Persists updated tokens + new `tokenExpiresAt` to MongoDB
- Returns fresh `OAuthTokens`

**Used by:** healthcheck endpoint + sync flow (both call this at the top of their execution).

---

### 2. `healthCheck()` — Connector Interface

New optional method added to `ExternalTaskSource` / `OAuthConnector`:

```ts
healthCheck(tokens: OAuthTokens, settings?: object): Promise<{ healthy: boolean; error?: string }>
```

Each connector implements a lightweight probe against its provider API:

| Connector     | Probe endpoint                  |
|---------------|---------------------------------|
| Todoist       | `GET /projects` (or `/user`)    |
| Google Tasks  | `GET /users/@me/lists`          |
| Notion        | `GET /users/me`                 |

Returns `{ healthy: true }` on success, `{ healthy: false, error: string }` on any failure (401, network error, etc.).

---

### 3. `GET /connectors/health` — New Endpoint

**Auth:** JWT-protected (same as existing connector endpoints)

**Logic:**
1. Fetch all `ConnectorConfig` docs for the authenticated user where `connected = true`
2. For each config, in parallel (`Promise.allSettled`):
   a. Call `ensureFreshTokens(config)`
   b. Call `connector.healthCheck(freshTokens, config.settings)`
3. Return array of `ConnectorHealthDto`

**Response type** (defined in `packages/api-client/src/types.ts`):

```ts
type ConnectorHealthDto = {
  source: ConnectorName;
  healthy: boolean;
  error?: string;
}
```

**Error handling:** `Promise.allSettled` ensures one failing probe doesn't block others. A thrown error is treated as `healthy: false`.

---

### 4. Sync Flow — Proactive Refresh

At the top of the sync execution in `SyncService`, call `ensureFreshTokens(config)` before fetching tasks. This replaces any ad-hoc token usage. Ensures tokens are always fresh going into external calls.

---

### 5. Frontend — `SourcesPage` + `SourceCard`

**Load sequence:**
1. Page mounts → `GET /connectors` loads connector list (existing)
2. After connectors load → fire `GET /connectors/health` (non-blocking, separate fetch)
3. Health result stored in local state keyed by `source`

**Loading state:** While health fetch is in progress, the Sync button on connected cards shows a spinner/disabled state.

**`SourceCard` receives a `health` prop:**

| State | UI |
|---|---|
| `undefined` (not connected, or health pending) | Normal |
| `{ healthy: true }` | Normal |
| `{ healthy: false }` | Yellow warning badge + "Reconnect" button (replaces Sync) |

**`api-client` changes:**
- Add `ConnectorHealthDto` to `types.ts`
- Add `getConnectorHealth(): Promise<ConnectorHealthDto[]>` method to the API client class

---

## Data Flow

```
SourcesPage mounts
  → GET /connectors              (existing, fast)
  → render cards
  → GET /connectors/health       (new, lazy)
      ↓ backend: for each connected config
          ensureFreshTokens() → refresh if <5min to expiry
          connector.healthCheck() → live probe
      ↓ returns ConnectorHealthDto[]
  → update card UI (warning or normal)
```

---

## Out of Scope

- Automatic reconnection (user must click Reconnect)
- Caching health results between page visits
- Notification connectors (healthcheck applies to task sync connectors only, unless they also implement `healthCheck()`)
- Streaming/SSE health results
