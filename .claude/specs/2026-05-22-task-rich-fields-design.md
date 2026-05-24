# Task Rich Fields — Design Spec

**Date:** 2026-05-22  
**Status:** Approved

## Overview

Add first-class support for four task features across CTM: parent/child tasks, exact deadlines, durations, and rich due dates (with timezone and recurrence). These are native CTM concepts — not connector-specific — and are written through to connectors where supported.

---

## 1. Data Model

### Task schema (`apps/main`)

| Field          | Type                                                                           | Notes                                                                     |
| -------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `due`          | `{ date: Date; timezone: string \| null; recurrence: string \| null } \| null` | Replaces `sourceDueDate`. `recurrence` is an RRULE string (RFC 5545).     |
| `deadlineDate` | `Date \| null`                                                                 | Hard must-complete-by date. Distinct from `due` and from `fuzzyDeadline`. |
| `duration`     | `{ amount: number; unit: 'minute' \| 'day' } \| null`                          | Estimated work time.                                                      |
| `parentId`     | `Types.ObjectId \| null`                                                       | Ref to another CTM `Task._id` belonging to same user.                     |

`sourceDueDate` is removed and replaced by `due`.

### RemoteTask (connectors package)

Replaces `dueDate: Date | null` with:

```ts
due: { date: Date; timezone: string | null; recurrence: string | null } | null
deadline: Date | null
duration: { amount: number; unit: 'minute' | 'day' } | null
parentSourceId: string | null
```

### API DTOs (`apps/main`)

`CreateTaskDto` and `UpdateTaskDto` gain:

```ts
due?: { date: string; timezone?: string; recurrence?: string }  // ISO date string
deadlineDate?: string   // ISO date string
duration?: { amount: number; unit: 'minute' | 'day' }
parentId?: string       // CTM MongoDB ObjectId — create only
```

`dueDate` is removed from both DTOs, replaced by `due`.

### Connector DTOs (connectors package)

`CreateTaskDto` and `UpdateTaskDto` gain:

```ts
due?: { date: Date; timezone?: string; recurrence?: string }
deadlineDate?: Date
duration?: { amount: number; unit: 'minute' | 'day' }
// no parentId — parent/child is CTM-only
```

---

## 2. Recurrence Model

CTM stores recurrence as RRULE strings (RFC 5545). Connectors translate to/from their native format.

### Todoist → RRULE (on sync)

A `TodoistRecurrenceTranslator` utility in the Todoist connector maps known patterns:

