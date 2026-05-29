# Infinite Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add infinite scroll to all task list views — per-bucket for the grouped "all" view and single-feed for flat filters (today/upcoming/done).

**Architecture:** The backend gains `dueBefore`, `dueAfter`, and `noDate` query params so each date bucket can be fetched independently. The API client forwards these params. The web layer replaces `useQuery` with `useInfiniteQuery` (flat filters) and a new `useGroupedTaskQueries` hook (5 per-bucket queries for the all view). A reusable `ScrollSentinel` component uses IntersectionObserver to trigger the next page load.

**Tech Stack:** NestJS + Mongoose (backend), TanStack React Query v5 (`useInfiniteQuery`), React + TypeScript (web), Vitest (tests), pnpm workspaces + Turborepo.

---

## File Map

| File                                                | Status | Purpose                               |
| --------------------------------------------------- | ------ | ------------------------------------- |
| `apps/main/src/tasks/dto/list-tasks-query.dto.ts`   | Modify | Add `dueBefore`, `dueAfter`, `noDate` |
| `apps/main/src/tasks/tasks.service.ts`              | Modify | Apply new query params in `list()`    |
| `apps/main/src/tasks/tasks.controller.spec.ts`      | Modify | Integration tests for new params      |
| `packages/api-client/src/client.types.ts`           | Modify | Add fields to `ListTasksParams`       |
| `packages/api-client/src/client.ts`                 | Modify | Update `listTasks()`                  |
| `apps/web/src/components/tasks/ScrollSentinel.tsx`  | Create | IntersectionObserver scroll trigger   |
| `apps/web/src/components/tasks/TaskList.tsx`        | Modify | Add pagination props + sentinel       |
| `apps/web/src/hooks/useGroupedTaskQueries.ts`       | Create | 5 per-bucket `useInfiniteQuery` calls |
| `apps/web/src/components/tasks/GroupedTaskList.tsx` | Modify | Add paginated mode                    |
| `apps/web/src/pages/TasksPage.tsx`                  | Modify | Wire up infinite queries throughout   |

---

## Task 1: Backend — Add `dueBefore`, `dueAfter`, `noDate` query params

**Files:**

- Modify: `apps/main/src/tasks/dto/list-tasks-query.dto.ts`
- Modify: `apps/main/src/tasks/tasks.service.ts`

- [ ] **Step 1: Add new fields to `ListTasksQueryDto`**

Replace the end of `apps/main/src/tasks/dto/list-tasks-query.dto.ts` (after the existing `lastUpdatedFromDate` field) with:

```ts
    /** ISO date string — only tasks where due.date < dueBefore. */
    @ApiPropertyOptional({ example: '2026-05-30T00:00:00.000Z' })
    @IsOptional()
    @IsString()
    dueBefore?: string;

    /** ISO date string — only tasks where due.date >= dueAfter. */
    @ApiPropertyOptional({ example: '2026-05-29T00:00:00.000Z' })
    @IsOptional()
    @IsString()
    dueAfter?: string;

    /** When true, only return tasks with no due date. */
    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
    @IsBoolean()
    noDate?: boolean;
```

The full file after the edit should end with:

```ts
    @ApiPropertyOptional({ default: 1, example: 1 })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ default: 50, example: 50 })
    @IsOptional()
    @Type(() => Number)
    limit?: number = 50;

    /** ISO date string — only tasks where due.date < dueBefore. */
    @ApiPropertyOptional({ example: '2026-05-30T00:00:00.000Z' })
    @IsOptional()
    @IsString()
    dueBefore?: string;

    /** ISO date string — only tasks where due.date >= dueAfter. */
    @ApiPropertyOptional({ example: '2026-05-29T00:00:00.000Z' })
    @IsOptional()
    @IsString()
    dueAfter?: string;

    /** When true, only return tasks with no due date. */
    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
    @IsBoolean()
    noDate?: boolean;
}
```

- [ ] **Step 2: Apply new params in `TasksService.list()`**

In `apps/main/src/tasks/tasks.service.ts`, immediately after the `if (query.lastUpdatedFromDate)` block (around line 65) and before the `const page = ...` line, add:

```ts
if (query.dueBefore) {
    const existing = (filter['due.date'] as Record<string, unknown>) ?? {};

    filter['due.date'] = { ...existing, $lt: new Date(query.dueBefore) };
}

if (query.dueAfter) {
    const existing = (filter['due.date'] as Record<string, unknown>) ?? {};

    filter['due.date'] = { ...existing, $gte: new Date(query.dueAfter) };
}

if (query.noDate) {
    filter['due'] = null;
}
```

- [ ] **Step 3: Run existing tests to make sure nothing is broken**

```bash
pnpm --filter @ctm/main test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/tasks/dto/list-tasks-query.dto.ts apps/main/src/tasks/tasks.service.ts
git commit -m "feat(main): add dueBefore, dueAfter, noDate query params to task list"
```

