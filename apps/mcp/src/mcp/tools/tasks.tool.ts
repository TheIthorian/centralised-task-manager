import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CtmApiClient } from '@ctm/api-client';

const dueSchema = z.object({
    date: z.string(),
    timezone: z.string().optional(),
    recurrence: z.string().optional(),
});

const durationSchema = z.object({
    amount: z.number().int().min(1),
    unit: z.enum(['minute', 'day']),
});

/** Register all task-related MCP tools on the given server instance. */
export function registerTaskTools(server: McpServer, client: CtmApiClient): void {
    server.registerTool(
        'list_tasks',
        {
            description: 'List tasks. Optionally filter by status or restrict to tasks updated on/after a date.',
            inputSchema: {
                filter: z.enum(['all', 'today', 'upcoming', 'done']).default('all'),
                lastUpdatedFromDate: z.string().optional().describe('ISO date string — only return tasks updated on or after this date'),
            },
            annotations: { readOnlyHint: true },
        },
        async ({ filter, lastUpdatedFromDate }) => {
            const tasks = await client.listTasks({ filter, lastUpdatedFromDate });
            return { content: [{ type: 'text' as const, text: JSON.stringify(tasks) }] };
        },
    );

    server.registerTool(
        'create_task',
        {
            description: 'Create a new task.',
            inputSchema: {
                title: z.string().min(1),
                description: z.string().optional(),
                priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
                due: dueSchema.optional(),
                deadlineDate: z.string().optional(),
                duration: durationSchema.optional(),
                source: z.string().min(1),
            },
            annotations: { destructiveHint: false, idempotentHint: false },
        },
        async ({ title, description, priority, due, deadlineDate, duration, source }) => {
            const task = await client.createTask({
                dto: { title, description, priority, due, deadlineDate, duration, source },
            });
            return { content: [{ type: 'text' as const, text: JSON.stringify(task) }] };
        },
    );

    server.registerTool(
        'update_task',
        {
            description: 'Update an existing task by ID.',
            inputSchema: {
                id: z.string().min(1),
                title: z.string().optional(),
                description: z.string().optional(),
                priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
                due: dueSchema.optional(),
                deadlineDate: z.string().optional(),
                duration: durationSchema.optional(),
                tags: z.array(z.string()).optional(),
            },
            annotations: { destructiveHint: false, idempotentHint: true },
        },
        async ({ id, title, description, priority, due, deadlineDate, duration, tags }) => {
            const task = await client.updateTask({
                id,
                dto: { title, description, priority, due, deadlineDate, duration, tags },
            });
            return { content: [{ type: 'text' as const, text: JSON.stringify(task) }] };
        },
    );

    server.registerTool(
        'complete_task',
        {
            description: 'Mark a task as complete by ID.',
            inputSchema: { id: z.string().min(1) },
            annotations: { destructiveHint: false, idempotentHint: true },
        },
        async ({ id }) => {
            const task = await client.setTaskStatus({ id, dto: { status: 'done' } });
            return { content: [{ type: 'text' as const, text: JSON.stringify(task) }] };
        },
    );

    server.registerTool(
        'delete_task',
        {
            description: 'Permanently delete a task by ID.',
            inputSchema: { id: z.string().min(1) },
            annotations: { destructiveHint: true, idempotentHint: true },
        },
        async ({ id }) => {
            await client.deleteTask({ id });
            return { content: [{ type: 'text' as const, text: `Task ${id} deleted.` }] };
        },
    );

    server.registerTool(
        'set_fuzzy_deadline',
        {
            description: 'Set a fuzzy deadline on a task.',
            inputSchema: {
                id: z.string().min(1),
                type: z.enum(['this_week', 'this_month', 'someday']),
                remindEvery: z.enum(['daily', 'weekly']).optional(),
            },
            annotations: { destructiveHint: false, idempotentHint: true },
        },
        async ({ id, type, remindEvery }) => {
            const task = await client.setFuzzyDeadline({ id, dto: { type, remindEvery } });
            return { content: [{ type: 'text' as const, text: JSON.stringify(task) }] };
        },
    );
}
