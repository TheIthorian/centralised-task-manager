import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, SegmentedControl } from '@ctm/ui';
import type { TaskDto, UpdateTaskDto, SetFuzzyDeadlineDto } from '@ctm/api-client';
import { useAuth } from '../auth/AuthContext.js';
import { TaskModal } from '../components/tasks/TaskModal.js';
import { CalendarColumns } from '../components/calendar/CalendarColumns.js';
import { CalendarMonth } from '../components/calendar/CalendarMonth.js';
import { buildDays, rangeLabel, shiftAnchor, toDateKey, CALENDAR_RANGES, type CalendarRange } from '../lib/calendar-range.js';

/** Calendar over a month, a week, three days or one day. Tasks appear on their due date. */
export function CalendarPage(): React.JSX.Element {
    const { t, i18n } = useTranslation();
    const [range, setRange] = useState<CalendarRange>('month');
    const [anchor, setAnchor] = useState(() => new Date());
    const [editTask, setEditTask] = useState<TaskDto | null>(null);
    const { api } = useAuth();
    const qc = useQueryClient();

    const { data: tasks = [] } = useQuery({
        queryKey: ['calendar-tasks'],
        queryFn: () => api.listTasks({ filter: 'all' }),
    });

    const locale = i18n.language;
    const days = buildDays({ anchor, range });
    const tasksByDate = groupByDueDate(tasks);
    const todayKey = toDateKey(new Date());

    const saveMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskDto }) => api.updateTask({ id, dto }),
        onSuccess: (updated) => {
            qc.setQueryData<TaskDto[]>(['tasks', 'all'], (prev = []) =>
                prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteTask({ id }),
        onSuccess: (_data, id) => {
            qc.setQueryData<TaskDto[]>(['tasks', 'all'], (prev = []) => prev.filter((t) => t.id !== id));
        },
    });

    const setFuzzyMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: SetFuzzyDeadlineDto }) => api.setFuzzyDeadline({ id, dto }),
        onSuccess: (updated) => {
            qc.setQueryData<TaskDto[]>(['tasks', 'all'], (prev = []) =>
                prev.map((t) => (t.id === updated.id ? { ...t, fuzzyDeadline: updated.fuzzyDeadline } : t)),
            );
        },
    });

    const removeFuzzyMutation = useMutation({
        mutationFn: (id: string) => api.removeFuzzyDeadline({ id }),
        onSuccess: (updated) => {
            qc.setQueryData<TaskDto[]>(['tasks', 'all'], (prev = []) =>
                prev.map((t) => (t.id === updated.id ? { ...t, fuzzyDeadline: null } : t)),
            );
        },
    });

    const step = (direction: 1 | -1): void => setAnchor((current) => shiftAnchor({ anchor: current, range, direction }));

    return (
        <div className="p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3 pr-24">
                <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('calendar.title')}</h1>

                <div className="ml-auto flex items-center gap-2">
                    <SegmentedControl
                        label={t('calendar.rangeLabel')}
                        value={range}
                        onChange={setRange}
                        options={CALENDAR_RANGES.map((option) => ({
                            value: option,
                            label: t(`calendar.ranges.${option}`),
                        }))}
                    />
                    <Button variant="secondary" onClick={() => setAnchor(new Date())} className="text-xs">
                        {t('calendar.today')}
                    </Button>
                    <Button variant="ghost" onClick={() => step(-1)} aria-label={t('calendar.previous')}>
                        ‹
                    </Button>
                    <span className="min-w-[150px] text-center text-sm font-semibold tracking-tight">
                        {rangeLabel({ anchor, range, locale })}
                    </span>
                    <Button variant="ghost" onClick={() => step(1)} aria-label={t('calendar.next')}>
                        ›
                    </Button>
                </div>
            </div>

            {range === 'month' ? (
                <CalendarMonth
                    days={days}
                    tasksByDate={tasksByDate}
                    todayKey={todayKey}
                    locale={locale}
                    onOpenTask={setEditTask}
                />
            ) : (
                <CalendarColumns
                    days={days}
                    tasksByDate={tasksByDate}
                    todayKey={todayKey}
                    locale={locale}
                    onOpenTask={setEditTask}
                />
            )}

            <TaskModal
                task={editTask}
                open={editTask !== null}
                onClose={() => setEditTask(null)}
                onSave={async (id, dto) => {
                    await saveMutation.mutateAsync({ id, dto });
                }}
                onDelete={async (id) => {
                    await deleteMutation.mutateAsync(id);
                }}
                onSetFuzzyDeadline={async (id, dto) => {
                    await setFuzzyMutation.mutateAsync({ id, dto });
                }}
                isSaving={saveMutation.isPending}
                isDeleting={deleteMutation.isPending}
                isSettingFuzzy={setFuzzyMutation.isPending}
                isRemovingFuzzy={removeFuzzyMutation.isPending}
            />
        </div>
    );
}

/** Groups tasks by the calendar day they are due. Tasks with no due date are left out. */
function groupByDueDate(tasks: TaskDto[]): Map<string, TaskDto[]> {
    const map = new Map<string, TaskDto[]>();

    for (const task of tasks) {
        if (!task.due?.date) continue;

        const key = task.due.date.slice(0, 10);

        map.set(key, [...(map.get(key) ?? []), task]);
    }

    return map;
}
