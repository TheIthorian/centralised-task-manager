# @ctm/logger

Shared Pino logger factory.

## Usage

```ts
import { createLogger } from '@ctm/logger';

const logger = createLogger('MyService');
logger.info('started');
```

`createLogger(context)` returns a named `pino.Logger` instance. Pass the module or class name as `context` so log lines are scoped.
