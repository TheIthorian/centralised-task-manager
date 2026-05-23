# notifications

User notification module for `apps/main`.

## Responsibilities

- **Fan-out** — `NotificationsService.send` reads the user's per-trigger channel preferences and dispatches to each enabled channel.
- **Channels** — `InAppChannel` (persists to DB), `EmailChannel` (placeholder), `DiscordChannel` (DM via bot token).
- **Discord auth recovery** — if Discord delivery fails with `DiscordAuthExpiredError`, an in-app `connector_reconnect` notification is sent instead.
- **Preference management** — `NotificationsController` exposes `GET/PATCH /notifications/preferences` for reading and updating per-trigger channel settings.

## Notification types

| Type                  | Trigger key          | Default channels |
| --------------------- | -------------------- | ---------------- |
| `reminder`            | `reminder`           | in-app           |
| `upcoming_deadline`   | `upcomingDeadline`   | in-app           |
| `connector_reconnect` | `connectorReconnect` | in-app           |
| `daily_summary`       | `dailySummary`       | in-app           |

## Schema

`Notification` (`notifications` collection) — stores in-app notifications with a `read` flag.

## Channel defaults

All channels default to `{ inApp: true, discord: false, email: false }` when no user preference is stored.
