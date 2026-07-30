import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Banner, Skeleton } from '@ctm/ui';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskDto, TaskFilter, CreateTaskDto, UpdateTaskDto, SetFuzzyDeadlineDto } from '@ctm/api-client';
import { getErrorMessage } from '../api/error-message.js';
import { useAuth } from '../auth/AuthContext.js';
import { TaskFilters } from '../components/tasks/TaskFilters.js';
import { TaskList } from '../components/tasks/TaskList.js';
import { GroupedTaskList } from '../components/tasks/GroupedTaskList.js';
import { AddTaskInline } from '../components/tasks/AddTaskInline.js';
import { TaskModal } from '../components/tasks/TaskModal.js';
import { useGroupedTaskQueries } from '../hooks/useGroupedTaskQueries.js';

const PAGE_SIZE = 20;

/** Main task management page. Filter is stored in the URL (?filter=today). Opening a specific task is via ?taskId=<id>. */
export function TasksPage(): React.JSX.Element {
    const { t } = useTranslation();
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
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);

                next.delete('highlightTaskId');

                return next;
            },
            { replace: true },
        );
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
                setSearchParams(
                    (prev) => {
                        const next = new URLSearchParams(prev);

                        next.delete('taskId');

                        return next;
                    },
                    { replace: true },
                );
            })
            .catch(() => {
                setSearchParams(
                    (prev) => {
                        const next = new URLSearchParams(prev);

                        next.delete('taskId');

                        return next;
                    },
                    { replace: true },
                );
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskIdParam]);

    // Flat list infinite query (today / upcoming / done).
    const flatQuery = useInfiniteQuery<TaskDto[]>({
        queryKey: ['tasks', filter],
        queryFn: ({ pageParam }) =>
            api.listTasks({
                filter,
                page: pageParam as number,
                limit: PAGE_SIZE,
            }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, pages) =>
            lastPage?.length === PAGE_SIZE ? pages.length + 1 : undefined,
        enabled: filter !== 'all',
    });

    const flatTasks = flatQuery.data?.pages.flat() ?? [];
    const flatIsLoading = flatQuery.isLoading;
    const flatIsError = flatQuery.isError;

    // Per-bucket grouped queries (all filter only).
    const groupedResults = useGroupedTaskQueries({ api, enabled: filter === 'all' });

    const addMutation = useMutation({
        mutationFn: (dto: CreateTaskDto) => api.createTask({ dto }),
        onSuccess: (created) => {
            if (filter === 'all') {
                // Invalidate the relevant bucket so it refetches
                qc.invalidateQueries({ queryKey: ['tasks', 'grouped'] });
            } else {
                qc.setQueryData<{ pages: TaskDto[][] }>(['tasks', filter], (prev) => {
                    if (!prev) return prev;

                    return { ...prev, pages: [[created, ...(prev.pages[0] ?? [])], ...prev.pages.slice(1)] };
                });
            }
        },
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
            api.setTaskStatus({ id, dto: { status: completed ? 'done' : 'open' } }),
        // No onMutate. TanStack Query offers optimistic updates and we decline them: the
        // moment the client patches its own cache it can show a state the backend never
        // agreed to. Our API answers in one short hop, and the connector push is reported
        // on the connector row rather than faked in the list.
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tasks'] });
        },
    });

    const saveMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskDto }) => api.updateTask({ id, dto }),
        onSuccess: () => {
            if (filter === 'all') {
                qc.invalidateQueries({ queryKey: ['tasks', 'grouped'] });
            } else {
                qc.invalidateQueries({ queryKey: ['tasks', filter] });
            }
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteTask({ id }),
        onSuccess: (_data, id) => {
            if (filter === 'all') {
                qc.invalidateQueries({ queryKey: ['tasks', 'grouped'] });
            } else {
                qc.setQueryData<{ pages: TaskDto[][] }>(['tasks', filter], (prev) => {
                    if (!prev) return prev;

                    return { ...prev, pages: prev.pages.map((page) => page.filter((t) => t.id !== id)) };
                });
            }
        },
    });

    const setFuzzyMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: SetFuzzyDeadlineDto }) => api.setFuzzyDeadline({ id, dto }),
        onSuccess: () => {
            if (filter === 'all') {
                qc.invalidateQueries({ queryKey: ['tasks', 'grouped'] });
            } else {
                qc.invalidateQueries({ queryKey: ['tasks', filter] });
            }
        },
    });

    const removeFuzzyMutation = useMutation({
        mutationFn: (id: string) => api.removeFuzzyDeadline({ id }),
        onSuccess: () => {
            if (filter === 'all') {
                qc.invalidateQueries({ queryKey: ['tasks', 'grouped'] });
            } else {
                qc.invalidateQueries({ queryKey: ['tasks', filter] });
            }
        },
    });

    // Only the row being written to dims, so the rest of the list stays usable.
    const pendingTaskId = statusMutation.isPending ? (statusMutation.variables?.id ?? null) : null;

    const handleToggle = useCallback(
        (id: string, completed: boolean) => {
            statusMutation.mutate({ id, completed });
        },
        [statusMutation],
    );

    const totalLoaded = filter === 'all'
        ? Object.values(groupedResults).reduce((sum, r) => sum + r.tasks.length, 0)
        : flatTasks.length;

    const isLoading = filter === 'all' ? false : flatIsLoading;
    const isError = filter === 'all' ? false : flatIsError;

    return (
        <div className="p-4 md:p-6">
            <div className="mb-5 flex items-end justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                    <h1 className="text-xl font-semibold tracking-tight text-fg">{t('tasks.title')}</h1>
                    {!isLoading && (
                        <p className="text-xs text-muted" aria-live="polite">
                            {t('tasks.openCount', { count: totalLoaded })}
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

                {isLoading && <Skeleton rows={5} />}

                {isError && (
                    <Banner
                        tone="warn"
                        title={t('tasks.loadFailed.title')}
                        body={getErrorMessage(flatQuery.error, t('tasks.loadFailed.body'))}
                    />
                )}

                {!isLoading &&
                    !isError &&
                    (filter === 'all' ? (
                        <GroupedTaskList
                            groupedResults={groupedResults}
                            highlightedTaskId={highlightedTaskId}
                            onToggle={handleToggle}
                            onEdit={setEditTask}
                            pendingTaskId={pendingTaskId}
                        />
                    ) : (
                        <TaskList
                            tasks={flatTasks}
                            highlightedTaskId={highlightedTaskId}
                            onToggle={handleToggle}
                            onEdit={setEditTask}
                            pendingTaskId={pendingTaskId}
                            hasNextPage={flatQuery.hasNextPage}
                            isFetchingNextPage={flatQuery.isFetchingNextPage}
                            fetchNextPage={flatQuery.fetchNextPage}
                        />
                    ))}
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
