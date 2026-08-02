import { useTranslation } from 'react-i18next';
import { EmptyState } from '@ctm/ui';
import type { TaskDto } from '@ctm/api-client';
import { TaskCard } from './TaskCard.js';
import { ScrollSentinel } from './ScrollSentinel.js';
import { bucketTasks, type TaskBuckets } from '../../lib/bucket-tasks.js';
import { useTimeZone } from '../../hooks/useTimeZone.js';
import type { GroupedQueryResults } from '../../hooks/useGroupedTaskQueries.js';

type LegacyProps = {
    tasks: TaskDto[];
    groupedResults?: never;
    doneTasks?: never;
    highlightedTaskId?: string | null;
    /** The task with a write in flight, if any. */
    pendingTaskId?: string | null;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
    onSnooze?: (task: TaskDto) => void;
    onDelete?: (task: TaskDto) => void;
};

type PaginatedProps = {
    tasks?: never;
    /** Per-bucket paginated query results from useGroupedTaskQueries. */
    groupedResults: GroupedQueryResults;
    /** Optimistic-only done tasks (from status mutations). No server pagination needed. */
    doneTasks?: TaskDto[];
    highlightedTaskId?: string | null;
    /** The task with a write in flight, if any. */
    pendingTaskId?: string | null;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
    onSnooze?: (task: TaskDto) => void;
    onDelete?: (task: TaskDto) => void;
};

type GroupedTaskListProps = LegacyProps | PaginatedProps;

const SECTIONS = [
    { key: 'overdue', labelKey: 'tasks.groups.overdue', emptyKey: 'tasks.empty.overdue' },
    { key: 'today', labelKey: 'tasks.groups.today', emptyKey: 'tasks.empty.today' },
    { key: 'thisWeek', labelKey: 'tasks.groups.thisWeek', emptyKey: 'tasks.empty.thisWeek' },
    { key: 'upcoming', labelKey: 'tasks.groups.upcoming', emptyKey: 'tasks.empty.upcoming' },
    { key: 'noDate', labelKey: 'tasks.groups.noDate', emptyKey: 'tasks.empty.noDate' },
    { key: 'done', labelKey: 'tasks.groups.done', emptyKey: 'tasks.empty.done' },
] as const satisfies readonly { key: keyof TaskBuckets; labelKey: string; emptyKey: string }[];

function SectionBlock({
    label,
    tasks,
    highlightedTaskId,
    pendingTaskId,
    onToggle,
    onEdit,
    onSnooze,
    onDelete,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
}: {
    label: string;
    tasks: TaskDto[];
    highlightedTaskId?: string | null;
    /** The task with a write in flight, if any. */
    pendingTaskId?: string | null;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
    onSnooze?: (task: TaskDto) => void;
    onDelete?: (task: TaskDto) => void;
    isLoading?: boolean;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    fetchNextPage?: () => void;
}): React.JSX.Element | null {
    if (tasks.length === 0 && !isLoading && !isFetchingNextPage) return null;

    return (
        <section className="flex flex-col gap-1.5">
            <header className="flex items-center gap-2 pt-1 text-[11px] uppercase tracking-[0.1em] text-muted">
                <span>{label}</span>
                <span className="tabular-nums">{tasks.length}</span>
            </header>

            <div className="overflow-hidden rounded-ctm border border-line bg-panel">
                {tasks.map((task) => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        highlighted={task.id === highlightedTaskId}
                        pending={task.id === pendingTaskId}
                        onToggle={onToggle}
                        onEdit={onEdit}
                        onSnooze={onSnooze}
                        onDelete={onDelete}
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
        </section>
    );
}

/** Renders tasks grouped into due-state sections. */
export function GroupedTaskList({
    tasks,
    groupedResults,
    doneTasks = [],
    highlightedTaskId,
    pendingTaskId,
    onToggle,
    onEdit,
    onSnooze,
    onDelete,
}: GroupedTaskListProps): React.JSX.Element {
    const { t } = useTranslation();
    const timeZone = useTimeZone();

    // Paginated mode: groupedResults provided
    if (groupedResults) {
        const anyLoading = Object.values(groupedResults).some((r) => r.isLoading);
        const allEmpty =
            !anyLoading &&
            Object.values(groupedResults).every((r) => r.tasks.length === 0) &&
            doneTasks.length === 0;

        if (allEmpty) {
            return <EmptyState title={t('tasks.emptyAll.title')} body={t('tasks.emptyAll.body')} />;
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
                            label={t(section.labelKey)}
                            tasks={result.tasks}
                            highlightedTaskId={highlightedTaskId}
                        pendingTaskId={pendingTaskId}
                            onToggle={onToggle}
                            onEdit={onEdit}
                            onSnooze={onSnooze}
                            onDelete={onDelete}
                            isLoading={result.isLoading}
                            hasNextPage={result.hasNextPage}
                            isFetchingNextPage={result.isFetchingNextPage}
                            fetchNextPage={result.fetchNextPage}
                        />
                    );
                })}

                {doneTasks.length > 0 && (
                    <SectionBlock
                        label={t('tasks.groups.done')}
                        tasks={doneTasks}
                        highlightedTaskId={highlightedTaskId}
                        pendingTaskId={pendingTaskId}
                        onToggle={onToggle}
                        onEdit={onEdit}
                        onSnooze={onSnooze}
                        onDelete={onDelete}
                    />
                )}
            </div>
        );
    }

    // Legacy mode: flat tasks array, client-side bucketing
    const buckets = bucketTasks({ tasks: tasks ?? [], timeZone });
    const isEmpty = Object.values(buckets).every((arr) => arr.length === 0);

    if (isEmpty) return <EmptyState title={t('tasks.emptyAll.title')} body={t('tasks.emptyAll.body')} />;

    return (
        <div className="flex flex-col gap-5">
            {SECTIONS.map(({ key, labelKey }) => {
                const sectionTasks = buckets[key];

                if (sectionTasks.length === 0) return null;

                return (
                    <SectionBlock
                        key={key}
                        label={t(labelKey)}
                        tasks={sectionTasks}
                        highlightedTaskId={highlightedTaskId}
                        pendingTaskId={pendingTaskId}
                        onToggle={onToggle}
                        onEdit={onEdit}
                        onSnooze={onSnooze}
                        onDelete={onDelete}
                    />
                );
            })}
        </div>
    );
}
