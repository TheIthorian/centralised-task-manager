# notifications

User notification module for `apps/main`.

Notifications are in-app alerts, emails, or Discord DMs triggered by app events — reminders, upcoming deadlines, connector failures. This module decouples the events from the delivery: callers send a typed notification and this module routes it to whichever channels the user has configured.

## Responsibilities

- **Fan-out** — decouples the act of sending a notification from the delivery mechanism; callers emit a typed notification and this module routes it to whichever channels the user has enabled.
- **Channel abstraction** — in-app, email, and Discord are interchangeable delivery backends; adding a new channel doesn't require changing callers.
- **Preference management** — users control per-trigger channel settings (e.g. reminders via Discord, daily summary in-app only) so notifications stay relevant rather than noisy.
- **Auth recovery** — if a Discord delivery fails due to an expired token, an in-app reconnect prompt is sent automatically rather than silently dropping the notification.
