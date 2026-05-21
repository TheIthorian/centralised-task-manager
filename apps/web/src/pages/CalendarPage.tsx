import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskDto, UpdateTaskDto, SetFuzzyDeadlineDto } from '@ctm/api-client';
import { useAuth } from '../auth/AuthContext.js';
import { TaskModal } from '../components/tasks/TaskModal.js';

/** Returns YYYY-MM-DD string for a given year, 0-indexed month, and day. */
function toDateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Group tasks by their dueDate (YYYY-MM-DD). Tasks without dueDate are excluded. */
function groupByDueDate(tasks: TaskDto[]): Map<string, TaskDto[]> {
    const map = new Map<string, TaskDto[]>();

    for (const task of tasks) {
        if (!task.dueDate) continue;
        const key = task.dueDate.slice(0, 10);
        const existing = map.get(key) ?? [];
        existing.push(task);
        map.set(key, existing);
    }

    return map;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const PRIORITY_CHIP_CLASS: Record<number, string> = {
    1: 'bg-nb-red text-white',
    2: 'bg-nb-yellow text-nb-black',
    3: 'bg-white text-nb-black',
    4: 'bg-white text-nb-black',
};

/** Monthly calendar grid. Tasks appear on their due date. */
export function CalendarPage(): React.JSX.Element {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [editTask, setEditTask] = useState<TaskDto | null>(null);
    const { api } = useAuth();
    const qc = useQueryClient();

    const { data: tasks = [] } = useQuery({
        queryKey: ['tasks', 'all'],
        queryFn: () => api.listTasks({ filter: 'all' }),
    });

    const tasksByDate = groupByDueDate(tasks);

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

    type GridCell = { day: number; key: string } | null;

    const cells: GridCell[] = [
        ...Array.from<GridCell>({ length: firstDayOfWeek }).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i): GridCell => ({
            day: i + 1,
            key: toDateKey(year, month, i + 1),
        })),
    ];

    const prevMonth = (): void => {
        if (month === 0) { setMonth(11); setYear((y) => y - 1); }
        else setMonth((m) => m - 1);
    };

    const nextMonth = (): void => {
        if (month === 11) { setMonth(0); setYear((y) => y + 1); }
        else setMonth((m) => m + 1);
    };

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

    return (
        <div className="p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <h1 className="text-2xl font-black uppercase tracking-tight text-nb-black">Calendar</h1>
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
                        className="border-2 border-nb-black px-2 py-0.5 font-black text-xs uppercase"
                    >
                        Today
                    </button>
                    <button
                        onClick={prevMonth}
                        className="border-2 border-nb-black px-2 py-0.5 font-black text-sm"
                        aria-label="Previous month"
                    >
                        ‹
                    </button>
                    <span className="font-black text-sm uppercase min-w-[120px] text-center">
                        {MONTH_NAMES[month]} {year}
                    </span>
                    <button
                        onClick={nextMonth}
                        className="border-2 border-nb-black px-2 py-0.5 font-black text-sm"
                        aria-label="Next month"
                    >
                        ›
                    </button>
                </div>
            </div>

            {/* Day name headers */}
            <div className="grid grid-cols-7 border-2 border-b-0 border-nb-black">
                {DAY_NAMES.map((d) => (
                    <div
                        key={d}
                        className="border-r-2 last:border-r-0 border-nb-black bg-nb-black text-nb-yellow font-black text-xs uppercase text-center py-1"
                    >
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 border-2 border-nb-black">
                {cells.map((cell, idx) => {
                    const isToday = cell?.key === todayKey;
                    const cellTasks = cell ? (tasksByDate.get(cell.key) ?? []) : [];

                    return (
                        <div
                            key={idx}
                            className="border-r-2 border-b-2 last-of-type:border-r-0 border-nb-black min-h-[80px] p-1 flex flex-col"
                        >
                            {cell !== null && (
                                <>
                                    <span
                                        className={`font-black text-xs self-start px-1 mb-1 ${
                                            isToday ? 'bg-nb-black text-nb-yellow' : 'text-nb-black'
                                        }`}
                                    >
                                        {cell.day}
                                    </span>
                                    <div className="flex flex-col gap-0.5 overflow-hidden">
                                        {cellTasks.slice(0, 3).map((task) => (
                                            <button
                                                key={task.id}
                                                onClick={() => setEditTask(task)}
                                                className={`text-left text-xs font-bold px-1 truncate border border-nb-black ${
                                                    PRIORITY_CHIP_CLASS[task.priority ?? 3]
                                                } ${task.completed ? 'line-through opacity-50' : ''}`}
                                            >
                                                {task.title}
                                            </button>
                                        ))}
                                        {cellTasks.length > 3 && (
                                            <span className="text-xs font-bold text-nb-black/60">
                                                +{cellTasks.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            <TaskModal
                task={editTask}
                open={editTask !== null}
                onClose={() => setEditTask(null)}
                onSave={async (id, dto) => { await saveMutation.mutateAsync({ id, dto }); }}
                onDelete={async (id) => { await deleteMutation.mutateAsync(id); }}
                onSetFuzzyDeadline={async (id, dto) => { await setFuzzyMutation.mutateAsync({ id, dto }); }}
                onRemoveFuzzyDeadline={async (id) => { await removeFuzzyMutation.mutateAsync(id); }}
                isSaving={saveMutation.isPending}
                isDeleting={deleteMutation.isPending}
                isSettingFuzzy={setFuzzyMutation.isPending}
                isRemovingFuzzy={removeFuzzyMutation.isPending}
            />
        </div>
    );
}
