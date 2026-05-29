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
            !anyLoading &&
            Object.values(groupedResults).every((r) => r.tasks.length === 0) &&
            doneTasks.length === 0;

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
