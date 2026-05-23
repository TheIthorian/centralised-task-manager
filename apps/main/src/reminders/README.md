# reminders

Scheduled reminder module for `apps/main`.

## Responsibilities

`RemindersService` runs a daily cron job at **09:00** that fans out three notification types:

1. **Task reminders** — finds open tasks where `fuzzyDeadline.remindEvery` is `"daily"` (or `"weekly"` on Mondays), groups by user, and sends a `reminder` notification listing the tasks.
2. **Upcoming deadlines** — finds open tasks with `fuzzyDeadline.type === "this_week"` and sends an `upcoming_deadline` notification.
3. **Connector reconnect alerts** — finds connector configs with a `lastError` set and sends a `connector_reconnect` notification listing the broken sources.

`getSurfacedTaskIds` is also exposed for use by `TasksService.list` when filtering by `surfaced=true` — returns task IDs that would be surfaced today.

## Schedule

Cron expression: `0 9 * * *` (09:00 every day, server timezone).

Uses `@nestjs/schedule` (`CronExpression` / `@Cron` decorator).