---

## Task 2: Backend — Integration tests for new params

**Files:**

- Modify: `apps/main/src/tasks/tasks.controller.spec.ts`

- [ ] **Step 1: Add integration tests for new query params**

Add the following `it` blocks inside the existing `describe('TasksModule', ...)` block in `apps/main/src/tasks/tasks.controller.spec.ts`, after the last existing test:

```ts
it('GET /tasks?noDate=true returns only tasks without a due date', async () => {
    const title = `nodate-task-${Date.now()}`;

    await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: { title, source: 'local' },
        headers: { authorization: `Bearer ${jwt}` },
    });

    const res = await app.inject({
        method: 'GET',
        url: '/tasks?noDate=true&status=open',
        headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.statusCode).toBe(200);

    const tasks = JSON.parse(res.body) as Array<{ title: string; due: unknown }>;

    expect(tasks.some((t) => t.title === title)).toBe(true);
    expect(tasks.every((t) => t.due === null)).toBe(true);
});

it('GET /tasks?dueBefore= returns only tasks with due.date before that date', async () => {
    const pastTitle = `past-task-${Date.now()}`;
    const futureTitle = `future-task-${Date.now()}`;
    const yesterday = new Date();

    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const nextYear = new Date();

    nextYear.setFullYear(nextYear.getFullYear() + 1);

    await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
            title: pastTitle,
            source: 'local',
            due: { date: yesterday.toISOString(), timezone: null, recurrence: null },
        },
        headers: { authorization: `Bearer ${jwt}` },
    });

    await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
            title: futureTitle,
            source: 'local',
            due: { date: nextYear.toISOString(), timezone: null, recurrence: null },
        },
        headers: { authorization: `Bearer ${jwt}` },
    });

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const res = await app.inject({
        method: 'GET',
        url: `/tasks?dueBefore=${encodeURIComponent(today.toISOString())}&status=open`,
        headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.statusCode).toBe(200);

    const tasks = JSON.parse(res.body) as Array<{ title: string }>;

    expect(tasks.some((t) => t.title === pastTitle)).toBe(true);
    expect(tasks.some((t) => t.title === futureTitle)).toBe(false);
});

it('GET /tasks?dueAfter= returns only tasks with due.date on or after that date', async () => {
    const futureTitle = `future-after-${Date.now()}`;
    const nextYear = new Date();

    nextYear.setFullYear(nextYear.getFullYear() + 1);

    await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
            title: futureTitle,
            source: 'local',
            due: { date: nextYear.toISOString(), timezone: null, recurrence: null },
        },
        headers: { authorization: `Bearer ${jwt}` },
    });

    const tomorrow = new Date();

    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const res = await app.inject({
        method: 'GET',
        url: `/tasks?dueAfter=${encodeURIComponent(tomorrow.toISOString())}&status=open`,
        headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.statusCode).toBe(200);

    const tasks = JSON.parse(res.body) as Array<{ title: string }>;

    expect(tasks.some((t) => t.title === futureTitle)).toBe(true);
});

it('GET /tasks?page=1&limit=2 paginates correctly', async () => {
    // Create 3 tasks
    for (let i = 0; i < 3; i++) {
        await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { title: `page-task-${Date.now()}-${i}`, source: 'local' },
            headers: { authorization: `Bearer ${jwt}` },
        });
    }

    const page1 = await app.inject({
        method: 'GET',
        url: '/tasks?page=1&limit=2&noDate=true&status=open',
        headers: { authorization: `Bearer ${jwt}` },
    });
    const page2 = await app.inject({
        method: 'GET',
        url: '/tasks?page=2&limit=2&noDate=true&status=open',
        headers: { authorization: `Bearer ${jwt}` },
    });

    expect(page1.statusCode).toBe(200);
    expect(page2.statusCode).toBe(200);

    const p1 = JSON.parse(page1.body) as unknown[];
    const p2 = JSON.parse(page2.body) as unknown[];

    expect(p1.length).toBe(2);
    // page2 has at least 1 task (we created 3 no-date tasks)
    expect(p2.length).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @ctm/main test
```

