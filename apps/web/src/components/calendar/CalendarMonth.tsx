import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { TaskDto } from '@ctm/api-client';
import { toDateKey } from '../../lib/calendar-range.js';
import { TaskChip } from './TaskChip.js';

const VISIBLE_PER_DAY = 3;

export type CalendarMonthProps = {
    days: Date[];
    tasksByDate: Map<string, TaskDto[]>;
    todayKey: string;
    locale: string;
    onOpenTask: (task: TaskDto) => void;
};

/** The month grid: seven columns, a cell per day, capped so no row grows taller than the rest. */
export function CalendarMonth({
    days,
    tasksByDate,
    todayKey,
    locale,
    onOpenTask,
}: CalendarMonthProps): React.JSX.Element {
    const { t } = useTranslation();
    const first = days[0] as Date;
    const leading = Array.from({ length: first.getDay() }, (_, index) => index);
    const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: 'short' });

    // The names come from the first week on screen rather than a constant, so a locale that
    // does not start its week on Sunday only has to change startOfRange.
    const weekdayNames = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(first);
        date.setDate(first.getDate() - first.getDay() + index);

        return weekdayFormat.format(date);
    });

    return (
        <div>
            <div className="grid grid-cols-7 overflow-hidden rounded-t-ctm border border-b-0 border-line">
                {weekdayNames.map((name) => (
                    <div
                        key={name}
                        className="border-r border-line bg-nav-on-bg py-1.5 text-center text-[10px] uppercase tracking-[0.1em] text-muted last:border-r-0"
                    >
                        {name}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 overflow-hidden rounded-b-ctm border border-line">
                {leading.map((index) => (
                    <div key={`lead-${index}`} className="min-h-[104px] border-b border-r border-line" />
                ))}

                {days.map((date) => {
                    const key = toDateKey(date);
                    const dayTasks = tasksByDate.get(key) ?? [];
                    const hidden = dayTasks.length - VISIBLE_PER_DAY;

                    return (
                        <div
                            key={key}
                            className="flex min-h-[104px] flex-col gap-1 border-b border-r border-line p-1.5 last:border-r-0"
                        >
                            <span
                                className={clsx(
                                    'self-start rounded-full px-1.5 text-xs tabular-nums',
                                    key === todayKey ? 'bg-accent font-semibold text-accent-fg' : 'text-muted',
                                )}
                            >
                                {date.getDate()}
                            </span>
                            <div className="flex flex-col gap-0.5 overflow-hidden">
                                {dayTasks.slice(0, VISIBLE_PER_DAY).map((task) => (
                                    <TaskChip key={task.id} task={task} onOpen={onOpenTask} />
                                ))}
                                {hidden > 0 && (
                                    <span className="px-1.5 text-xs text-muted">
                                        {t('calendar.more', { count: hidden })}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
