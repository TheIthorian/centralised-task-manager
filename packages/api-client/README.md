# @ctm/api-client

Typed HTTP client for `apps/main`. Used by `apps/web` and any other consumer of the CTM API.

## Usage

```ts
import { CtmApiClient } from '@ctm/api-client';

const client = new CtmApiClient({
    baseUrl: 'http://localhost:3000',
    accessToken: process.env.CTM_ACCESS_TOKEN ?? null,
    refreshToken: process.env.CTM_REFRESH_TOKEN ?? null,
});

const tasks = await client.listTasks({ filter: 'all' });
```

`@ctm/api-client` is intentionally pure: typed REST calls only. No cookies, redirects, toasts, or browser-only auth behavior live here.

## Exports

| Export           | Description                                    |
| ---------------- | ---------------------------------------------- |
| `CtmApiClient`   | Class-based typed wrapper for the CTM REST API |
| `ApiClientError` | Structured HTTP error with status/path/body    |
| DTO types        | Shared request/response types                  |
