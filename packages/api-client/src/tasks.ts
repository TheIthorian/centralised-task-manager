import { getClient } from './client.js';
import type { TaskDto, CreateTaskDto, UpdateTaskDto, SetFuzzyDeadlineDto, TaskFilter } from './types.js';

/** Map a frontend TaskFilter to backend query params. */
function filterToParams(filter: TaskFilter): Record<string, string> {
    switch (filter) {
        case 'done':
            return { status: 'done' };
        case 'today':
        case 'upcoming':
            return { status: 'open' };
        case 'all':
        default:
            return {};
    }
}

/** List tasks, optionally filtered by status. */
export async function listTasks(filter: TaskFilter = 'all'): Promise<TaskDto[]> {
    const { data } = await getClient().get<TaskDto[]>('/tasks', { params: filterToParams(filter) });

    return data;
}

/** Create a new task. */
export async function createTask(dto: CreateTaskDto): Promise<TaskDto> {
    const { data } = await getClient().post<TaskDto>('/tasks', dto);

    return data;
}

/** Update an existing task. */
export async function updateTask(id: string, dto: UpdateTaskDto): Promise<TaskDto> {
    const { data } = await getClient().patch<TaskDto>(`/tasks/${id}`, dto);

    return data;
}

/** Delete a task permanently. */
export async function deleteTask(id: string): Promise<void> {
    await getClient().delete(`/tasks/${id}`);
}

/** Set (or clear) a fuzzy deadline on a task. */
export async function setFuzzyDeadline(id: string, dto: SetFuzzyDeadlineDto): Promise<TaskDto> {
    const { data } = await getClient().patch<TaskDto>(`/tasks/${id}/fuzzy-deadline`, dto);

    return data;
}
