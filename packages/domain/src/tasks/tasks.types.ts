/** Outcome of a pull-sync. `droppedOverQuota` counts remote tasks left unimported at the cap. */
export type UpsertFromRemoteResult = {
    synced: number;
    skipped: number;
    droppedOverQuota: number;
};

/** Filters and paging accepted by `list`, matching the API's query string. */
export type ListTasksQuery = {
    filter?: 'today' | 'upcoming' | 'done' | 'all';
    status?: string;
    source?: string;
    fuzzy?: string;
    surfaced?: boolean;
    lastUpdatedFromDate?: string;
    dueBefore?: string;
    dueAfter?: string;
    noDate?: boolean;
    page?: number;
    limit?: number;
};

/** Fields `create` accepts. Dates arrive as ISO strings, matching the wire format. */
export type CreateTaskInput = {
    source: string;
    title: string;
    description?: string | null;
    priority?: 1 | 2 | 3 | 4;
    locations?: { name: string; googleMapsUrl: string }[];
    due?: { date: string; timezone?: string; recurrence?: string };
    deadlineDate?: string;
    duration?: { amount: number; unit: 'minute' | 'day' } | null;
};

/** Fields `update` accepts. Every field is optional; absent means "leave alone". */
export type UpdateTaskInput = {
    title?: string;
    description?: string | null;
    priority?: 1 | 2 | 3 | 4;
    tags?: string[];
    locations?: { name: string; googleMapsUrl: string }[];
    due?: { date: string; timezone?: string; recurrence?: string };
    deadlineDate?: string;
    duration?: { amount: number; unit: 'minute' | 'day' } | null;
};
