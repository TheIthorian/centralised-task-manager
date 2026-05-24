# Notion Connector Design

**Date:** 2026-05-22

## Overview

Add a Notion connector to `packages/connectors` that imports tasks from a user-selected Notion task database. Follows the same `TaskConnector` interface as the existing Todoist and Google Tasks connectors, with full CRUD support.

Notion tasks live as pages inside a database. The standard Notion task database properties are: **Name** (title), **Status** (status type), **Due date** (date), **Assignee** (people — not synced), and optionally **Priority** (select) and **Tags** (multi_select).

---

## 1. Connector Package (`packages/connectors`)

### New files

- `src/notion/notion.connector.ts`
- `src/notion/notion.types.ts`

### Interface changes (`src/types.ts`)

Add `ConnectionField` and `ConnectionDetailsSchema` types:

```ts
type ConnectionField =
    | { type: 'text'; label: string; required?: boolean }
    | { type: 'remote_select'; label: string; required?: boolean; endpoint: string };

export type ConnectionDetailsSchema = Record<string, ConnectionField>;
```

Extend `TaskConnector`:

```ts
export interface TaskConnector {
    readonly source: string;
    readonly connectionDetailsSchema?: ConnectionDetailsSchema;
    getAuthUrl(userId: string): string;
    exchangeCode(code: string): Promise<OAuthTokens>;
    refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;
    fetchTasks(tokens: OAuthTokens, connectionDetails?: Record<string, unknown>): Promise<RemoteTask[]>;
    createTask(
        tokens: OAuthTokens,
        task: CreateTaskDto,
        connectionDetails?: Record<string, unknown>,
    ): Promise<RemoteTask>;
    updateTask(
        tokens: OAuthTokens,
        sourceId: string,
        patch: UpdateTaskDto,
        connectionDetails?: Record<string, unknown>,
    ): Promise<RemoteTask>;
    completeTask(tokens: OAuthTokens, sourceId: string, connectionDetails?: Record<string, unknown>): Promise<void>;
    deleteTask(tokens: OAuthTokens, sourceId: string, connectionDetails?: Record<string, unknown>): Promise<void>;
}
```

Existing connectors (Todoist, Google Tasks) ignore the new optional `connectionDetails` param — no behaviour change.

### `NotionConnector`

```ts
export class NotionConnector implements TaskConnector {
    readonly source = 'notion';

    readonly connectionDetailsSchema: ConnectionDetailsSchema = {
        databaseId: {
            type: 'remote_select',
            label: 'Task Database',
            required: true,
            endpoint: '/connectors/notion/databases',
        },
    };
}
```

**OAuth2:**

- Auth URL: `https://api.notion.com/v1/oauth/authorize`
- Token URL: `https://api.notion.com/v1/oauth/token` (Basic auth: `clientId:clientSecret`)
- Token response includes `access_token` and `refresh_token` but no `expires_in` — set `expiresAt` to 1 hour from exchange as a conservative default
- `refreshToken()` — POST to `/v1/oauth/token` with `grant_type: refresh_token`; response may omit `expires_in` so again default to 1 hour

**`listDatabases(tokens)`** (not on the interface, called directly by the backend):

- `POST /v1/search` with `{ filter: { value: 'database', property: 'object' } }`
- Returns `{ id: string; name: string }[]`

**Convention-based property mapping** (case-insensitive name lookup):

| Notion property     | Type           | RemoteTask field                                             |
| ------------------- | -------------- | ------------------------------------------------------------ |
| Title-type property | `title`        | `title`                                                      |
| `Status`            | `status`       | `status` — value matches `/done/i` → `'done'`, else `'open'` |
| `Due date`          | `date`         | `dueDate`                                                    |
| `Priority`          | `select`       | `priority` — High=3, Medium=2, Low=1, missing/other=null     |
| `Tags`              | `multi_select` | `tags`                                                       |

`sourceId` = Notion page ID.

**Write operations:**

- `createTask` — `POST /v1/pages` with `parent: { database_id: connectionDetails.databaseId }`
- `updateTask` — `PATCH /v1/pages/{pageId}`
- `completeTask` — PATCH page, set Status property to `"Done"`
- `deleteTask` — PATCH page with `{ archived: true }`

---

## 2. Backend (`apps/main`)

### Registration (`connectors.module.ts`)

Register `NotionConnector` using `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, and `REDIRECT_BASE_URL`.

### New endpoints (`connectors.controller.ts`)

| Method | Path                                     | Description                                                                    |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `GET`  | `/connectors/:source/connection-schema`  | Returns `connector.connectionDetailsSchema` (or `{}` if none)                  |
| `POST` | `/connectors/:source/connection-details` | Validates required fields against schema, stores in `ConnectorConfig.settings` |
| `GET`  | `/connectors/notion/databases`           | Calls `NotionConnector.listDatabases(tokens)`, returns `{ id, name }[]`        |

### OAuth callback

After a successful Notion OAuth exchange, redirect to:

- `{WEB_URL}/settings/sources?connected=notion&setup=required`

For connectors without `connectionDetailsSchema`, redirect as before:

- `{WEB_URL}/settings/sources?connected={source}`

### Sync service (`sync.service.ts`)

Fetch `config.settings` alongside tokens and pass as `connectionDetails` to all connector methods:

```ts
const tokens = await this.connectors.getDecryptedTokens({ userId, source });
const settings = await this.connectors.getSettings({ userId, source });
const remoteTasks = await connector.fetchTasks(tokens, settings);
```

`ConnectorsService` gets a new `getSettings({ userId, source })` method that returns `ConnectorConfig.settings`.

---

## 3. Web UI (`apps/web`)

After OAuth callback with `?setup=required`:

1. Detect `setup=required` query param in the sources settings page
2. Fetch `GET /connectors/:source/connection-schema`
3. Render a setup form:
    - `remote_select` fields call their `endpoint` to populate options
    - `text` fields render as plain text inputs
4. On submit → `POST /connectors/:source/connection-details`
5. On success → clear `setup=required`, show connector as connected

---

## 4. Testing

**`packages/connectors/src/notion/notion.connector.spec.ts`**

- `fetchTasks` maps all standard properties correctly
- Missing optional fields (Priority, Tags) → `null` / `[]`
- Status "Done" (case-insensitive) maps to `'done'`; other values map to `'open'`
- `completeTask` sends Status = "Done"
- `deleteTask` sends `{ archived: true }`
- `listDatabases` returns mapped `{ id, name }[]`

**`apps/main` connector service tests**

- `POST /connectors/:source/connection-details` with missing required field → 400
- `POST /connectors/:source/connection-details` with valid payload stores in `settings`

---

## 5. Environment Variables

Add to `.env.example`:

```
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
```

---

## Out of Scope

- Syncing page body content as task description (Notion page content requires separate block API calls) — `description` is always `null`
- Syncing the `Assignee` field
- Webhooks / real-time sync (polling via existing sync job is sufficient)
- Multiple databases per user
