import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskDto, UpdateTaskDto, SetFuzzyDeadlineDto } from '@ctm/api-client';
import { useAuth } from '../auth/AuthContext.js';
import { TaskModal } from '../components/tasks/TaskModal.js';

const DAY_WIDTH_PX = 24;
const LEFT_COL_PX = 180;

/*
 * Outlined rather than filled: bars overlap on a busy week, and two solid blocks on top of
 * each other lose both titles. A tint with a coloured edge keeps every bar readable.
 */
const PRIORITY_BAR: Record<number, string> = {
    1: 'border-warn bg-warn-bg text-warn',
    2: 'border-accent bg-accent/15 text-fg',
    3: 'border-line bg-panel text-fg',
    4: 'border-line bg-panel text-muted',
};

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffDays(a: Date, b: Date): number {
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function shortDate(d: Date): string {
    return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
}

/** Horizontal scrollable timeline. Tasks shown as bars from createdAt to dueDate. */
export function TimelinePage(): React.JSX.Element {
    const { api } = useAuth();
    const qc = useQueryClient();
    const [editTask, setEditTask] = useState<TaskDto | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['timeline-tasks'],
        queryFn: () => api.listTasks({ filter: 'all' }),
    });

    const saveMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskDto }) => api.updateTask({ id, dto }),
        onSuccess: (updated) => {
            qc.setQueryData<TaskDto[]>(['timeline-tasks'], (prev = []) =>
                prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteTask({ id }),
        onSuccess: (_data, id) => {
            qc.setQueryData<TaskDto[]>(['timeline-tasks'], (prev = []) => prev.filter((t) => t.id !== id));
        },
    });

    const setFuzzyMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: SetFuzzyDeadlineDto }) => api.setFuzzyDeadline({ id, dto }),
        onSuccess: (updated) => {
            qc.setQueryData<TaskDto[]>(['timeline-tasks'], (prev = []) =>
                prev.map((t) => (t.id === updated.id ? { ...t, fuzzyDeadline: updated.fuzzyDeadline } : t)),
            );
        },
    });

    const removeFuzzyMutation = useMutation({
        mutationFn: (id: string) => api.removeFuzzyDeadline({ id }),
        onSuccess: (updated) => {
            qc.setQueryData<TaskDto[]>(['timeline-tasks'], (prev = []) =>
                prev.map((t) => (t.id === updated.id ? { ...t, fuzzyDeadline: null } : t)),
            );
        },
    });

    // Compute time range
    const today = startOfDay(new Date());
    const tasksWithDates = tasks.filter((t) => t.createdAt);
    const starts = tasksWithDates.map((t) => startOfDay(new Date(t.createdAt)));
    const ends = tasksWithDates.map((t) =>
        t.due?.date ? startOfDay(new Date(t.due.date)) : startOfDay(new Date(t.createdAt)),
    );

    const minDate = starts.length > 0 ? new Date(Math.min(...starts.map((d) => d.getTime()))) : today;
    const maxDate = ends.length > 0 ? new Date(Math.max(...ends.map((d) => d.getTime()))) : today;

    const rangeStart = new Date(minDate.getTime() - 7 * 86_400_000);
    const rangeEnd = new Date(maxDate.getTime() + 7 * 86_400_000);
    const totalDays = Math.max(diffDays(rangeStart, rangeEnd), 30);
    const canvasWidth = totalDays * DAY_WIDTH_PX;

    // Month tick marks for the axis
    type MonthTick = { label: string; leftPx: number };
    const monthTicks: MonthTick[] = [];
    const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);

    while (cursor <= rangeEnd) {
        const offsetDays = diffDays(rangeStart, cursor);
        if (offsetDays >= 0) {
            monthTicks.push({
                label: `${cursor.toLocaleString('en', { month: 'short' })} ${cursor.getFullYear()}`,
                leftPx: offsetDays * DAY_WIDTH_PX,
            });
        }
        cursor.setMonth(cursor.getMonth() + 1);
    }

    const todayOffsetPx = diffDays(rangeStart, today) * DAY_WIDTH_PX;

    return (
        <div className="p-4 md:p-6 flex flex-col" style={{ height: 'calc(100dvh - 4rem)' }}>
            <h1 className="mb-4 pr-12 text-2xl font-semibold tracking-tight text-fg">
                Timeline
            </h1>

            {isLoading && (
                <p className="font-medium text-muted uppercase text-sm tracking-wide">
                    Loading…
                </p>
            )}

            {!isLoading && (
                <div className="flex border border-line overflow-hidden flex-1 min-h-0 rounded-ctm">
                    {/* Left column — task titles */}
                    <div
                        style={{ width: LEFT_COL_PX, minWidth: LEFT_COL_PX }}
                        className="flex flex-shrink-0 flex-col overflow-y-auto border-r border-line"
                    >
                        <div className="h-8 flex-shrink-0 border-b border-line bg-nav-on-bg" />
                        {tasks.map((task) => (
                            <div
                                key={task.id}
                                className="h-9 flex-shrink-0 border-b border-line/20 flex items-center px-2 overflow-hidden"
                            >
                                <span
                                    className={`truncate text-xs ${
                                        task.completed
                                            ? 'line-through text-muted'
                                            : 'text-fg'
                                    }`}
                                >
                                    {task.title}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Right — scrollable canvas */}
                    <div ref={scrollRef} className="overflow-x-auto overflow-y-auto flex-1">
                        <div style={{ width: canvasWidth, position: 'relative' }}>
                            {/* Time axis */}
                            <div
                                className="relative h-8 flex-shrink-0 border-b border-line bg-nav-on-bg"
                                style={{ width: canvasWidth }}
                            >
                                {monthTicks.map((tick) => (
                                    <span
                                        key={`${tick.label}-${tick.leftPx}`}
                                        className="pointer-events-none absolute top-0 flex h-full items-center pl-1 text-[10px] uppercase tracking-[0.1em] text-muted"
                                        style={{ left: tick.leftPx }}
                                    >
                                        {tick.label}
                                    </span>
                                ))}
                                {todayOffsetPx >= 0 && todayOffsetPx <= canvasWidth && (
                                    <div
                                        className="absolute top-0 bottom-0 w-px bg-warn"
                                        style={{ left: todayOffsetPx }}
                                    />
                                )}
                            </div>

                            {/* Task rows */}
                            {tasks.map((task) => {
                                const taskStart = startOfDay(new Date(task.createdAt));
                                const taskEnd = task.due?.date ? startOfDay(new Date(task.due.date)) : taskStart;
                                const leftPx = diffDays(rangeStart, taskStart) * DAY_WIDTH_PX;
                                const widthDays = Math.max(diffDays(taskStart, taskEnd), 1);
                                const widthPx = widthDays * DAY_WIDTH_PX;
                                const barClass = PRIORITY_BAR[task.priority ?? 3];

                                return (
                                    <div
                                        key={task.id}
                                        className="h-9 border-b border-line/20 relative"
                                        style={{ width: canvasWidth }}
                                    >
                                        {todayOffsetPx >= 0 && todayOffsetPx <= canvasWidth && (
                                            <div
                                                className="absolute top-0 bottom-0 w-px bg-warn/30 pointer-events-none"
                                                style={{ left: todayOffsetPx }}
                                            />
                                        )}
                                        <button
                                            onClick={() => setEditTask(task)}
                                            className={`absolute top-1.5 flex h-6 cursor-pointer items-center overflow-hidden rounded-[4px] border px-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${barClass} ${
                                                task.completed ? 'opacity-40' : ''
                                            }`}
                                            style={{ left: leftPx, width: Math.max(widthPx, 8) }}
                                            title={`${task.title} · ${shortDate(taskStart)} → ${shortDate(taskEnd)}`}
                                        >
                                            {widthPx > 40 && (
                                                <span className="font-medium text-xs truncate">{task.title}</span>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
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
