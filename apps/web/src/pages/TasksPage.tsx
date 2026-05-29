import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskDto, TaskFilter, CreateTaskDto, UpdateTaskDto, SetFuzzyDeadlineDto } from '@ctm/api-client';
import { getErrorMessage } from '../api/error-message.js';
import { useAuth } from '../auth/AuthContext.js';
import { TaskFilters } from '../components/tasks/TaskFilters.js';
import { TaskList } from '../components/tasks/TaskList.js';
import { GroupedTaskList } from '../components/tasks/GroupedTaskList.js';
import { AddTaskInline } from '../components/tasks/AddTaskInline.js';
import { TaskModal } from '../components/tasks/TaskModal.js';

/** Main task management page. Filter is stored in the URL (?filter=today). Opening a specific task is via ?taskId=<id>. */
export function TasksPage(): React.JSX.Element {
    const [searchParams, setSearchParams] = useSearchParams();
    const filter = (searchParams.get('filter') ?? 'all') as TaskFilter;
    const taskIdParam = searchParams.get('taskId');
    const highlightTaskIdParam = searchParams.get('highlightTaskId');
    const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
    const [editTask, setEditTask] = useState<TaskDto | null>(null);
    const { api } = useAuth();

    const qc = useQueryClient();

    // Highlight task when ?highlightTaskId= is present (e.g. navigated from a notification).
    useEffect(() => {
        if (!highlightTaskIdParam) return;

        setHighlightedTaskId(highlightTaskIdParam);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);

            next.delete('highlightTaskId');

            return next;
        }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightTaskIdParam]);

    // Clear highlight when user clicks anywhere.
    useEffect(() => {
        if (!highlightedTaskId) return;

        const handler = (): void => setHighlightedTaskId(null);

        document.addEventListener('click', handler, { once: true });

        return () => document.removeEventListener('click', handler);
    }, [highlightedTaskId]);

    // Open the task modal when ?taskId= is present (e.g. navigated from a notification).
    useEffect(() => {
        if (!taskIdParam) return;

        api.getTask({ id: taskIdParam })
            .then((task) => {
                setEditTask(task);
                setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);

                    next.delete('taskId');

                    return next;
                }, { replace: true });
            })
            .catch(() => {
                setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);

                    next.delete('taskId');

                    return next;
                }, { replace: true });
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskIdParam]);

    const midnightYesterday = (() => {
        const d = new Date();

        d.setDate(d.getDate() - 1);
        d.setHours(0, 0, 0, 0);

        return d.toISOString();
    })();

    const {
        data: tasks = [],
        isLoading,
        isError,
        error,
    } = useQuery({
        queryKey: ['tasks', filter],
        queryFn: () => api.listTasks({
            filter,
            lastUpdatedFromDate: filter === 'done' ? midnightYesterday : undefined,
        }),
    });

    const addMutation = useMutation({
        mutationFn: (dto: CreateTaskDto) => api.createTask({ dto }),
        onSuccess: (created) => {
            qc.setQueryData<TaskDto[]>(['tasks', filter], (prev = []) => [created, ...prev]);
        },
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
            api.setTaskStatus({ id, dto: { status: completed ? 'done' : 'open' } }),
        onMutate: async ({ id, completed }) => {
            await qc.cancelQueries({ queryKey: ['tasks', filter] });
            const prev = qc.getQueryData<TaskDto[]>(['tasks', filter]);

            qc.setQueryData<TaskDto[]>(['tasks', filter], (old = []) =>
                old.map((t) => (t.id === id ? { ...t, completed } : t)),
            );

            return { prev };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) qc.setQueryData(['tasks', filter], ctx.prev);
        },
    });

    const saveMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskDto }) => api.updateTask({ id, dto }),
        onSuccess: (updated) => {
            qc.setQueryData<TaskDto[]>(['tasks', filter], (prev = []) =>
                prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteTask({ id }),
        onSuccess: (_data, id) => {
            qc.setQueryData<TaskDto[]>(['tasks', filter], (prev = []) => prev.filter((t) => t.id !== id));
        },
    });

    const setFuzzyMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: SetFuzzyDeadlineDto }) =>
            api.setFuzzyDeadline({ id, dto }),
        onSuccess: (updated) => {
            qc.setQueryData<TaskDto[]>(['tasks', filter], (prev = []) =>
                prev.map((t) => (t.id === updated.id ? { ...t, fuzzyDeadline: updated.fuzzyDeadline } : t)),
            );
        },
    });

    const removeFuzzyMutation = useMutation({
        mutationFn: (id: string) => api.removeFuzzyDeadline({ id }),
        onSuccess: (updated) => {
            qc.setQueryData<TaskDto[]>(['tasks', filter], (prev = []) =>
                prev.map((t) => (t.id === updated.id ? { ...t, fuzzyDeadline: null } : t)),
            );
        },
    });

    return (
        <div className="p-4 md:p-6 max-w-2xl">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-nb-black dark:text-white">My Tasks</h1>
                    {!isLoading && (
                        <p className="text-nb-black/60 dark:text-white/50 font-bold text-sm">
                            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <TaskFilters active={filter} onChange={(f) => setSearchParams({ filter: f })} />

                <AddTaskInline
                    onAdd={async (dto) => {
                        await addMutation.mutateAsync(dto);
                    }}
                    isPending={addMutation.isPending}
                />

                {isLoading && <p className="font-bold text-nb-black/60 dark:text-white/50 uppercase text-sm tracking-wide">Loading…</p>}

                {isError && (
                    <div className="border-2 border-nb-red bg-nb-red/10 p-3">
                        <p className="text-nb-red font-bold text-sm">
                            {getErrorMessage(error, 'Failed to load tasks. Is the API running?')}
                        </p>
                    </div>
                )}

                {!isLoading && !isError && (
                    filter === 'all' ? (
                        <GroupedTaskList
                            tasks={tasks}
                            highlightedTaskId={highlightedTaskId}
                            onToggle={(id, completed) => {
                                statusMutation.mutate({ id, completed });
                            }}
                            onEdit={setEditTask}
                        />
                    ) : (
                        <TaskList
                            tasks={tasks}
                            highlightedTaskId={highlightedTaskId}
                            onToggle={(id, completed) => {
                                statusMutation.mutate({ id, completed });
                            }}
                            onEdit={setEditTask}
                        />
                    )
                )}
            </div>

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
