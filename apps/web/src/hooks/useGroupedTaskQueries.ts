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

function toBucketResult(
    query: ReturnType<typeof useInfiniteQuery<TaskDto[]>>,
): BucketQueryResult {
    return {
        tasks: query.data?.pages.flat() ?? [],
        isLoading: query.isLoading,
        hasNextPage: query.hasNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
        // Wrap to discard the Promise — callers only need the side effect.
        fetchNextPage: () => { void query.fetchNextPage(); },
    };
}

/** Runs 5 independent paginated queries — one per date bucket in the grouped 'all' view. */
export function useGroupedTaskQueries({ api, enabled = true }: { api: CtmApiClient; enabled?: boolean }): GroupedQueryResults {
    const today = todayMidnight().toISOString();
    const tomorrow = tomorrowMidnight().toISOString();
    const nextMonday = nextWeekMondayMidnight().toISOString();

    const overdueQ = useInfiniteQuery<TaskDto[]>({
        queryKey: ['tasks', 'grouped', 'overdue'],
        queryFn: ({ pageParam }) =>
            api.listTasks({ status: 'open', dueBefore: today, page: pageParam as number, limit: PAGE_SIZE }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, pages) =>
            lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined,
        enabled,
    });

    const todayQ = useInfiniteQuery<TaskDto[]>({
        queryKey: ['tasks', 'grouped', 'today'],
        queryFn: ({ pageParam }) =>
            api.listTasks({ filter: 'today', page: pageParam as number, limit: PAGE_SIZE }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, pages) =>
            lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined,
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
        getNextPageParam: (lastPage, pages) =>
            lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined,
        enabled,
    });

    const upcomingQ = useInfiniteQuery<TaskDto[]>({
        queryKey: ['tasks', 'grouped', 'upcoming'],
        queryFn: ({ pageParam }) =>
            api.listTasks({ status: 'open', dueAfter: nextMonday, page: pageParam as number, limit: PAGE_SIZE }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, pages) =>
            lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined,
        enabled,
    });

    const noDateQ = useInfiniteQuery<TaskDto[]>({
        queryKey: ['tasks', 'grouped', 'noDate'],
        queryFn: ({ pageParam }) =>
            api.listTasks({ status: 'open', noDate: true, page: pageParam as number, limit: PAGE_SIZE }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, pages) =>
            lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined,
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
