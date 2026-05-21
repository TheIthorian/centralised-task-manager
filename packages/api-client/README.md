# @ctm/api-client

Typed HTTP client for `apps/main`. Used by `apps/web` and any other consumer of the CTM API.

## Usage

```ts
import { initClient, listTasks, createTask } from '@ctm/api-client';

initClient('http://localhost:3000');

const tasks = await listTasks({ status: 'open' });
```

Call `initClient(baseUrl)` once at app startup before any other calls. Auth tokens are managed internally via `tokenStore`.

## Exports

| Export                                                                        | Description                                        |
| ----------------------------------------------------------------------------- | -------------------------------------------------- |
| `initClient` / `getClient`                                                    | Initialise and retrieve the underlying HTTP client |
| `tokenStore`                                                                  | Access / set stored auth tokens                    |
| `login` / `register` / `refresh`                                              | Auth endpoints                                     |
| `listTasks` / `createTask` / `updateTask` / `deleteTask` / `setFuzzyDeadline` | Task endpoints                                     |
| `listConnectors` / `getConnectorAuthUrl` / `disconnectConnector`              | Connector endpoints                                |
| `getMe` / `updateMe` / `deleteMe`                                             | User profile endpoints                             |
