# CRUD Completeness + Calendar/Timeline Views

**Date:** 2026-05-21  
**Status:** Approved

## Overview

Four areas of work:
1. Replace `POST /tasks/:id/complete` with `PUT /tasks/:id/status` (bidirectional)
2. Wire fuzzy deadline set/remove into web client + UI
3. Expand the inline create form (description + due date)
4. Add Calendar and Timeline pages (custom, no new deps)

---

## 1. Backend — `PUT /tasks/:id/status`

### Remove
- `POST /tasks/:id/complete` controller method + `complete()` service method

### Add
`SetTaskStatusDto`:
```ts
export class SetTaskStatusDto {
  @IsIn(['open', 'done'])
  status: 'open' | 'done';
}
```

Controller:
```
PUT /tasks/:id/status  →  tasks.setStatus({ taskId, userId, dto })
```

Service `setStatus`:
- `status === 'done'` → mark task complete (set `completedAt`, `status: 'done'`)
- `status === 'open'` → mark task incomplete (clear `completedAt`, `status: 'open'`)

Response: `{ id, status }` (same shape as old complete response).

---

## 2. API Client (`@ctm/api-client`)

### Remove
- `completeTask({ id })` method and its param type

### Add
```ts
setTaskStatus({ id, status }: SetTaskStatusParams): Promise<TaskDto>
// PUT /tasks/:id/status  body: { status }

setFuzzyDeadline({ id, fuzzyDeadline }: SetFuzzyDeadlineParams): Promise<TaskDto>
// PATCH /tasks/:id/fuzzy-deadline  body: { fuzzyDeadline }

removeFuzzyDeadline({ id }: RemoveFuzzyDeadlineParams): Promise<TaskDto>
// DELETE /tasks/:id/fuzzy-deadline
```

`TaskDto` already has `fuzzyDeadline?: string` — no type changes needed.

### Types to add in `client.types.ts`
```ts
type SetTaskStatusParams = { id: string; status: 'open' | 'done' };
type SetFuzzyDeadlineParams = { id: string; fuzzyDeadline: string };
type RemoveFuzzyDeadlineParams = { id: string };
```

---

## 3. WebApiClient (`apps/web/src/api/web-api-client.ts`)

### Remove
- `completeTask` + `WebDeleteTaskParams` reuse for it

### Add
```ts
setTaskStatus({ id, status }): Promise<TaskDto>
setFuzzyDeadline({ id, fuzzyDeadline }): Promise<TaskDto>
removeFuzzyDeadline({ id }): Promise<void>
```

Add corresponding param types to `web-api-client.types.ts`:
```ts
type WebSetTaskStatusParams = { id: string; status: 'open' | 'done' };
type WebSetFuzzyDeadlineParams = { id: string; fuzzyDeadline: string };
type WebRemoveFuzzyDeadlineParams = { id: string };
```

---

## 4. UI Changes

### 4a. TasksPage — bidirectional status toggle

Replace `toggleMutation` (called `completeTask`) with `statusMutation` calling `setTaskStatus`.

Optimistic update in both directions:
- Checking → optimistically set `completed: true`
- Unchecking → optimistically set `completed: false`
- On error → rollback to previous state

`TaskList` / `TaskCard` `onToggle` already passes `(id, checked)` — no prop changes needed.

### 4b. AddTaskInline — expanded create form

Add two optional fields below the priority selector:
- **Description** — `<Input label="Description" />` (optional)
- **Due Date** — `<Input type="date" label="Due Date" />` (optional)

No source picker — hardcoded to `'local'` (unchanged).

### 4c. TaskModal — fuzzy deadline

Add a new section below the due date field:

```
Fuzzy Deadline  [text input: e.g. "end of week"]  [Set] [Remove]
```

- **Set**: calls `setFuzzyDeadline` mutation, updates cache entry
- **Remove**: calls `removeFuzzyDeadline` mutation, clears field
- Input pre-filled with `task.fuzzyDeadline ?? ''` on open
- Remove button disabled when no fuzzy deadline set

`onSave` / `onDelete` props unchanged. Add two new props:
```ts
onSetFuzzyDeadline: (id: string, value: string) => Promise<void>;
onRemoveFuzzyDeadline: (id: string) => Promise<void>;
isSettingFuzzy?: boolean;
isRemovingFuzzy?: boolean;
```

Corresponding mutations added in `TasksPage` and passed down.

### 4d. Navigation

Add two new nav items to `Sidebar` and `BottomTabs`:
- **Calendar** → `/calendar`
- **Timeline** → `/timeline`

---

## 5. CalendarPage (`/calendar`)

### Layout
Monthly grid: 7 columns (Sun–Sat), 5–6 rows. Header row shows day names. Each cell shows the date number and a list of task chips.

### Task placement
A task appears in the cell matching its `dueDate` **and/or** `fuzzyDeadline` (if both differ, show in both cells with distinct styling).

- `dueDate` chip: solid fill, task title truncated
- `fuzzyDeadline` chip: dashed border, title truncated

### Navigation
Prev/Next month buttons. "Today" button resets to current month. Month/year label in header.

### Interaction
Clicking a task chip opens `TaskModal` (reuse existing). No drag-and-drop for POC.

### Data
Reuses the existing `listTasks` query (filter: `'all'`). No new API calls.

---

## 6. TimelinePage (`/timeline`)

### Layout
Horizontally scrollable view. Fixed left column (~200px) shows task titles. Right side: scrollable canvas with a time axis at the top and a bar per task.

### Time axis
Spans from the earliest `createdAt` to the latest `dueDate` across all tasks (min window: 30 days). Day/week tick marks.

### Bars
Each task: bar from `createdAt` to `dueDate` (or today if no `dueDate`). Color-coded by priority (P1=red, P2=yellow, P3=grey, P4=grey). If a task has a `fuzzyDeadline`, draw a secondary dashed marker at that date.

### Interaction
Clicking a bar opens `TaskModal`. Horizontal scroll only; no zoom for POC.

### Data
Same `listTasks` query, filter: `'all'`.

---

## 7. Routing

Add to `App.tsx`:
```tsx
<Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
<Route path="/timeline" element={<ProtectedRoute><TimelinePage /></ProtectedRoute>} />
```

---

## Out of Scope (POC)

- Gantt view (deferred)
- Drag-and-drop to reschedule from calendar/timeline
- Task creation from calendar cells
- Zoom controls on timeline
- Source picker in create form
