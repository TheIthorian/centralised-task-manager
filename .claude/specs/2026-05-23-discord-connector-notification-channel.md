# Discord Connector & NotificationChannel — Design Spec

**Date:** 2026-05-23

## Overview

Move Discord OAuth logic into `packages/connectors` alongside existing connectors, introduce a `NotificationChannel<TConfig>` type, and consolidate Discord's separate `DiscordConnection` collection into the existing `connectorconfigs` collection.

---

## 1. New types in `packages/connectors/src/types.ts`

```ts
/** Config passed per-send to a notification channel. */
export type DiscordChannelConfig = {
    discordUserId: string;
    botToken: string;
    dmChannelId?: string | null;
};

/** Notification delivery contract. Generic over per-channel connection config. */
export type NotificationChannel<TConfig> = {
    readonly name: string;
    send(args: { config: TConfig; title: string; body: string }): Promise<void>;
};
```

`DiscordChannelConfig` is exported from the package so consumers can type their DB documents against it without importing the class.

---

## 2. `packages/connectors/src/discord/` — new directory

```
discord/
  discord.oauth.ts     — DiscordOAuthConnector implements OAuthConnector
  discord.channel.ts   — DiscordChannel implements NotificationChannel<DiscordChannelConfig>
  discord.types.ts     — Discord API response shapes
```

### `DiscordOAuthConnector`

Implements `OAuthConnector`. Config: `{ clientId, clientSecret, redirectUri, logger? }`.

- `getAuthUrl(state)` — scopes `identify bot`, `permissions=2048`
- `exchangeCode(code)` — exchanges code for Discord user OAuth tokens; returns `OAuthTokens`
- `refreshToken(tokens)` — standard refresh_token grant
- `resolveUserId(tokens: OAuthTokens): Promise<string>` — extra method; calls `GET /discord.com/api/v10/users/@me` with the access token, returns the Discord snowflake user ID

### `DiscordChannel`

Implements `NotificationChannel<DiscordChannelConfig>`. No constructor config needed (stateless).

- `send({ config, title, body })` — if `config.dmChannelId` is absent, opens a DM channel via `POST /users/@me/channels`, then sends `POST /channels/{id}/messages`. Pure `fetch`, no NestJS dependencies.
- Returns updated `dmChannelId` is NOT part of the interface — the caller is responsible for persisting the opened channel ID if desired. (The method could return `{ dmChannelId: string }` as a convenience — TBD at implementation time.)

---

## 3. `ConnectorConfig` schema changes (`apps/main`)

Add `internalSettings` field:

```ts
@Prop({ type: Object, default: {} })
internalSettings!: Record<string, unknown>;
```

`settings` — UI-readable and patchable (existing field).  
`internalSettings` — server-only; never included in API responses or serialized to the client.

### TypeScript discriminated union

```ts
type OAuthConnectorConfig = {
    source: 'todoist' | 'google_tasks' | 'notion';
    settings: Record<string, unknown>;
    internalSettings: Record<string, unknown>;
};

type DiscordConnectorConfig = {
    source: 'discord';
    settings: { discordUserId: string };
    internalSettings: { botToken: string; dmChannelId: string | null };
};

export type TypedConnectorConfig = ConnectorConfig & (OAuthConnectorConfig | DiscordConnectorConfig);
```

---

## 4. Discord connection flow (updated `apps/main`)

**`DiscordController.callback`:**

1. Verifies JWT state → `userId`
2. Calls `DiscordOAuthConnector.exchangeCode(code)` → `OAuthTokens`
3. Calls `DiscordOAuthConnector.resolveUserId(tokens)` → `discordUserId`
4. Upserts `ConnectorConfig` with:
    - `source: 'discord'`
    - `accessToken`, `refreshToken`, `tokenExpiresAt` from tokens
    - `settings: { discordUserId }`
    - `internalSettings: { botToken: <from ConfigService>, dmChannelId: null }`

**`DiscordChannel` in `apps/main` (NestJS wrapper):**

- Fetches `ConnectorConfig` where `{ userId, source: 'discord' }`
- Narrows to `DiscordConnectorConfig`
- Calls `packages/connectors` `DiscordChannel.send({ config: { discordUserId, botToken, dmChannelId }, title, body })`
- Persists updated `dmChannelId` back to `internalSettings` after first DM open

---

## 5. Cleanup

- Delete `apps/main/src/connectors/schemas/discord-connection.schema.ts`
- Remove `DiscordConnection` from `connectors.module.ts` and `notifications.module.ts`
- Update `index.ts` in `packages/connectors` to export new Discord classes and types
- Register `DiscordOAuthConnector` in the connector registry (if Discord is treated as an OAuth source)

---

## Out of scope

- Discord as an `ExternalTaskSource` (it is a notification channel only, not a task source)
- Migrating existing `DiscordConnection` records in MongoDB
