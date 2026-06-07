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
