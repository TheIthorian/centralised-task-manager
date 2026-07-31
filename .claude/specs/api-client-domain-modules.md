# Spec: api-client domain modules

Issue: #26

## Goal

`packages/api-client` holds one 527-line client class and one 378-line type file. Split both by
domain so a change to one domain touches one directory, and unrelated domains stop sharing a merge
surface.

## Layout

```
packages/api-client/src/
  http/
    api-client.error.ts     ApiClientError + ApiClientErrorOptions
    api-http-client.ts      ApiHttpClient: axios instance, request(), axios -> ApiClientError mapping
    http.types.ts           ApiClientOptions, RequestOptions, DomainClientOptions
  domains/
    shared.types.ts         DTOs with no single owner (OkDto)
    auth/                   auth.client.ts, auth.types.ts, auth.client.spec.ts
    tasks/
    connectors/
    sync/
    users/
    data-portability/
    notifications/
    app-config/
  client.ts                 CtmApiClient facade
  client.types.ts           re-export barrel
  types.ts                  re-export barrel
  index.ts                  unchanged public surface
```

## Domain ownership

| Domain           | Methods                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| auth             | login, register, refresh, logout, getAuthorizedApps, revokeAuthorizedApp                                                                                                           |
| tasks            | listTasks, getTask, createTask, updateTask, deleteTask, setTaskStatus, setFuzzyDeadline, removeFuzzyDeadline, addReminder, removeReminder, addRelation, removeRelation             |
| connectors       | listConnectors, getConnectorHealth, getConnectorAuthUrl, disconnectConnector, setConnectionDetails, listNotionDatabases, getDiscordConnectUrl, getDiscordStatus, disconnectDiscord |
| sync             | syncConnector, getSyncJob, cancelSyncJob                                                                                                                                           |
| users            | getMe, updateMe, deleteMe                                                                                                                                                          |
| data-portability | exportData, downloadExportFile, importData                                                                                                                                         |
| notifications    | listNotifications, markNotificationRead, markAllNotificationsRead, getNotificationPreferences, updateNotificationPreferences, testNotificationChannel                              |
| app-config       | getAppConfig                                                                                                                                                                       |

Each domain owns its response DTOs and its `*Params` request types in `<domain>.types.ts`.
Cross-domain type references are ordinary imports (an export envelope references notification and
task types).

## Decisions

1. **Flat method surface stays.** `CtmApiClient` becomes a facade holding one instance of each
   domain client and delegating. 68 files import `@ctm/api-client`; a nested `client.tasks.list()`
   surface is a separate, additive change.
2. **`index.ts` exports exactly the names it exports today**, in the same order, so no consumer
   changes. `types.ts` and `client.types.ts` stay as re-export barrels so any in-flight branch that
   edits them still resolves.
3. **Discord methods belong to connectors**, not notifications: their routes are under
   `/connectors/discord`. `testNotificationChannel` stays in notifications (`/notifications/...`).
4. **`OkDto` moves to `domains/shared.types.ts`.** It is a generic envelope with no single owner.
5. **`HealthDto` belongs to app-config**, alongside `AppConfigDto`: both describe the service rather
   than a user resource.
6. **`TestNotificationChannelParams` gets a name.** The method took an inline `{ channel: string }`;
   a named type matches every sibling and is structurally identical.

## Constraints

- Move only. No behaviour change, no signature change, no new dependency.
- The package stays a pure typed REST wrapper: no UI or browser concerns.
- `client.spec.ts` splits so each spec sits beside the code it covers.
- CLAUDE.md's "types must be defined in `packages/api-client/src/types.ts`" rule names the new
  per-domain location instead.
