import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskDto, TaskFilter, CreateTaskDto, UpdateTaskDto } from '@ctm/api-client';
import { useAuth } from '../auth/AuthContext.js';
import { TaskFilters } from '../components/tasks/TaskFilters.js';
import { TaskList } from '../components/tasks/TaskList.js';
import { AddTaskInline } from '../components/tasks/AddTaskInline.js';
import { TaskModal } from '../components/tasks/TaskModal.js';

/** Main task management page. Filter is stored in the URL (?filter=today). */
export function TasksPage(): React.JSX.Element {
    const [searchParams, setSearchParams] = useSearchParams();
    const filter = (searchParams.get('filter') ?? 'all') as TaskFilter;
    const [editTask, setEditTask] = useState<TaskDto | null>(null);
    const { api } = useAuth();

    const qc = useQueryClient();

    const {
        data: tasks = [],
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['tasks', filter],
        queryFn: () => api.listTasks({ filter }),
    });

    const addMutation = useMutation({
        mutationFn: (dto: CreateTaskDto) => api.createTask({ dto }),
        onSuccess: (created) => {
            qc.setQueryData<TaskDto[]>(['tasks', filter], (prev = []) => [created, ...prev]);
        },
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, completed }: { id: string; completed: boolean }) => api.updateTask({ id, dto: { completed } }),
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

    return (
        <div className="p-4 md:p-6 max-w-2xl">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-nb-black">My Tasks</h1>
                    {!isLoading && (
                        <p className="text-nb-black/60 font-bold text-sm">
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

                {isLoading && <p className="font-bold text-nb-black/60 uppercase text-sm tracking-wide">Loading…</p>}

                {isError && (
                    <div className="border-2 border-nb-red bg-nb-red/10 p-3">
                        <p className="text-nb-red font-bold text-sm">Failed to load tasks. Is the API running?</p>
                    </div>
                )}

                {!isLoading && !isError && (
                    <TaskList
                        tasks={tasks}
                        onToggle={(id, completed) => toggleMutation.mutate({ id, completed })}
                        onEdit={setEditTask}
                    />
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
                isSaving={saveMutation.isPending}
                isDeleting={deleteMutation.isPending}
            />
        </div>
    );
}
