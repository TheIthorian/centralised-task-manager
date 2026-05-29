# Design: Fill API Client Gaps in CLI and MCP

**Date:** 2026-05-29

## Problem

14 public methods on `CtmApiClient` (packages/api-client) are not called by either `apps/cli` or `apps/mcp`. These are not account-management operations — they are legitimate task, connector, notification, and app-management features that users and AI agents should be able to access.

## Methods to Add

### Tasks
| Method | Params | Returns |
|---|---|---|
| `getTask` | `id` | `TaskDto` |
| `removeFuzzyDeadline` | `id` | `TaskDto` |
| `addReminder` | `id`, `remindAt: string (ISO)` | `ReminderDto` |
| `removeReminder` | `id`, `index: number` | `OkDto` |

### Connectors
| Method | Params | Returns |
|---|---|---|
| `getConnectorHealth` | — | `ConnectorHealthDto[]` |
| `syncConnector` | `source` | `TaskSyncJobDto` |
| `getSyncJob` | `source`, `jobId` | `TaskSyncJobDto` |
| `cancelSyncJob` | `source`, `jobId` | `void` |
| `setConnectionDetails` | `source`, `details: ConnectorDetailsDto` (JSON) | `void` |
| `listNotionDatabases` | — | `{ id, name }[]` |

### Notifications
| Method | Params | Returns |
|---|---|---|
| `getDiscordConnectUrl` | — | `string` |
| `testNotificationChannel` | `channel: string` | `TestChannelResultDto` |

### Authorized Apps (new domain)
| Method | Params | Returns |
|---|---|---|
| `getAuthorizedApps` | — | `AuthorizedAppDto[]` |
| `revokeAuthorizedApp` | `clientId` | `void` |

---

## CLI Design

All changes follow existing patterns in `apps/cli/src/commands/`.

### tasks.ts — new subcommands

- `ctm tasks get <id>` — print task as table row or `--json`
- `ctm tasks remove-fuzzy-deadline <id>` — print updated task
- `ctm tasks add-reminder <id> --remind-at <iso-datetime>` — print `ReminderDto` as JSON
- `ctm tasks remove-reminder <id> --index <n>` — print confirmation

### connectors.ts — new subcommands

- `ctm connectors health` — table: [Source, Healthy, Error]; `--json`
- `ctm connectors sync <source>` — print `TaskSyncJobDto` as JSON or table [ID, Source, Status, Stage, Synced, Skipped]
- `ctm connectors sync-status <source> <jobId>` — same output as sync
- `ctm connectors sync-cancel <source> <jobId>` — print confirmation
- `ctm connectors set-details <source> --details <json>` — parse JSON string, validate as `ConnectorDetailsDto` (Zod: `z.record(z.string(), z.unknown()).refine(v => !Array.isArray(v))`), print confirmation
- `ctm connectors notion-databases` — table: [ID, Name]; `--json`

### notifications.ts — new subcommands

- `ctm notifications discord connect` — print URL + open in browser (mirrors `ctm connectors connect`)
- `ctm notifications test <channel>` — print "Sent." or "Not sent."

### apps.ts — new file

New top-level command group `ctm apps`:
- `ctm apps list` — table: [Client ID, Name, Scopes, Authorized At]; `--json`
- `ctm apps revoke <clientId>` — print confirmation

### main.ts

Import and call `registerAppsCommand(program)`.

---

## MCP Design

All changes follow existing patterns in `apps/mcp/src/mcp/tools/`.

### tasks.tool.ts — new tools

- `get_task` — `{ id }` → JSON task; `readOnlyHint: true`
- `remove_fuzzy_deadline` — `{ id }` → JSON task; `idempotentHint: true`
- `add_reminder` — `{ id, remindAt: z.string() }` → JSON reminder
- `remove_reminder` — `{ id, index: z.number().int().min(0) }` → confirmation text

### connectors.tool.ts — new tools

- `get_connector_health` — `{}` → JSON array; `readOnlyHint: true`
- `sync_connector` — `{ source }` → JSON sync job; `idempotentHint: false`
- `get_sync_job` — `{ source, jobId }` → JSON sync job; `readOnlyHint: true`
- `cancel_sync_job` — `{ source, jobId }` → confirmation; `destructiveHint: true, idempotentHint: true`
- `set_connection_details` — `{ source, details: z.record(z.string(), z.unknown()) }` (Zod validates as plain object) → confirmation; `idempotentHint: true`
- `list_notion_databases` — `{}` → JSON array; `readOnlyHint: true`

### notifications.tool.ts — new tools

- `get_discord_connect_url` — `{}` → URL string; `readOnlyHint: true`
- `test_notification_channel` — `{ channel: z.string() }` → JSON `{ sent: boolean }`; `idempotentHint: false`

### apps.tool.ts — new file

- `list_authorized_apps` — `{}` → JSON array; `readOnlyHint: true`
- `revoke_authorized_app` — `{ clientId: z.string() }` → confirmation; `destructiveHint: true, idempotentHint: true`

### mcp.service.ts

Import `registerAppsTools` and call it alongside existing registrations.

---

## api-client Type Change

Add to `packages/api-client/src/types.ts`:
```ts
/** Connector-specific connection details (e.g. Notion database ID). */
export type ConnectorDetailsDto = Record<string, unknown>;
```

Update `SetConnectionDetailsParams` in `client.types.ts`:
```ts
export type SetConnectionDetailsParams = {
    source: string;
    details: ConnectorDetailsDto;
};
```

Export `ConnectorDetailsDto` from `packages/api-client/src/index.ts`.

CLI imports and validates with `z.record(z.string(), z.unknown())` before passing to the client.

---

## Error Handling

All CLI commands follow existing pattern: `catch (err: unknown) { console.error(...); process.exit(1); }`.

All MCP tools let errors propagate (SDK handles them).

## Testing

No new tests required — the existing integration test patterns cover the added surface only if new test files are explicitly requested.
