import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { TaskRow } from '@ctm/ui';
import type { TaskDto } from '@ctm/api-client';
import { getSourceBrand, getSourceLabel } from '../../lib/source-labels.js';
import { formatDueLabel } from '../../lib/format-task.js';

type TaskCardProps = {
    task: TaskDto;
    highlighted?: boolean;
    pending?: boolean;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
    /** Swipe right. Omitted where a list has no business rescheduling, as on the calendar. */
    onSnooze?: (task: TaskDto) => void;
    /** Swipe left, then a deliberate tap on the revealed button. */
    onDelete?: (task: TaskDto) => void;
};

/**
 * Adapter between `TaskDto` and the presentational `TaskRow`. Everything the row needs is
 * derived here, so the component in `@ctm/ui` stays free of API shapes.
 */
export function TaskCard({
    task,
    highlighted = false,
    pending = false,
    onToggle,
    onEdit,
    onSnooze,
    onDelete,
}: TaskCardProps): React.JSX.Element {
    const { t, i18n } = useTranslation();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!highlighted) return;

        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [highlighted]);

    const external = Boolean(task.source) && task.source !== 'local';
    const due = formatDueLabel({ task, locale: i18n.language, t });

    return (
        <div ref={ref} className={clsx(highlighted && 'bg-accent/8')}>
            <TaskRow
                title={task.title}
                source={
                    // A task created here has no third party to badge, and a pill on every
                    // row would say nothing. Provenance shows up only when it is news.
                    external
                        ? { brand: getSourceBrand(task.source) ?? undefined, label: getSourceLabel(task.source) }
                        : undefined
                }
                due={due}
                // Only the top two priorities earn a pill. Everything defaults to 2, so
                // badging all four would put a label on every row and mean nothing.
                priorityLabel={
                    task.priority && task.priority <= 2 ? t('tasks.priority', { level: task.priority }) : undefined
                }
                priorityTone={task.priority === 1 ? 'warn' : 'neutral'}
                completed={task.completed}
                pending={pending}
                onToggle={(completed) => onToggle(task.id, completed)}
                onOpen={() => onEdit(task)}
                onSnooze={onSnooze && (() => onSnooze(task))}
                onDelete={onDelete && (() => onDelete(task))}
                swipeLabels={{ snooze: t('tasks.swipe.snooze'), delete: t('tasks.swipe.delete') }}
            />
        </div>
    );
}
