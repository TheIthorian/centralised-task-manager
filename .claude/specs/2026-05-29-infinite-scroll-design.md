# Infinite Scroll for Task Lists

**Date:** 2026-05-29  
**Status:** Approved

## Problem

The task list currently fetches at most one page (default 50) of tasks per filter. Users with many tasks — especially in the "done" column — only see a subset. All filters suffer from the same truncation.

## Scope

Add infinite scroll (scroll-triggered fetch) to all task list views:

- Flat list filters: **today**, **upcoming**, **done**
- Grouped **all** view: per-bucket independent pagination

Page size: **20 tasks per page**.

`hasNextPage` is inferred: if the last fetched page returned exactly `PAGE_SIZE` items, assume more exist.

---

## Layer 1 — Backend (`apps/main`)

### `ListTasksQueryDto` additions

| Param       | Type           | Description                             |
| ----------- | -------------- | --------------------------------------- |
| `dueBefore` | `string` (ISO) | Only tasks where `due.date < dueBefore` |
| `dueAfter`  | `string` (ISO) | Only tasks where `due.date >= dueAfter` |
| `noDate`    | `boolean`      | Only tasks with no `due.date` field     |

These work orthogonally to the existing `filter`, `status`, `page`, `limit` params.

### `TasksService.list()` changes

Apply the new params as additional Mongoose filter clauses after the existing `filter` switch:

```
if dueBefore → filter['due.date'] = { ...existing, $lt: new Date(dueBefore) }
if dueAfter  → filter['due.date'] = { ...existing, $gte: new Date(dueAfter) }
if noDate    → filter['due.date'] = { $exists: false }
```

No changes to existing filter values (`all`, `today`, `upcoming`, `done`).

---

## Layer 2 — API Client (`packages/api-client`)

### `ListTasksParams` additions

```ts
page?: number;
limit?: number;
status?: 'open' | 'done' | 'archived';
dueBefore?: string;
dueAfter?: string;
noDate?: boolean;
```

### `CtmApiClient.listTasks()`

Forward all new params as query string params. Return type stays `TaskDto[]`.

---

## Layer 3 — Flat List Filters (`today` / `upcoming` / `done`)

### `TasksPage`

Replace `useQuery` with `useInfiniteQuery`:

```ts
useInfiniteQuery({
  queryKey: ['tasks', filter],
  queryFn: ({ pageParam = 1 }) => api.listTasks({ filter, page: pageParam, limit: PAGE_SIZE, ... }),
  getNextPageParam: (lastPage, pages) =>
    lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined,
})
```

Flatten pages: `data.pages.flat()` → passed to `TaskList`.

Task count in the header shows total loaded so far (e.g. "40+ tasks" when more remain).

### `TaskList`

Add an `IntersectionObserver` sentinel `<div>` at the bottom. When it intersects the viewport, call `fetchNextPage()`. Accept new props:

```ts
hasNextPage?: boolean;
isFetchingNextPage?: boolean;
fetchNextPage?: () => void;
```

Render a "Loading more…" indicator while `isFetchingNextPage` is true. Render nothing extra when `!hasNextPage`.

---

## Layer 4 — Grouped `all` View

### `useGroupedTaskQueries` hook

Runs 5 independent `useInfiniteQuery` calls. Each query maps to a bucket:

| Bucket   | API params                                                        |
| -------- | ----------------------------------------------------------------- |
| overdue  | `status=open, dueBefore=todayStart`                               |
| today    | `filter=today`                                                    |
| thisWeek | `status=open, dueAfter=tomorrowStart, dueBefore=endOfWeekPlusOne` |
| upcoming | `status=open, dueAfter=endOfWeekPlusOne`                          |
| noDate   | `status=open, noDate=true`                                        |

Date boundaries are calculated in **local time** (matching `bucketTasks` logic) and converted to ISO strings before being passed to the API.

Returns per-bucket shape:

```ts
type BucketQueryResult = {
    tasks: TaskDto[];
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
};

type GroupedQueryResults = Record<'overdue' | 'today' | 'thisWeek' | 'upcoming' | 'noDate', BucketQueryResult>;
```

### `GroupedTaskList`

Two operating modes controlled by props:

1. **Legacy mode** (existing): accepts `tasks: TaskDto[]`, buckets client-side via `bucketTasks`. Used for edge cases / tests.
2. **Paginated mode** (new): accepts `groupedResults: GroupedQueryResults`. Renders each section from its query result directly, no client-side bucketing needed.

The Done section is always populated from the parent's optimistic-update task list (unchanged).

Each section renders a scroll sentinel at the bottom. When it enters the viewport the section's `fetchNextPage()` fires.

### `TasksPage` for `all` filter

```tsx
const groupedResults = useGroupedTaskQueries({ api });

<GroupedTaskList
  groupedResults={groupedResults}
  doneTasks={doneTasks}   // optimistic only
  highlightedTaskId={...}
  onToggle={...}
  onEdit={...}
/>
```

---

## Data Flow

```
TasksPage
  ├── filter != 'all' → useInfiniteQuery → TaskList (scroll sentinel per list)
  └── filter == 'all' → useGroupedTaskQueries
        ├── overdue query → GroupedTaskList overdue section (scroll sentinel)
        ├── today query   → GroupedTaskList today section (scroll sentinel)
        ├── thisWeek query→ GroupedTaskList thisWeek section (scroll sentinel)
        ├── upcoming query→ GroupedTaskList upcoming section (scroll sentinel)
        ├── noDate query  → GroupedTaskList noDate section (scroll sentinel)
        └── doneTasks     → GroupedTaskList done section (no pagination)
```

---

## Error Handling

- Per-query errors shown inline within the section, not as a full-page error.
- Existing page-level error handling for initial flat-filter load is preserved.
- Network errors during `fetchNextPage` are surfaced as a retry button inside the sentinel area.

---

## Mutations

Existing mutations (`statusMutation`, `saveMutation`, `deleteMutation`) work against React Query cache. With `useInfiniteQuery`, the cache key is `['tasks', filter]` for flat filters and `['tasks', 'grouped', bucket]` for grouped queries. Mutations must target the correct key:

- Flat filter mutations: update `['tasks', filter]` cache (existing behaviour, no change needed).
- Grouped mutations: update `['tasks', 'grouped', <bucket>]` for each potentially affected bucket, or invalidate the whole `['tasks', 'grouped']` key family.

The simplest safe strategy: on status/save/delete success, **invalidate** `['tasks', filter]` (flat) or `['tasks', 'grouped']` (all). This triggers a refetch rather than surgical cache patching — correct but causes a re-fetch. For the `all` view this is acceptable; optimistic status toggles still give instant UI feedback.

---

## Testing

- Unit tests for `useGroupedTaskQueries` (mock API, verify correct params per bucket).
- Unit tests for `bucketTasks` date boundary helpers used to compute `dueBefore`/`dueAfter`.
- `TaskList` scroll sentinel: test that `fetchNextPage` is called when sentinel enters viewport (mock IntersectionObserver).
- Backend: integration tests for new `dueBefore`, `dueAfter`, `noDate` query params.
- `GroupedTaskList` existing tests remain valid (legacy mode preserved).