Expected: all tests pass including the 4 new ones.

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/tasks/tasks.controller.spec.ts
git commit -m "test(main): add integration tests for dueBefore, dueAfter, noDate, and pagination"
```

---

## Task 3: API Client — Add pagination params to `ListTasksParams`

**Files:**

- Modify: `packages/api-client/src/client.types.ts`
- Modify: `packages/api-client/src/client.ts`

- [ ] **Step 1: Update `ListTasksParams` in `client.types.ts`**

Replace the existing `ListTasksParams` type:

```ts
/** Parameters for {@link CtmApiClient.listTasks}. */
export type ListTasksParams = {
    filter?: TaskFilter;
    /** ISO date string — only return tasks updated on or after this date. */
    lastUpdatedFromDate?: string;
    /** Page number (1-based). */
    page?: number;
    /** Number of tasks per page. */
    limit?: number;
    /** Filter by status directly (alternative to `filter` preset). */
    status?: 'open' | 'done' | 'archived';
    /** ISO date string — only tasks where due.date < dueBefore. */
    dueBefore?: string;
    /** ISO date string — only tasks where due.date >= dueAfter. */
    dueAfter?: string;
    /** When true, only return tasks with no due date. */
    noDate?: boolean;
};
```

- [ ] **Step 2: Update `listTasks()` in `client.ts`**

Replace the existing `listTasks` method (around line 106–116):

```ts
    async listTasks({
        filter,
        lastUpdatedFromDate,
        page,
        limit,
        status,
        dueBefore,
        dueAfter,
        noDate,
    }: ListTasksParams = {}): Promise<TaskDto[]> {
        const params: Record<string, string> = filter ? this.filterToParams(filter) : {};

        if (status) params['status'] = status;

        if (lastUpdatedFromDate) params['lastUpdatedFromDate'] = lastUpdatedFromDate;

        if (page !== undefined) params['page'] = String(page);

        if (limit !== undefined) params['limit'] = String(limit);

        if (dueBefore) params['dueBefore'] = dueBefore;

        if (dueAfter) params['dueAfter'] = dueAfter;

        if (noDate !== undefined) params['noDate'] = String(noDate);

        return this.request<TaskDto[]>({
            method: 'GET',
            path: '/tasks',
            params,
        });
    }
```

- [ ] **Step 3: Run api-client tests**

```bash
pnpm --filter @ctm/api-client test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/client.types.ts packages/api-client/src/client.ts
git commit -m "feat(api-client): add page, limit, status, dueBefore, dueAfter, noDate to listTasks"
```

---

## Task 4: Web — `ScrollSentinel` component

**Files:**

- Create: `apps/web/src/components/tasks/ScrollSentinel.tsx`

- [ ] **Step 1: Create `ScrollSentinel.tsx`**

```tsx
import { useEffect, useRef } from 'react';

type ScrollSentinelProps = {
    onVisible: () => void;
    disabled?: boolean;
    loadingMessage?: string;
    isLoading?: boolean;
};

/** Fires `onVisible` once when the element scrolls into view. Re-arms on each render. */
export function ScrollSentinel({
    onVisible,
    disabled = false,
    loadingMessage = 'Loading more…',
    isLoading = false,
}: ScrollSentinelProps): React.JSX.Element {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (disabled || !ref.current) return;

        const el = ref.current;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) {
                    onVisible();
                }
            },
            { rootMargin: '200px' },
        );

        observer.observe(el);

        return () => observer.disconnect();
    }, [disabled, onVisible]);

    if (isLoading) {
        return (
            <p className="font-bold text-nb-black/50 dark:text-white/40 uppercase text-xs tracking-wide text-center py-2">
                {loadingMessage}
            </p>
        );
    }

    return <div ref={ref} aria-hidden="true" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/ScrollSentinel.tsx
git commit -m "feat(web): add ScrollSentinel component with IntersectionObserver"
```

---

## Task 5: Web — Update `TaskList` for infinite scroll

**Files:**

- Modify: `apps/web/src/components/tasks/TaskList.tsx`

- [ ] **Step 1: Replace `TaskList.tsx`**

```tsx
import { TaskCard } from './TaskCard.js';
import { ScrollSentinel } from './ScrollSentinel.js';
import type { TaskDto } from '@ctm/api-client';

interface TaskListProps {
    tasks: TaskDto[];
    highlightedTaskId?: string | null;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    fetchNextPage?: () => void;
}

