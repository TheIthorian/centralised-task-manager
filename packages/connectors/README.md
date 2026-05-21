# @ctm/connectors

`TaskConnector` interface and concrete adapters for Todoist and Google Tasks.

## Exports

- `TaskConnector` — interface all adapters implement
- `ConnectorRegistry` — maps source names to adapter instances
- `TodoistConnector`
- `GoogleTasksConnector`
- Shared DTOs: `RemoteTask`, `OAuthTokens`, `CreateTaskDto`, `UpdateTaskDto`

## TaskConnector Interface

```ts
interface TaskConnector {
    readonly source: string;
    getAuthUrl(userId: string): string;
    exchangeCode(code: string): Promise<OAuthTokens>;
    refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;
    fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]>;
    createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask>;
    updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask>;
    completeTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
    deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
}
```

## Adding a New Connector

1. Create `src/<name>/<name>.connector.ts` implementing `TaskConnector`
2. Export it from `src/index.ts`
3. Register it in `ConnectorRegistry`
