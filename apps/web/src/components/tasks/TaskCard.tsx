import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { TaskRow } from '@ctm/ui';
import type { BrandKey } from '@ctm/ui';
import type { TaskDto } from '@ctm/api-client';
import { getSourceBrand, getSourceLabel } from '../../lib/source-labels.js';
import { formatDueLabel } from '../../lib/format-task.js';

type TaskCardProps = {
    task: TaskDto;
    highlighted?: boolean;
    pending?: boolean;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
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
}: TaskCardProps): React.JSX.Element {
    const { t, i18n } = useTranslation();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!highlighted) return;

        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [highlighted]);

    const brand = getSourceBrand(task.source);
    const due = formatDueLabel({ task, locale: i18n.language, t });

    return (
        <div ref={ref} className={clsx(highlighted && 'bg-accent/8')}>
            <TaskRow
                title={task.title}
                source={{
                    brand: (brand ?? 'mcp') as BrandKey,
                    label: task.source && task.source !== 'local' ? getSourceLabel(task.source) : t('tasks.localOnly'),
                }}
                due={due}
                priorityLabel={task.priority ? t('tasks.priority', { level: task.priority }) : undefined}
                completed={task.completed}
                pending={pending}
                onToggle={(completed) => onToggle(task.id, completed)}
                onOpen={() => onEdit(task)}
            />
        </div>
    );
}