/** Renders a vertical list of task cards with optional infinite scroll. */
export function TaskList({
    tasks,
    highlightedTaskId,
    onToggle,
    onEdit,
    hasNextPage = false,
    isFetchingNextPage = false,
    fetchNextPage,
}: TaskListProps): React.JSX.Element {
    if (tasks.length === 0) {
        return (
            <div className="bg-nb-yellow border-2 border-nb-black shadow-[3px_3px_0px_#111] p-6 text-center">
                <p className="font-black uppercase text-nb-black text-lg">No Tasks Here.</p>
                <p className="font-bold text-nb-black/60 text-sm mt-1">Add one above or change the filter.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {tasks.map((task) => (
                <TaskCard
                    key={task.id}
                    task={task}
                    highlighted={task.id === highlightedTaskId}
                    onToggle={onToggle}
                    onEdit={onEdit}
                />
            ))}

            {fetchNextPage && (
                <ScrollSentinel
                    onVisible={fetchNextPage}
                    disabled={!hasNextPage || isFetchingNextPage}
                    isLoading={isFetchingNextPage}
                />
            )}
        </div>
    );
}
```

- [ ] **Step 2: Run web tests**

```bash
pnpm --filter @ctm/web test
```

Expected: all existing tests pass (the new props are optional, so existing test usage is unaffected).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/TaskList.tsx
git commit -m "feat(web): add infinite scroll props and ScrollSentinel to TaskList"
```

---

## Task 6: Web — `useGroupedTaskQueries` hook

**Files:**

- Create: `apps/web/src/hooks/useGroupedTaskQueries.ts`

The hook runs 5 independent `useInfiniteQuery` calls. Date boundaries are calculated in local time (matching `bucketTasks` logic).

- [ ] **Step 1: Create `apps/web/src/hooks/useGroupedTaskQueries.ts`**

```ts
import { useInfiniteQuery } from '@tanstack/react-query';
import type { CtmApiClient, TaskDto } from '@ctm/api-client';

const PAGE_SIZE = 20;

export type BucketQueryResult = {
    tasks: TaskDto[];
    isLoading: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
};

export type GroupedQueryResults = {
    overdue: BucketQueryResult;
    today: BucketQueryResult;
    thisWeek: BucketQueryResult;
    upcoming: BucketQueryResult;
    noDate: BucketQueryResult;
};

/** Local-time midnight for today. */
function todayMidnight(): Date {
    const d = new Date();

    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Local-time midnight for tomorrow. */
function tomorrowMidnight(): Date {
    const t = todayMidnight();

    return new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
}

/** First day of next week (Monday) in local time — i.e. the day after Sunday. */
function nextWeekMondayMidnight(): Date {
    const today = todayMidnight();
    const dayOfWeek = today.getDay(); // 0=Sun
    const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysUntilNextMonday);
}

function toBucketResult(query: ReturnType<typeof useInfiniteQuery<TaskDto[]>>): BucketQueryResult {
    return {
        tasks: query.data?.pages.flat() ?? [],
        isLoading: query.isLoading,
        hasNextPage: query.hasNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
        // Wrap to discard the Promise — callers only need the side effect.
        fetchNextPage: () => {
            void query.fetchNextPage();
        },
    };
}

/** Runs 5 independent paginated queries — one per date bucket in the grouped 'all' view. */
export function useGroupedTaskQueries({
    api,
    enabled = true,
}: {
    api: CtmApiClient;
    enabled?: boolean;
}): GroupedQueryResults {
    const today = todayMidnight().toISOString();
    const tomorrow = tomorrowMidnight().toISOString();
    const nextMonday = nextWeekMondayMidnight().toISOString();

    const overdueQ = useInfiniteQuery<TaskDto[]>({
        queryKey: ['tasks', 'grouped', 'overdue'],
        queryFn: ({ pageParam }) =>
            api.listTasks({ status: 'open', dueBefore: today, page: pageParam as number, limit: PAGE_SIZE }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, pages) => (lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined),
        enabled,
    });

    const todayQ = useInfiniteQuery<TaskDto[]>({
        queryKey: ['tasks', 'grouped', 'today'],
        queryFn: ({ pageParam }) => api.listTasks({ filter: 'today', page: pageParam as number, limit: PAGE_SIZE }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, pages) => (lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined),
        enabled,
    });

    const thisWeekQ = useInfiniteQuery<TaskDto[]>({
        queryKey: ['tasks', 'grouped', 'thisWeek'],
        queryFn: ({ pageParam }) =>
            api.listTasks({
                status: 'open',
                dueAfter: tomorrow,
                dueBefore: nextMonday,
                page: pageParam as number,
                limit: PAGE_SIZE,
            }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, pages) => (lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined),
        enabled,
    });

    const upcomingQ = useInfiniteQuery<TaskDto[]>({
        queryKey: ['tasks', 'grouped', 'upcoming'],
        queryFn: ({ pageParam }) =>
            api.listTasks({ status: 'open', dueAfter: nextMonday, page: pageParam as number, limit: PAGE_SIZE }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, pages) => (lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined),
        enabled,
    });

    const noDateQ = useInfiniteQuery<TaskDto[]>({
        queryKey: ['tasks', 'grouped', 'noDate'],
        queryFn: ({ pageParam }) =>
            api.listTasks({ status: 'open', noDate: true, page: pageParam as number, limit: PAGE_SIZE }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, pages) => (lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined),
        enabled,
    });

    return {
        overdue: toBucketResult(overdueQ),
        today: toBucketResult(todayQ),
        thisWeek: toBucketResult(thisWeekQ),
        upcoming: toBucketResult(upcomingQ),
        noDate: toBucketResult(noDateQ),
    };
}
```

- [ ] **Step 2: Run web tests (type-check)**

```bash
pnpm --filter @ctm/web test
```

Expected: all pass. TypeScript will catch any type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useGroupedTaskQueries.ts
git commit -m "feat(web): add useGroupedTaskQueries hook for per-bucket infinite pagination"
```

---

## Task 7: Web — Update `GroupedTaskList` for paginated mode

**Files:**

- Modify: `apps/web/src/components/tasks/GroupedTaskList.tsx`

- [ ] **Step 1: Replace `GroupedTaskList.tsx`**

```tsx
import type { TaskDto } from '@ctm/api-client';
import { TaskCard } from './TaskCard.js';
import { ScrollSentinel } from './ScrollSentinel.js';
import { bucketTasks, type TaskBuckets } from '../../lib/bucket-tasks.js';
import type { GroupedQueryResults } from '../../hooks/useGroupedTaskQueries.js';

type LegacyProps = {
    tasks: TaskDto[];
    groupedResults?: never;
    doneTasks?: never;
    highlightedTaskId?: string | null;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
};

type PaginatedProps = {
    tasks?: never;
    /** Per-bucket paginated query results from useGroupedTaskQueries. */
    groupedResults: GroupedQueryResults;
    /** Optimistic-only done tasks (from status mutations). No server pagination needed. */
    doneTasks?: TaskDto[];
    highlightedTaskId?: string | null;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
};

type GroupedTaskListProps = LegacyProps | PaginatedProps;

type SectionDef = {
    key: keyof TaskBuckets;
    label: string;
    chipClass: string;
};

const SECTIONS: SectionDef[] = [
    {
        key: 'overdue',
        label: '🔥 Overdue',
        chipClass: 'border-red-600 bg-red-200 shadow-[2px_2px_0px_#dc2626] text-red-700',
    },
    {
        key: 'today',
        label: 'Today',
        chipClass: 'border-blue-700 bg-blue-200 shadow-[2px_2px_0px_#1d4ed8] text-blue-800',
    },
    {
        key: 'thisWeek',
        label: 'This Week',
        chipClass:
            'border-nb-black bg-white shadow-[2px_2px_0px_#111] text-nb-black dark:border-white/20 dark:bg-neutral-800 dark:text-white dark:shadow-none',
    },
    {
        key: 'upcoming',
        label: 'Upcoming',
        chipClass:
            'border-nb-black bg-white shadow-[2px_2px_0px_#111] text-nb-black dark:border-white/20 dark:bg-neutral-800 dark:text-white dark:shadow-none',
    },
    {
        key: 'noDate',
        label: 'No Date',
        chipClass:
            'border-gray-400 bg-gray-100 shadow-[2px_2px_0px_#9ca3af] text-gray-500 dark:border-white/20 dark:bg-neutral-800 dark:text-white/50 dark:shadow-none',
    },
    {
        key: 'done',
        label: 'Done',
        chipClass:
            'border-gray-400 bg-gray-100 shadow-[2px_2px_0px_#9ca3af] text-gray-400 line-through dark:border-white/20 dark:bg-neutral-800 dark:text-white/30 dark:shadow-none',
    },
];

const DONE_CHIP =
    'border-gray-400 bg-gray-100 shadow-[2px_2px_0px_#9ca3af] text-gray-400 line-through dark:border-white/20 dark:bg-neutral-800 dark:text-white/30 dark:shadow-none';

function SectionBlock({
    label,
    chipClass,
    tasks,
    highlightedTaskId,
    onToggle,
    onEdit,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
}: {
    label: string;
    chipClass: string;
    tasks: TaskDto[];
    highlightedTaskId?: string | null;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
    isLoading?: boolean;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    fetchNextPage?: () => void;
}): React.JSX.Element | null {
    if (tasks.length === 0 && !isLoading && !isFetchingNextPage) return null;

    return (
        <div>
            <div
                className={`inline-flex items-center gap-2 mb-2 border-2 px-2.5 py-0.5 font-black text-[11px] uppercase tracking-wide ${chipClass}`}
            >
                {label}
                <span className="opacity-60 text-[10px]">{tasks.length}</span>
            </div>

            <div className="flex flex-col gap-2">
                {tasks.map((task) => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        highlighted={task.id === highlightedTaskId}
                        onToggle={onToggle}
                        onEdit={onEdit}
                    />
                ))}

                {fetchNextPage && (
                    <ScrollSentinel
                        onVisible={fetchNextPage}
                        disabled={!hasNextPage || isFetchingNextPage}
                        isLoading={isFetchingNextPage}
                    />
                )}
            </div>
        </div>
    );
}

