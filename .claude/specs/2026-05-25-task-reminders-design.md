# Task Reminders — Design Spec

**Date:** 2026-05-25

## Overview

Add point-in-time reminder notifications for tasks. Users can attach one or more explicit reminder datetimes to any task (synced or native). The task's `dueDate` also triggers a notification at its exact datetime. Both fire via the existing in-app and Discord notification channels.

---

## Data Model

### Task schema additions (`apps/main/src/tasks/schemas/task.schema.ts`)

New `Reminder` subdocument:

```ts
@Schema({ _id: false })
class Reminder {
    @Prop({ type: Date, required: true })
    remindAt: Date; // exact UTC datetime to fire

    @Prop({ type: Date, default: null })
    firedAt: Date | null; // set to now after notification is sent; prevents re-fire
}
```

New fields on `Task`:

```ts
@Prop({ type: [ReminderSchema], default: [] })
reminders: Reminder[]

@Prop({ type: Date, default: null })
dueDateNotifiedAt: Date | null   // set after due-date notification fires
```

MongoDB index added: `{ 'reminders.remindAt': 1, 'reminders.firedAt': 1 }` and `{ 'dueDate.date': 1, dueDateNotifiedAt: 1 }` to support efficient 5-minute window queries.

### API-client types (`packages/api-client/src/types.ts`)

```ts
export type ReminderDto = {
  remindAt: string        // ISO datetime
  firedAt: string | null
}

// TaskDto gains:
reminders: ReminderDto[]
dueDateNotifiedAt: string | null
```

`dueDate.date` remains an ISO string — the UI now always sends a full datetime (with time component) rather than a date-only string.

---

## API Endpoints

Two new endpoints on `TasksController`:

| Method   | Path                          | Body                   | Response      |
| -------- | ----------------------------- | ---------------------- | ------------- |
| `POST`   | `/tasks/:id/reminders`        | `{ remindAt: string }` | `ReminderDto` |
| `DELETE` | `/tasks/:id/reminders/:index` | —                      | `OkDto`       |

- `POST` appends a new `Reminder` subdoc (`firedAt: null`) and returns it.
- `DELETE` removes by array index. Returns `{ ok: true }`.
- Both require auth and verify task ownership.

Request DTO (`AddReminderDto`):

```ts
export class AddReminderDto implements IAddReminderDto {
    @IsISO8601()
    remindAt: string;
}
```

---

## Trigger / Cron

`RemindersService` (`apps/main/src/reminders/reminders.service.ts`) gains a second cron method alongside the existing daily 9am job:

```
@Cron('*/5 * * * *')
async runPointInTimeReminders(): Promise<void>
```

### Manual reminders

Query: tasks where **any** `reminders` element has `remindAt` in `[now - 5min, now]` and `firedAt` is null.

For each matching task+reminder pair:

1. Call `NotificationsService.send({ userId, type: 'reminder', title: 'Reminder', body: task.title })`.
2. Update that specific reminder's `firedAt = now` atomically using `$set` with positional operator.

### Due-date reminders

Query: tasks where `dueDate.date` is in `[now - 5min, now]` and `dueDateNotifiedAt` is null.

For each match:

1. Call `NotificationsService.send({ userId, type: 'reminder', title: `${task.title} is due`, body: '' })`.
2. Set `dueDateNotifiedAt = now`.

Both paths use the existing `NotificationsService.send()` which fans out to all channels (in-app + Discord) per user preferences. No new notification type needed — `'reminder'` is already defined.

---

## UI Changes (`apps/web`)

### Due date input

Upgrade from `<input type="date">` to `<input type="datetime-local">` wherever due date is editable. The full ISO datetime is sent to the API.

### Reminders section (task edit form/drawer)

Below the due date field, add a "Reminders" section:

- Lists existing reminders as datetime pills with a delete (×) button each.
- "Add reminder" button renders a `<input type="datetime-local">` inline; on confirm calls `POST /tasks/:id/reminders`.
- Delete button calls `DELETE /tasks/:id/reminders/:index`.
- `firedAt` reminders shown with a muted style (already fired).

No new routes or pages — this lives inside the existing task edit UI.

---

## Error Handling

- `POST /tasks/:id/reminders` with a past `remindAt` is accepted (no validation error) — the 5-min window will never catch it, so it simply never fires. A future enhancement could warn the user.
- If `NotificationsService.send()` throws, the cron logs the error and continues to the next task (existing `safeRun` pattern handles per-channel failures).
- Atomic `firedAt` update uses MongoDB's positional `$` operator to avoid race conditions if the cron overlaps.

---

## Testing

- Unit tests for `runPointInTimeReminders`: mock `taskModel.find` to return tasks in/out of the 5-min window; assert `notifications.send` call count and `firedAt` update.
- Integration tests: insert a task with `remindAt = now`, run the method, assert a `Notification` document is created and `firedAt` is set.
- Controller tests for `POST` / `DELETE` reminder endpoints.
- Existing reminder cron tests are unaffected.
