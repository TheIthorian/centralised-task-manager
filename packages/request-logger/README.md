# @ctm/request-logger

HTTP request/response logging helpers and NestJS middleware built on `@ctm/logger` (Pino).

## Usage

### NestJS (Fastify)

```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestLoggingMiddleware } from '@ctm/request-logger';

@Module({})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    }
}
```

### Manual logging

```typescript
import { createRequestLogger, logRequest } from '@ctm/request-logger';

const logger = createRequestLogger('http');

logRequest({ logger, req: request.raw, status: 200, durationMs: 42 });
```

Each completed request logs structured fields (`method`, `url`, `status`, `durationMs`) at `info` for success and `warn` for status ≥ 400.