/** Renders tasks grouped into due-date sections with neobrutalist chip headers. */
export function GroupedTaskList({
    tasks,
    groupedResults,
    doneTasks = [],
    highlightedTaskId,
    onToggle,
    onEdit,
}: GroupedTaskListProps): React.JSX.Element {
    // Paginated mode: groupedResults provided
    if (groupedResults) {
        const anyLoading = Object.values(groupedResults).some((r) => r.isLoading);
        const allEmpty =
            !anyLoading && Object.values(groupedResults).every((r) => r.tasks.length === 0) && doneTasks.length === 0;

        if (allEmpty) {
            return (
                <div className="bg-nb-yellow border-2 border-nb-black shadow-[3px_3px_0px_#111] p-6 text-center">
                    <p className="font-black uppercase text-nb-black text-lg">No Tasks Here.</p>
                    <p className="font-bold text-nb-black/60 text-sm mt-1">Add one above or change the filter.</p>
                </div>
            );
        }

        const bucketKeys = ['overdue', 'today', 'thisWeek', 'upcoming', 'noDate'] as const;

        return (
            <div className="flex flex-col gap-5">
                {bucketKeys.map((key) => {
                    const section = SECTIONS.find((s) => s.key === key)!;
                    const result = groupedResults[key];

                    return (
                        <SectionBlock
                            key={key}
                            label={section.label}
                            chipClass={section.chipClass}
                            tasks={result.tasks}
                            highlightedTaskId={highlightedTaskId}
                            onToggle={onToggle}
                            onEdit={onEdit}
                            isLoading={result.isLoading}
                            hasNextPage={result.hasNextPage}
                            isFetchingNextPage={result.isFetchingNextPage}
                            fetchNextPage={result.fetchNextPage}
                        />
                    );
                })}

                {doneTasks.length > 0 && (
                    <SectionBlock
                        label="Done"
                        chipClass={DONE_CHIP}
                        tasks={doneTasks}
                        highlightedTaskId={highlightedTaskId}
                        onToggle={onToggle}
                        onEdit={onEdit}
                    />
                )}
            </div>
        );
    }

    // Legacy mode: flat tasks array, client-side bucketing
    const buckets = bucketTasks(tasks ?? []);
    const isEmpty = Object.values(buckets).every((arr) => arr.length === 0);

    if (isEmpty) {
        return (
            <div className="bg-nb-yellow border-2 border-nb-black shadow-[3px_3px_0px_#111] p-6 text-center">
                <p className="font-black uppercase text-nb-black text-lg">No Tasks Here.</p>
                <p className="font-bold text-nb-black/60 text-sm mt-1">Add one above or change the filter.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {SECTIONS.map(({ key, label, chipClass }) => {
                const sectionTasks = buckets[key];

                if (sectionTasks.length === 0) return null;

                return (
                    <SectionBlock
                        key={key}
                        label={label}
                        chipClass={chipClass}
                        tasks={sectionTasks}
                        highlightedTaskId={highlightedTaskId}
                        onToggle={onToggle}
                        onEdit={onEdit}
                    />
                );
            })}
        </div>
    );
}
```

- [ ] **Step 2: Run web tests**

```bash
pnpm --filter @ctm/web test
```

Expected: existing `GroupedTaskList.spec.tsx` tests all pass (legacy mode preserved).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/GroupedTaskList.tsx
git commit -m "feat(web): update GroupedTaskList to support paginated mode with per-section scroll sentinels"
```

---

## Task 8: Web — Wire `TasksPage` with infinite queries

**Files:**

- Modify: `apps/web/src/pages/TasksPage.tsx`

This task replaces the single `useQuery` call with `useInfiniteQuery` for flat filters and `useGroupedTaskQueries` for the grouped 'all' filter. It also tracks done tasks in local state for the 'all' view.

- [ ] **Step 1: Replace `TasksPage.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskDto, TaskFilter, CreateTaskDto, UpdateTaskDto, SetFuzzyDeadlineDto } from '@ctm/api-client';
import { getErrorMessage } from '../api/error-message.js';
import { useAuth } from '../auth/AuthContext.js';
import { TaskFilters } from '../components/tasks/TaskFilters.js';
import { TaskList } from '../components/tasks/TaskList.js';
import { GroupedTaskList } from '../components/tasks/GroupedTaskList.js';
import { AddTaskInline } from '../components/tasks/AddTaskInline.js';
import { TaskModal } from '../components/tasks/TaskModal.js';
import { useGroupedTaskQueries } from '../hooks/useGroupedTaskQueries.js';

const PAGE_SIZE = 20;

/** Main task management page. Filter is stored in the URL (?filter=today). Opening a specific task is via ?taskId=<id>. */
export function TasksPage(): React.JSX.Element {
    const [searchParams, setSearchParams] = useSearchParams();
    const filter = (searchParams.get('filter') ?? 'all') as TaskFilter;
    const taskIdParam = searchParams.get('taskId');
    const highlightTaskIdParam = searchParams.get('highlightTaskId');
    const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
    const [editTask, setEditTask] = useState<TaskDto | null>(null);
    const [doneTasks, setDoneTasks] = useState<TaskDto[]>([]);
    const { api } = useAuth();

    const qc = useQueryClient();

    // Reset done tasks when filter changes away from 'all'
    useEffect(() => {
        if (filter !== 'all') setDoneTasks([]);
    }, [filter]);

    // Highlight task when ?highlightTaskId= is present (e.g. navigated from a notification).
    useEffect(() => {
        if (!highlightTaskIdParam) return;

        setHighlightedTaskId(highlightTaskIdParam);
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);

                next.delete('highlightTaskId');

                return next;
            },
            { replace: true },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightTaskIdParam]);

    // Clear highlight when user clicks anywhere.
    useEffect(() => {
        if (!highlightedTaskId) return;

        const handler = (): void => setHighlightedTaskId(null);

        document.addEventListener('click', handler, { once: true });

        return () => document.removeEventListener('click', handler);
    }, [highlightedTaskId]);

    // Open the task modal when ?taskId= is present (e.g. navigated from a notification).
    useEffect(() => {
        if (!taskIdParam) return;

        api.getTask({ id: taskIdParam })
            .then((task) => {
                setEditTask(task);
                setSearchParams(
                    (prev) => {
                        const next = new URLSearchParams(prev);

                        next.delete('taskId');

                        return next;
                    },
                    { replace: true },
                );
            })
            .catch(() => {
                setSearchParams(
                    (prev) => {
                        const next = new URLSearchParams(prev);

                        next.delete('taskId');

                        return next;
                    },
                    { replace: true },
                );
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskIdParam]);

    const midnightYesterday = (() => {
        const d = new Date();

        d.setDate(d.getDate() - 1);
        d.setHours(0, 0, 0, 0);

        return d.toISOString();
    })();

    // Flat list infinite query (today / upcoming / done).
    const flatQuery = useInfiniteQuery<TaskDto[]>({
        queryKey: ['tasks', filter],
        queryFn: ({ pageParam }) =>
            api.listTasks({
                filter,
                page: pageParam as number,
                limit: PAGE_SIZE,
                lastUpdatedFromDate: filter === 'done' ? midnightYesterday : undefined,
            }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, pages) => (lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined),
        enabled: filter !== 'all',
    });

    const flatTasks = flatQuery.data?.pages.flat() ?? [];
    const flatIsLoading = flatQuery.isLoading;
    const flatIsError = flatQuery.isError;

    // Per-bucket grouped queries (all filter only).
    const groupedResults = useGroupedTaskQueries({ api, enabled: filter === 'all' });

    const addMutation = useMutation({
        mutationFn: (dto: CreateTaskDto) => api.createTask({ dto }),
        onSuccess: (created) => {
            if (filter === 'all') {
                // Invalidate the relevant bucket so it refetches
                qc.invalidateQueries({ queryKey: ['tasks', 'grouped'] });
            } else {
                qc.setQueryData<{ pages: TaskDto[][] }>(['tasks', filter], (prev) => {
                    if (!prev) return prev;

                    return { ...prev, pages: [[created, ...(prev.pages[0] ?? [])], ...prev.pages.slice(1)] };
                });
            }
        },
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
            api.setTaskStatus({ id, dto: { status: completed ? 'done' : 'open' } }),
        onMutate: async ({ id, completed }) => {
            if (filter === 'all') {
                // Optimistically move to done section
                const allBuckets = ['overdue', 'today', 'thisWeek', 'upcoming', 'noDate'] as const;

                let movedTask: TaskDto | undefined;

                for (const bucket of allBuckets) {
                    qc.setQueryData<{ pages: TaskDto[][] }>(['tasks', 'grouped', bucket], (prev) => {
                        if (!prev) return prev;

                        const updated = prev.pages.map((page) => {
                            const found = page.find((t) => t.id === id);

                            if (found) movedTask = { ...found, completed };

                            return page.filter((t) => t.id !== id);
                        });

                        return { ...prev, pages: updated };
                    });
                }

                if (completed && movedTask) {
                    setDoneTasks((prev) => [movedTask!, ...prev]);
                } else if (!completed) {
                    setDoneTasks((prev) => prev.filter((t) => t.id !== id));
                    qc.invalidateQueries({ queryKey: ['tasks', 'grouped'] });
                }

                return { movedTask };
            }

            await qc.cancelQueries({ queryKey: ['tasks', filter] });
            const prev = qc.getQueryData<{ pages: TaskDto[][] }>(['tasks', filter]);

            qc.setQueryData<{ pages: TaskDto[][] }>(['tasks', filter], (old) => {
                if (!old) return old;

                return {
                    ...old,
                    pages: old.pages.map((page) => page.map((t) => (t.id === id ? { ...t, completed } : t))),
                };
            });

            return { prev };
        },
        onError: (_err, _vars, ctx) => {
            if (filter !== 'all' && ctx?.prev) {
                qc.setQueryData(['tasks', filter], ctx.prev);
            }
        },
    });

    const saveMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskDto }) => api.updateTask({ id, dto }),
        onSuccess: () => {
            if (filter === 'all') {
                qc.invalidateQueries({ queryKey: ['tasks', 'grouped'] });
            } else {
                qc.invalidateQueries({ queryKey: ['tasks', filter] });
            }
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteTask({ id }),
        onSuccess: (_data, id) => {
            if (filter === 'all') {
                qc.invalidateQueries({ queryKey: ['tasks', 'grouped'] });
                setDoneTasks((prev) => prev.filter((t) => t.id !== id));
            } else {
                qc.setQueryData<{ pages: TaskDto[][] }>(['tasks', filter], (prev) => {
                    if (!prev) return prev;

                    return { ...prev, pages: prev.pages.map((page) => page.filter((t) => t.id !== id)) };
                });
            }
        },
    });

    const setFuzzyMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: SetFuzzyDeadlineDto }) => api.setFuzzyDeadline({ id, dto }),
        onSuccess: () => {
            if (filter === 'all') {
                qc.invalidateQueries({ queryKey: ['tasks', 'grouped'] });
            } else {
                qc.invalidateQueries({ queryKey: ['tasks', filter] });
            }
        },
    });

    const removeFuzzyMutation = useMutation({
        mutationFn: (id: string) => api.removeFuzzyDeadline({ id }),
        onSuccess: () => {
            if (filter === 'all') {
                qc.invalidateQueries({ queryKey: ['tasks', 'grouped'] });
            } else {
                qc.invalidateQueries({ queryKey: ['tasks', filter] });
            }
        },
    });

    const handleToggle = useCallback(
        (id: string, completed: boolean) => {
            statusMutation.mutate({ id, completed });
        },
        [statusMutation],
    );

    const totalLoaded =
        filter === 'all'
            ? Object.values(groupedResults).reduce((sum, r) => sum + r.tasks.length, 0) + doneTasks.length
            : flatTasks.length;

    const isLoading = filter === 'all' ? false : flatIsLoading;
    const isError = filter === 'all' ? false : flatIsError;

    return (
        <div className="p-4 md:p-6 max-w-2xl">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-nb-black dark:text-white">
                        My Tasks
                    </h1>
                    {!isLoading && (
                        <p className="text-nb-black/60 dark:text-white/50 font-bold text-sm">
                            {totalLoaded} task{totalLoaded !== 1 ? 's' : ''} loaded
                        </p>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <TaskFilters active={filter} onChange={(f) => setSearchParams({ filter: f })} />

                <AddTaskInline
                    onAdd={async (dto) => {
                        await addMutation.mutateAsync(dto);
                    }}
                    isPending={addMutation.isPending}
                />

                {isLoading && (
                    <p className="font-bold text-nb-black/60 dark:text-white/50 uppercase text-sm tracking-wide">
                        Loading…
                    </p>
                )}

                {isError && (
                    <div className="border-2 border-nb-red bg-nb-red/10 p-3">
                        <p className="text-nb-red font-bold text-sm">
                            {getErrorMessage(flatQuery.error, 'Failed to load tasks. Is the API running?')}
                        </p>
                    </div>
                )}

                {!isLoading &&
                    !isError &&
                    (filter === 'all' ? (
                        <GroupedTaskList
                            groupedResults={groupedResults}
                            doneTasks={doneTasks}
                            highlightedTaskId={highlightedTaskId}
                            onToggle={handleToggle}
                            onEdit={setEditTask}
                        />
                    ) : (
                        <TaskList
                            tasks={flatTasks}
                            highlightedTaskId={highlightedTaskId}
                            onToggle={handleToggle}
                            onEdit={setEditTask}
                            hasNextPage={flatQuery.hasNextPage}
                            isFetchingNextPage={flatQuery.isFetchingNextPage}
                            fetchNextPage={flatQuery.fetchNextPage}
                        />
                    ))}
            </div>

            <TaskModal
                task={editTask}
                open={editTask !== null}
                onClose={() => setEditTask(null)}
                onSave={async (id, dto) => {
                    await saveMutation.mutateAsync({ id, dto });
                }}
                onDelete={async (id) => {
                    await deleteMutation.mutateAsync(id);
                }}
                onSetFuzzyDeadline={async (id, dto) => {
                    await setFuzzyMutation.mutateAsync({ id, dto });
                }}
                isSaving={saveMutation.isPending}
                isDeleting={deleteMutation.isPending}
                isSettingFuzzy={setFuzzyMutation.isPending}
                isRemovingFuzzy={removeFuzzyMutation.isPending}
            />
        </div>
    );
}
```

- [ ] **Step 2: Run all web tests**

```bash
pnpm --filter @ctm/web test
```

Expected: all tests pass.

- [ ] **Step 3: Run TypeScript type-check**

```bash
pnpm --filter @ctm/web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/TasksPage.tsx
git commit -m "feat(web): wire TasksPage with useInfiniteQuery and useGroupedTaskQueries"
```

---

## Task 9: Full test run

- [ ] **Step 1: Run all tests across the monorepo**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Build check**

```bash
pnpm build
```

Expected: build completes without errors.

- [ ] **Step 3: Final commit if any stragglers**

If any lint/format fixes were needed:

```bash
pnpm format
pnpm lint
git add -A
git commit -m "chore: fix lint and format after infinite scroll implementation"
```
