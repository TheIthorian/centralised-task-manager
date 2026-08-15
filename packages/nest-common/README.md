# @ctm/nest-common

Request validation and error translation shared by the NestJS apps.

## What lives here

- **`Validated*` decorators** — the only way a handler argument is read. A TS type is erased at
  compile time, so `@Body() body: SomeType` validates nothing; these name the schema at the call
  site so validation is visible without knowing anything about the DTO.
- **`createZodDto`** — builds a DTO class from a Zod schema. The class exists because Nest resolves
  handler parameter metatypes to classes and `@nestjs/swagger` reads property metadata off a class.
- **`HandlerValidationModule`** — audits every controller's route metadata on
  `onApplicationBootstrap` and refuses to start when an argument carries no validation pipe, so an
  unvalidated handler is a failed deploy rather than an open endpoint.
- **`AppErrorFilter`** — translates typed `@ctm/errors` into HTTP responses.
- **Shared schemas** — `objectIdSchema`, `requestObject`, `emailSchema` and friends.

## Using it

Install the filter and the audit in the app module, and provide `APP_LOGGER`:

```ts
import { APP_LOGGER } from '@ctm/request-logger';
import { AppErrorFilter, HandlerValidationModule } from '@ctm/nest-common';

@Module({
    // Last, so it audits every controller the modules above registered.
    imports: [/* ... */ HandlerValidationModule],
    providers: [
        { provide: APP_FILTER, useClass: AppErrorFilter },
        { provide: APP_LOGGER, useFactory: rootLogger },
    ],
})
export class AppModule {}
```

`AppErrorFilter` takes its logger from the container rather than importing one, because the root
logger is built from the environment of whichever app installs it.

## Conventions

- `requestObject` for app endpoints, plain `z.object` for protocol endpoints: `requestObject`
  rejects unrecognised keys, which app clients only send by mistake, while OAuth and MCP clients
  legitimately send parameters a server does not implement and must be stripped, not rejected.
- Bound every string with a `max`, and every array with a `max` length.
- A handler that genuinely validates its own input by a route the audit cannot see is marked
  `@UnvalidatedInput(reason)`, and the reason is required.
