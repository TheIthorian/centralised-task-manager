import type { ApiHttpClient } from '../../http/api-http-client.js';
import type { DomainClientOptions } from '../../http/http.types.js';
import type { OkDto } from '../shared.types.js';
import type {
    AddReminderParams,
    AddRelationParams,
    CreateTaskParams,
    DeleteTaskParams,
    GetTaskParams,
    ListTasksParams,
    ReminderDto,
    RemoveFuzzyDeadlineParams,
    RemoveRelationParams,
    RemoveReminderParams,
    SetFuzzyDeadlineParams,
    SetTaskStatusParams,
    TaskDto,
    TaskFilter,
    UpdateTaskParams,
} from './tasks.types.js';

/** Tasks and everything hanging off a task: reminders, fuzzy deadlines, relations. */
export class TasksClient {
    private readonly http: ApiHttpClient;

    constructor({ http }: DomainClientOptions) {
        this.http = http;
    }

    /** List tasks, optionally filtered by UI filter and/or update date. */
    async listTasks({
        filter,
        lastUpdatedFromDate,
        page,
        limit,
        status,
        dueBefore,
        dueAfter,
        noDate,
    }: ListTasksParams = {}): Promise<TaskDto[]> {
        const params: Record<string, string> = filter ? filterToParams(filter) : {};

        if (status) params['status'] = status;

        if (lastUpdatedFromDate) params['lastUpdatedFromDate'] = lastUpdatedFromDate;

        if (page !== undefined) params['page'] = String(page);

        if (limit !== undefined) params['limit'] = String(limit);

        if (dueBefore) params['dueBefore'] = dueBefore;

        if (dueAfter) params['dueAfter'] = dueAfter;

        if (noDate !== undefined) params['noDate'] = String(noDate);

        return this.http.request<TaskDto[]>({
            method: 'GET',
            path: '/tasks',
            params,
        });
    }

    /** Get a single task by ID. */
    async getTask({ id }: GetTaskParams): Promise<TaskDto> {
        return this.http.request<TaskDto>({ method: 'GET', path: `/tasks/${id}` });
    }

    /** Create a new task. */
    async createTask({ dto }: CreateTaskParams): Promise<TaskDto> {
        return this.http.request<TaskDto>({ method: 'POST', path: '/tasks', body: dto });
    }

    /** Update an existing task. */
    async updateTask({ id, dto }: UpdateTaskParams): Promise<TaskDto> {
        return this.http.request<TaskDto>({ method: 'PATCH', path: `/tasks/${id}`, body: dto });
    }

    /** Delete a task permanently. */
    async deleteTask({ id }: DeleteTaskParams): Promise<void> {
        await this.http.request<void>({ method: 'DELETE', path: `/tasks/${id}` });
    }

    /** Set task status to 'open' or 'done'. */
    async setTaskStatus({ id, dto }: SetTaskStatusParams): Promise<TaskDto> {
        return this.http.request<TaskDto>({ method: 'PUT', path: `/tasks/${id}/status`, body: dto });
    }

    /** Set the fuzzy deadline for an existing task. */
    async setFuzzyDeadline({ id, dto }: SetFuzzyDeadlineParams): Promise<TaskDto> {
        return this.http.request<TaskDto>({ method: 'PATCH', path: `/tasks/${id}/fuzzy-deadline`, body: dto });
    }

    /** Remove the fuzzy deadline from a task. */
    async removeFuzzyDeadline({ id }: RemoveFuzzyDeadlineParams): Promise<TaskDto> {
        return this.http.request<TaskDto>({ method: 'DELETE', path: `/tasks/${id}/fuzzy-deadline` });
    }

    /** Add a reminder datetime to a task. */
    async addReminder({ id, dto }: AddReminderParams): Promise<ReminderDto> {
        return this.http.request<ReminderDto>({ method: 'POST', path: `/tasks/${id}/reminders`, body: dto });
    }

    /** Remove a reminder from a task by its index in the reminders array. */
    async removeReminder({ id, index }: RemoveReminderParams): Promise<OkDto> {
        return this.http.request<OkDto>({ method: 'DELETE', path: `/tasks/${id}/reminders/${index}` });
    }

    /** Add a typed relation between two tasks. */
    async addRelation({ id, dto }: AddRelationParams): Promise<TaskDto> {
        return this.http.request<TaskDto>({ method: 'POST', path: `/tasks/${id}/relations`, body: dto });
    }

    /** Remove a typed relation between two tasks. */
    async removeRelation({ id, dto }: RemoveRelationParams): Promise<TaskDto> {
        return this.http.request<TaskDto>({ method: 'DELETE', path: `/tasks/${id}/relations`, body: dto });
    }
}

function filterToParams(filter: TaskFilter): Record<string, string> {
    switch (filter) {
        case 'done':
            return { status: 'done' };
        case 'today':
            return { filter: 'today' };
        case 'upcoming':
            return { filter: 'upcoming' };
        case 'all':
        default:
            return { filter: 'all' };
    }
}
