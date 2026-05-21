import clsx from 'clsx';
import { Badge, Checkbox } from '../ui/index.js';
import type { TaskDto } from '@ctm/api-client';

interface TaskCardProps {
    task: TaskDto;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
}

const priorityVariant = {
    1: 'p1',
    2: 'p2',
    3: 'p3',
    4: 'p3',
} as const;

/** A single task row card in neobrutalist style. */
export function TaskCard({ task, onToggle, onEdit }: TaskCardProps): React.JSX.Element {
    const sourceLabel = task.source ? task.source.toUpperCase() : 'UNKNOWN';

    return (
        <div className="bg-white dark:bg-neutral-900 border-2 border-nb-black dark:border-white/20 shadow-[3px_3px_0px_#111] dark:shadow-none flex items-center gap-3 px-3 py-2.5">
            <Checkbox
                checked={task.completed}
                onChange={(checked) => onToggle(task.id, checked)}
                label={`Toggle ${task.title}`}
            />

            <button className="flex-1 text-left min-w-0 cursor-pointer" onClick={() => onEdit(task)}>
                <span
                    className={clsx(
                        'font-bold text-sm text-nb-black dark:text-white block truncate',
                        task.completed && 'line-through text-nb-grey',
                    )}
                >
                    {task.title}
                </span>
                {task.dueDate && (
                    <span className="text-nb-grey text-xs font-bold block">
                        {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                )}
            </button>

            <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge variant="source">{sourceLabel}</Badge>
                {task.priority && (
                    <Badge variant={priorityVariant[task.priority as 1 | 2 | 3 | 4]}>P{task.priority}</Badge>
                )}
            </div>
        </div>
    );
}
