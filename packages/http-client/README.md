# @ctm/http-client

Thin Axios wrapper used by connector adapters to call external APIs.

## Usage

```ts
import { HttpClient } from '@ctm/http-client';

const client = new HttpClient({
    baseUrl: 'https://api.todoist.com/rest/v2',
    headers: { Authorization: `Bearer ${token}` },
});

const data = await client.get('/tasks');
```

Wraps Axios errors in `ExternalServiceError` from `@ctm/errors`.
