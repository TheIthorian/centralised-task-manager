import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { Badge, Checkbox } from '@ctm/ui';
import type { Duration, TaskDto } from '@ctm/api-client';
import { SourceBadge } from './SourceBadge.js';

type TaskCardProps = {
    task: TaskDto;
    highlighted?: boolean;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
};

function formatDuration(d: Duration): string {
    return d.unit === 'minute' ? `${d.amount} min` : `${d.amount}d`;
}

const priorityVariant = {
    1: 'p1',
    2: 'p2',
    3: 'p3',
    4: 'p3',
} as const;

/** A single task row card in neobrutalist style. */
export function TaskCard({ task, highlighted = false, onToggle, onEdit }: TaskCardProps): React.JSX.Element {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!highlighted) return;

        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [highlighted]);

    return (
        <div
            ref={ref}
            className={clsx(
                'relative flex items-center gap-3 px-3 py-2.5 shadow-[3px_3px_0px_#111] dark:shadow-none',
                highlighted
                    ? 'bg-white dark:bg-neutral-900 border-2 border-transparent'
                    : 'bg-white dark:bg-neutral-900 border-2 border-nb-black dark:border-white/20',
            )}
        >
            {highlighted && (
                <svg
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        overflow: 'visible',
                        pointerEvents: 'none',
                    }}
                >
                    <rect
                        x="1.5"
                        y="1.5"
                        width="calc(100% - 3px)"
                        height="calc(100% - 3px)"
                        fill="none"
                        stroke="#111"
                        strokeWidth="3"
                        strokeDasharray="10 5"
                        className="motion-safe:animate-[dash-march_0.4s_linear_infinite]"
                    />
                </svg>
            )}
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
                <span className="flex items-center gap-2 flex-wrap">
                    {task.due && (
                        <span className="text-nb-grey text-xs font-bold">
                            {new Date(task.due.date).toLocaleDateString()}
                            {task.due.recurrence && ' ↻'}
                        </span>
                    )}
                    {task.deadlineDate && (
                        <span className="text-red-600 dark:text-red-400 text-xs font-bold">
                            ⚑ {new Date(task.deadlineDate).toLocaleDateString()}
                        </span>
                    )}
                    {task.duration && (
                        <span className="text-nb-grey text-xs font-bold">⏱ {formatDuration(task.duration)}</span>
                    )}
                </span>
            </button>

            <div className="flex items-center gap-1.5 flex-shrink-0">
                {task.locations?.length > 0 && (
                    <span className="text-xs" title={task.locations.map((l) => l.name).join(', ')}>
                        📍
                    </span>
                )}
                <SourceBadge source={task.source} />
                {task.priority && (
                    <Badge variant={priorityVariant[task.priority as 1 | 2 | 3 | 4]}>P{task.priority}</Badge>
                )}
            </div>
        </div>
    );
}
