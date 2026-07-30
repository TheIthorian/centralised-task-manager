import { TaskCard } from './TaskCard.js';
import { ScrollSentinel } from './ScrollSentinel.js';
import type { TaskDto } from '@ctm/api-client';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@ctm/ui';

interface TaskListProps {
    tasks: TaskDto[];
    highlightedTaskId?: string | null;
    /** The task with a write in flight, if any. */
    pendingTaskId?: string | null;
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
    pendingTaskId,
    onToggle,
    onEdit,
    hasNextPage = false,
    isFetchingNextPage = false,
    fetchNextPage,
}: TaskListProps): React.JSX.Element {
    const { t } = useTranslation();
    if (tasks.length === 0) {
        return (
            <EmptyState title={t('tasks.emptyAll.title')} body={t('tasks.emptyAll.body')} />
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {tasks.map((task) => (
                <TaskCard
                    pending={task.id === pendingTaskId}
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
