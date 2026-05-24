# Grouped Task List Design

**Date:** 2026-05-24  
**Status:** Approved

## Summary

Add due-date section grouping to the Tasks page "All" filter view. Tasks are bucketed into labelled sections ordered by urgency, giving users immediate visual hierarchy without changing any existing filter behaviour.

## Sections (in order)

| Section | Criteria | Header colour |
|---|---|---|
| ⚠ Overdue | `due.date` < today (not completed) | Red chip |
| Today | `due.date` === today | Blue chip |
| This Week | `due.date` within current calendar week (Mon–Sun), after today | Black chip |
| Upcoming | `due.date` > end of current week | Black chip |
| No Date | no `due` field | Grey chip |

Tasks within each section are sorted ascending by `due.date` (no-date section has no defined order).

## Visual Design

Section headers use the **neobrutalist chip** style, matching existing card aesthetic:

```
border: 2px solid <colour>
box-shadow: 2px 2px 0 <colour>
padding: 3px 10px
font: 11px / 900 / uppercase / 0.08em tracking
```

Chip colours:
- Overdue: red background (`#fca5a5`), red border/shadow
- Today: blue background (`#bfdbfe`), blue border/shadow  
- This Week / Upcoming: white background, black border/shadow
- No Date: light grey background, grey border/shadow

Each chip shows a task count to the right (e.g. `Today 2`).

Sections with zero tasks are hidden entirely.

## Architecture

### New component: `GroupedTaskList`

File: `apps/web/src/components/tasks/GroupedTaskList.tsx`

Accepts the same props as `TaskList` (`tasks`, `onToggle`, `onEdit`). Internally:
1. Calls a pure helper `bucketTasks(tasks)` → `{ overdue, today, thisWeek, upcoming, noDate }`.
2. Renders each non-empty bucket as a section chip + flat list of `TaskCard` components.
3. Empty state (all buckets empty) renders the same yellow "No Tasks Here" block as `TaskList`.

### Helper: `bucketTasks`

File: `apps/web/src/lib/bucket-tasks.ts`

Pure function — no React, easily unit-tested. Uses `startOfDay`, `endOfWeek` comparisons against `new Date()`. All date comparisons are local-timezone (same as the existing `toLocaleDateString()` usage in `TaskCard`).

```ts
type TaskBuckets = {
  overdue: TaskDto[];
  today: TaskDto[];
  thisWeek: TaskDto[];
  upcoming: TaskDto[];
  noDate: TaskDto[];
};

export function bucketTasks(tasks: TaskDto[], now?: Date): TaskBuckets
```

`now` param makes it trivially testable without mocking.

### Change to `TasksPage`

When `filter === 'all'`, render `<GroupedTaskList>` instead of `<TaskList>`. All other filters keep `<TaskList>` unchanged.

```tsx
{!isLoading && !isError && (
  filter === 'all'
    ? <GroupedTaskList tasks={tasks} onToggle={...} onEdit={...} />
    : <TaskList tasks={tasks} onToggle={...} onEdit={...} />
)}
```

## Out of Scope

- Collapsible sections (not requested)
- Applying sections to filters other than "all"
- Dark mode chip variants (inherit existing dark mode patterns)

## Files Touched

| File | Change |
|---|---|
| `apps/web/src/components/tasks/GroupedTaskList.tsx` | New |
| `apps/web/src/lib/bucket-tasks.ts` | New |
| `apps/web/src/lib/bucket-tasks.spec.ts` | New (unit tests) |
| `apps/web/src/pages/TasksPage.tsx` | Switch on filter |
