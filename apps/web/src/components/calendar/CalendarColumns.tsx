import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { TaskDto } from '@ctm/api-client';
import { toDateKey } from '../../lib/calendar-range.js';
import { TaskChip } from './TaskChip.js';

export type CalendarColumnsProps = {
    days: Date[];
    tasksByDate: Map<string, TaskDto[]>;
    todayKey: string;
    locale: string;
    onOpenTask: (task: TaskDto) => void;
};

/**
 * Week, three day and single day ranges. There is no hour ruler: most tasks carry a date and
 * no time, so an hour grid would be a tall empty scaffold with everything piled at midnight.
 * The columns list a day in full instead, which is what the shorter ranges are for.
 */
export function CalendarColumns({
    days,
    tasksByDate,
    todayKey,
    locale,
    onOpenTask,
}: CalendarColumnsProps): React.JSX.Element {
    const { t } = useTranslation();
    const headingFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric' });

    return (
        <div
            className="grid overflow-hidden rounded-ctm border border-line"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        >
            {days.map((date) => {
                const key = toDateKey(date);
                const dayTasks = tasksByDate.get(key) ?? [];
                const isToday = key === todayKey;

                return (
                    <div key={key} className="flex flex-col border-r border-line last:border-r-0">
                        <div
                            className={clsx(
                                'border-b border-line px-2 py-1.5 text-center text-[11px] uppercase tracking-[0.08em]',
                                isToday ? 'bg-accent font-semibold text-accent-fg' : 'bg-nav-on-bg text-muted',
                            )}
                        >
                            {headingFormat.format(date)}
                        </div>
                        <div className="flex min-h-[60vh] flex-col gap-1 p-2">
                            {dayTasks.map((task) => (
                                <TaskChip key={task.id} task={task} onOpen={onOpenTask} wrap />
                            ))}
                            {dayTasks.length === 0 && (
                                <p className="px-1 pt-1 text-xs text-muted">{t('calendar.emptyDay')}</p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
