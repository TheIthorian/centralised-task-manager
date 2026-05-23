# @ctm/errors

Shared typed error classes used across `apps/main`, `apps/sync`, and `packages/connectors`.

## Error Hierarchy

```
AppError (base — message, code, statusCode)
├── NotFoundError       (404)
├── UnauthorizedError   (401)
├── ConflictError       (409)
└── ExternalServiceError (502)
```

## Usage

```ts
import { NotFoundError, UnauthorizedError } from '@ctm/errors';

throw new NotFoundError('Task');
throw new UnauthorizedError('Invalid token');
```
