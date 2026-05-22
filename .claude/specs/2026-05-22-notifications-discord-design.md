# Notification Service + Discord Integration — Design Spec

**Date:** 2026-05-22  
**Status:** Approved

## Overview

A channel-agnostic notification system for `apps/main`. Triggers call `NotificationService.send()` directly with a typed payload. The service fans out to enabled channel adapters after checking per-user, per-trigger preferences.

Channels: in-app inbox (DB), Discord (OAuth bot DM), email (mock/log only).

Triggers: connector reconnect needed, daily summary, upcoming deadlines, reminders.

## Architecture

```
apps/main/src/notifications/
  notifications.module.ts
  notifications.service.ts          # fan-out + preference gating
  channels/
    in-app.channel.ts               # writes Notification doc to MongoDB
    discord.channel.ts              # sends DM via Discord bot OAuth
    email.channel.ts                # mock — logs only
  schemas/
    notification.schema.ts          # in-app inbox documents
    discord-connection.schema.ts    # stored Discord OAuth token + user ID
  dto/
    send-notification.dto.ts        # typed notification payload
  notifications.controller.ts       # inbox + Discord OAuth + preferences endpoints
```

## Data Model

### Notification (in-app inbox)

```ts
{
  userId: ObjectId,
  type: 'connector_reconnect' | 'daily_summary' | 'reminder' | 'upcoming_deadline',
  title: string,
  body: string,
  read: boolean,    // default false
  createdAt: Date,
}
```

### DiscordConnection

```ts
{
  userId: ObjectId,   // unique index
  accessToken: string,  // encrypted at rest (same pattern as connector tokens)
  discordUserId: string,
  dmChannelId: string,  // cached after first DM open
}
```

### User.notificationPreferences (sub-document)

```ts
{
  triggers: {
    connectorReconnect: { inApp: boolean, discord: boolean, email: boolean },
    dailySummary:       { inApp: boolean, discord: boolean, email: boolean },
    reminder:           { inApp: boolean, discord: boolean, email: boolean },
    upcomingDeadline:   { inApp: boolean, discord: boolean, email: boolean },
  }
}
```

Defaults: `inApp: true`, `discord: false`, `email: false` for all triggers.

## API Endpoints

### In-app inbox
```
GET    /notifications              # paginated inbox (query: page, limit, unreadOnly)
PATCH  /notifications/:id/read     # mark single notification read
PATCH  /notifications/read-all     # mark all read for user
```

### Discord OAuth
```
GET    /notifications/discord/connect    # redirects to Discord OAuth consent
GET    /notifications/discord/callback   # exchanges code, stores token, redirects to web
DELETE /notifications/discord            # disconnect (removes DiscordConnection doc)
```

### Preferences
```
GET  /users/me/notification-preferences
PUT  /users/me/notification-preferences
```

## Discord OAuth Flow

Scopes: `bot` + `dm_channels` (or `identify` + `guilds` depending on bot setup — DM via `POST /users/@me/channels` requires a shared server or friend request workaround; use webhook-to-DM approach via bot token).

After callback:
1. Exchange code for access token
2. Fetch Discord user ID via `GET /users/@me`
3. Open DM channel: `POST /channels` with `recipient_id`
4. Store encrypted `accessToken`, `discordUserId`, `dmChannelId` in `DiscordConnection`

## Channel Adapter Behaviour

Each adapter implements:
```ts
interface NotificationChannel {
  send(userId: string, payload: NotificationPayload): Promise<void>;
}
```

`NotificationService` iterates adapters. Each adapter catches its own errors — a failed Discord send does not block the in-app write. Failures are logged at `warn` level.

Discord 401 (token expired): adapter logs warning, does NOT attempt refresh (Discord OAuth tokens expire; user must reconnect). A `connector_reconnect` in-app notification is emitted for the Discord connection.

## Trigger Integration

- `RemindersService.runDailyReminders()` → calls `notificationsService.send()` per user with type `daily_summary`
- `RemindersService` upcoming deadline check (new) → type `upcoming_deadline`
- `ConnectorsService` (on sync failure / token expiry) → type `connector_reconnect`

## Error Handling

- Channel failures are isolated; fan-out continues to remaining channels
- Discord token expiry triggers an in-app `connector_reconnect` notification
- All channel errors logged with `userId` and `channel` context; never re-thrown

## Testing

- **Unit — NotificationService:** mock all channel adapters; assert fan-out respects preference matrix
- **Unit — each channel adapter:** mock HTTP / Mongoose; assert correct calls
- **Integration — in-app channel:** real MongoDB; write notification, read via inbox endpoint, mark read
- **Discord + email:** HTTP calls mocked in unit tests; no integration test for external APIs
