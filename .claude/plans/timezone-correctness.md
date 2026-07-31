# Plan: timezone correctness

Spec: `.claude/specs/timezone-correctness.md`. Issue #46.

## 1. `packages/time` (`@ctm/time`)

Intl-backed, dependency-free, no local-clock reads.

- `isValidTimeZone(timeZone)`, `assertTimeZone(timeZone)` (throws `ValidationError` from `@ctm/errors`)
- `zonedParts({ instant, timeZone })`
- `toDateKey({ instant, timeZone })`, `parseDateKey(key)`
- `startOfDayInZone({ instant, timeZone })`, `startOfWeekInZone`, `endOfWeekInZone`
- `instantFromZonedWallClock({ dateKey, hour, minute, timeZone })` (DST-safe, two-pass offset solve)
- `addDaysInZone({ instant, days, timeZone })`
- `differenceInDaysInZone({ from, to, timeZone })`
- `zonedHour`, `zonedWeekday`
- `UTC` constant

Specs cover DST forward/backward gaps, UTC+14 / UTC-11 day boundaries, and leap years.

## 2. Wire contract (`packages/api-client`)

- `DueDate.allDay: boolean`
- `CreateTaskDto.due.allDay?`, `UpdateTaskDto.due.allDay?`
- `UserDto.timezone: string`
- `UpdateUserDto.timezone?: string`

## 3. `apps/main`

- `task.schema.ts`: `DueDate.allDay` (Boolean, default false).
- `user.schema.ts`: `timezone` (String, default `'UTC'`).
- `update-task.dto.ts`: `dueDateSchema.allDay`; new shared `timeZoneSchema` in `param-schemas.ts`
  that validates an IANA id.
- `update-user.dto.ts`: `timezone` optional.
- `user.dto.ts` + everywhere a `UserDto` is built (users controller, auth service, oauth service):
  carry `timezone`.
- `users.service.update`: persist `timezone`.
- `tasks.service`: `parseDueFields` carries `allDay`; `list()` computes `today` / `upcoming` /
  `surfaced` boundaries in the owner's zone via `UsersService`.
- `tasks.controller`: map `allDay` out.
- `reminders.service`: daily cron becomes hourly and fires per user at 09:00 local; all-day due-date
  reminders fire at 09:00 local rather than on the stored UTC instant.

## 4. `packages/connectors`

- `RemoteTask.due.allDay`.
- Todoist: date-only `due.date` is all-day, pinned to UTC midnight.
- Google Tasks: `due` is always a date, so always all-day.

## 5. `apps/web`

- `lib/timezone.ts`: `useTimeZone()` (user profile, browser fallback) + `dueDateKey(task, tz)`.
- `bucket-tasks`, `calendar-range.toDateKey`, `format-task`, `snooze` take an explicit `timeZone`.
- `AuthContext` pushes the browser zone to the server when it differs from the stored one.
- Call sites: `GroupedTaskList`, `CalendarPage`, `CalendarMonth`, `CalendarColumns`, `TaskCard`,
  `TasksPage`.

## 6. Tests under a fixed TZ

`TZ=Pacific/Kiritimati` (UTC+14) in the vitest configs for `apps/web`, `apps/main`, `packages/time`
and `packages/connectors`, so nothing can pass by accident on a UTC machine.
