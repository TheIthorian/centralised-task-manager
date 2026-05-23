# jobs

Base job schema module for `apps/main`.

Provides the Mongoose `Job` base schema and `JobsModule`, which other modules extend via discriminators.

## Schemas

| Schema        | Collection                               | Notes                                                                                                                       |
| ------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Job`         | `jobs`                                   | Base discriminator — fields: `userId`, `status` (`queued` \| `running` \| `done` \| `failed` \| `cancelled`), `completedAt` |
| `TaskSyncJob` | `jobs` (discriminator key `TaskSyncJob`) | Extends `Job` with `source`, `stage`, `synced`, `skipped`, `error`                                                          |

`TaskSyncJob` is defined here because it is tightly coupled to the base `Job` model. The `SyncModule` injects it via `TASK_SYNC_JOB_MODEL` token.
