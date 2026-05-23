# @ctm/connectors

Connector interfaces and adapters for external task sources.

A connector bridges a third-party task service (Todoist, Google Tasks, Notion) to CTM. Each connector is split into two concerns:

- **`OAuthConnector`** — handles the OAuth flow (auth URL, code exchange, token refresh)
- **`ExternalTaskSource`** — handles task CRUD against the remote API

Keeping these separate means the OAuth flow and task operations can be composed or replaced independently.

## Supported connectors

| Connector    | OAuth | Task source |
| ------------ | ----- | ----------- |
| Todoist      | ✓     | ✓           |
| Google Tasks | ✓     | ✓           |
| Notion       | ✓     | ✓           |
| Discord      | ✓     | x           |

## Exports

- `OAuthConnector`, `ExternalTaskSource` — interfaces all adapters implement
- `OAuthConnectorRegistry`, `ExternalTaskSourceRegistry` — map source names to adapter instances
- Concrete adapters: `TodoistOAuthConnector`, `TodoistTaskSource`, `GoogleTasksOAuthConnector`, `GoogleTasksTaskSource`, `NotionOAuthConnector`, `NotionTaskSource`
- Shared DTOs: `RemoteTask`, `OAuthTokens`, `CreateTaskDto`, `UpdateTaskDto`

## Adding a new connector

1. Create `src/<name>/<name>.oauth.ts` implementing `OAuthConnector`
2. Create `src/<name>/<name>.source.ts` implementing `ExternalTaskSource`
3. Export both from `src/index.ts`
4. Register both in `OAuthConnectorRegistry` and `ExternalTaskSourceRegistry`
