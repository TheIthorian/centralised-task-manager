# connectors

OAuth connector management module for `apps/main`.

## Responsibilities

- **Discovery** — `ConnectorsService.listAvailable` returns all registered connector source names from `ConnectorRegistry` (`@ctm/connectors`).
- **OAuth flow** — `getOAuthUrl` → redirect user to provider → `handleCallback` exchanges the code, encrypts tokens, and upserts a `ConnectorConfig` document.
- **Token storage** — All OAuth tokens are encrypted at rest via `EncryptionService` (AES-256-GCM, key from `ENCRYPTION_KEY`).
- **Config management** — `update` / `remove` allow enabling, disabling, and deleting connector configs.
- **Token access** — `getDecryptedTokens` is called by `TasksService` and `SyncService` to obtain live credentials.

## Controllers

| Controller             | Routes                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ConnectorsController` | `GET /connectors`, `GET /connectors/oauth-url`, `GET /connectors/callback`, `PATCH /connectors/:id`, `DELETE /connectors/:id` |
| `DiscordController`    | `GET /connectors/discord/oauth-url`, `GET /connectors/discord/callback`, `POST /connectors/discord/test`                      |

## Schemas

| Schema              | Collection                                                    |
| ------------------- | ------------------------------------------------------------- |
| `ConnectorConfig`   | `connectorconfigs` — per-user connector credentials and state |
| `DiscordConnection` | `discordconnections` — Discord bot DM channel for a user      |

## Supported connectors

Connectors are registered in `packages/connectors`. Currently: `todoist`, `google-tasks`.
Discord is a notification channel, not a task connector — its config lives in `DiscordConnection`.