| Todoist string    | RRULE                              |
| ----------------- | ---------------------------------- |
| `"every day"`     | `FREQ=DAILY`                       |
| `"every monday"`  | `FREQ=WEEKLY;BYDAY=MO`             |
| `"every 2 weeks"` | `FREQ=WEEKLY;INTERVAL=2`           |
| `"every workday"` | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` |
| `"every month"`   | `FREQ=MONTHLY`                     |
| unknown           | `null` + log warning               |

### RRULE → Todoist (on write-through)

Translate structured RRULE back to a Todoist `due_string`. For patterns that don't have a clean mapping, pass the RRULE string directly as `due_string` — Todoist may accept or reject it; log a warning on rejection.

### Google Tasks

No recurrence support. If `due.recurrence` is set on a write-through, strip it and log a warning.

---

## 3. Sync Behaviour

### New fields

`upsertFromRemote` maps new fields straight through for both inserts and updates:

```
remote.due        → task.due
remote.deadline   → task.deadlineDate
remote.duration   → task.duration
```

### Parent/child on sync

`parentId` is **set on first insert only**. Subsequent syncs never touch it.

**Insert algorithm:**

1. Split batch into roots (`parentSourceId === null`) and children.
2. Upsert roots first; collect `sourceId → _id` map from results.
3. For each child, resolve `parentSourceId → parentId` using the map.
4. Upsert children with resolved `parentId`.
5. If parent not in batch (filtered out or not yet synced), set `parentId: null` — will not be retried.

`parentSourceId` is not stored on the CTM `Task` — only the resolved `parentId` ObjectId is persisted.

---

## 4. Create / Update Flow

### Creating a child task

`POST /tasks` accepts optional `parentId`. The service validates:

- Parent task exists in DB.
- Parent belongs to the same user.

If validation fails, reject with `400`. Connector receives no parent info.

### Updating parent/child

`parentId` cannot be changed via `PATCH /tasks/:id`. Parent is set at creation time only.

---

## 5. Connector Behaviour

### Todoist

| CTM field        | Todoist API field                         |
| ---------------- | ----------------------------------------- |
| `due.date`       | `due_date`                                |
| `due.recurrence` | `due_string` (translated from RRULE)      |
| `due.timezone`   | passed via `due_string` or `due_datetime` |
| `deadlineDate`   | `deadline.date`                           |
| `duration`       | `duration.amount` + `duration.unit`       |

`TodoistTask` type: `deadline` and `duration` typed properly (currently stubbed as `null`).

### Google Tasks

| CTM field        | Google Tasks field          |
| ---------------- | --------------------------- |
| `due.date`       | `due` (date only)           |
| `due.recurrence` | not supported — drop + warn |
| `due.timezone`   | not supported — drop        |
| `deadlineDate`   | not supported — drop + warn |
| `duration`       | not supported — drop + warn |

---

## 6. API Client (`packages/api-client`)

`TaskDto` gains new fields mirroring the schema:

```ts
due: { date: string; timezone: string | null; recurrence: string | null } | null
deadlineDate: string | null   // ISO date string
duration: { amount: number; unit: 'minute' | 'day' } | null
parentId: string | null       // CTM MongoDB ObjectId
```

`dueDate` removed from `TaskDto`, `CreateTaskDto`, and `UpdateTaskDto`. Replaced by `due`.

---

## 7. Web UI (`apps/web`)

### TaskCard

Display new fields beneath the title (where space allows):

- **Due date** — from `task.due.date` (replaces `task.dueDate`)
- **Recurring badge** — small "↻" indicator if `task.due.recurrence` is set
- **Deadline** — shown in red if `task.deadlineDate` is set
- **Duration** — shown as e.g. "90 min" or "2 days" if set

### TaskModal (edit)

Replace the single `Due Date` input with three new fields:

| Field           | Input type                                                 | Notes                     |
| --------------- | ---------------------------------------------------------- | ------------------------- |
| Due date        | `<input type="date">`                                      | Maps to `due.date`        |
| Recurrence      | `<select>` with common options + "Custom RRULE" text input | Maps to `due.recurrence`  |
| Deadline        | `<input type="date">`                                      | Maps to `deadlineDate`    |
| Duration amount | `<input type="number">`                                    | Maps to `duration.amount` |
| Duration unit   | `<select>` (minutes / days)                                | Maps to `duration.unit`   |

Recurrence select options: None, Daily, Weekly, Every weekday, Monthly, Yearly, Custom. "Custom" reveals a text input for raw RRULE.

### AddTaskInline / CreateTaskModal

Add `due.date`, `deadlineDate`, `duration`, and `parentId` inputs. `parentId` is an optional task picker (search existing tasks by title).

### Child task display

In `TaskList`, indent child tasks under their parent (group by `parentId`). If parent is not in the current filtered view, show child at root level.

---

## 8. CLI (`apps/cli`)

### `ctm tasks create`

New flags:

- `--due <date>` — ISO date (maps to `due.date`)
- `--recurrence <rrule>` — RRULE string (maps to `due.recurrence`)
- `--deadline <date>` — ISO date (maps to `deadlineDate`)
- `--duration <amount>` — number
- `--duration-unit <unit>` — `minute` or `day`
- `--parent <id>` — CTM task ID

### `ctm tasks update`

Same new flags as create (all optional).

### `ctm tasks list`

Table gains `Deadline` and `Duration` columns. `Due` column updated to read from `due.date`. Add `↻` suffix to due date if recurring.

---

## 9. MCP (`apps/mcp`)

### `create_task` tool

Add to input schema:

```ts
due: z.object({ date: z.string(), timezone: z.string().optional(), recurrence: z.string().optional() }).optional();
deadlineDate: z.string().optional();
duration: z.object({ amount: z.number(), unit: z.enum(['minute', 'day']) }).optional();
parentId: z.string().optional();
```

### `update_task` tool

Same additions as `create_task` (all optional).

### `list_tasks` tool

No schema change — output already includes full task JSON, which will naturally include new fields.

---

## 10. Out of Scope

- Reparenting tasks after creation.
- Cross-source parent/child (e.g. Todoist child under a local parent).
- Recurrence instance expansion (generating future occurrences).
