import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CtmApiClient } from '@ctm/api-client';

/** Register all task-related MCP tools on the given server instance. */
export function registerTaskTools(server: McpServer, client: CtmApiClient): void {
    server.tool(
        'list_tasks',
        'List tasks. Optionally filter by status.',
        { filter: z.enum(['all', 'today', 'upcoming', 'done']).default('all') },
        async ({ filter }) => {
            const tasks = await client.listTasks({ filter });
            return { content: [{ type: 'text' as const, text: JSON.stringify(tasks) }] };
        },
    );

    server.tool(
        'create_task',
        'Create a new task.',
        {
            title: z.string().min(1),
            description: z.string().optional(),
            priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
            dueDate: z.string().optional(),
            source: z.string().min(1),
        },
        async ({ title, description, priority, dueDate, source }) => {
            const task = await client.createTask({ dto: { title, description, priority, dueDate, source } });
            return { content: [{ type: 'text' as const, text: JSON.stringify(task) }] };
        },
    );

    server.tool(
        'update_task',
        'Update an existing task by ID.',
        {
            id: z.string().min(1),
            title: z.string().optional(),
            description: z.string().optional(),
            priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
            dueDate: z.string().optional(),
            completed: z.boolean().optional(),
        },
        async ({ id, title, description, priority, dueDate, completed }) => {
            const task = await client.updateTask({ id, dto: { title, description, priority, dueDate, completed } });
            return { content: [{ type: 'text' as const, text: JSON.stringify(task) }] };
        },
    );

    server.tool(
        'complete_task',
        'Mark a task as complete by ID.',
        { id: z.string().min(1) },
        async ({ id }) => {
            const task = await client.completeTask({ id });
            return { content: [{ type: 'text' as const, text: JSON.stringify(task) }] };
        },
    );

    server.tool(
        'delete_task',
        'Permanently delete a task by ID.',
        { id: z.string().min(1) },
        async ({ id }) => {
            await client.deleteTask({ id });
            return { content: [{ type: 'text' as const, text: `Task ${id} deleted.` }] };
        },
    );

    server.tool(
        'set_fuzzy_deadline',
        'Set a natural-language fuzzy deadline on a task (e.g. "end of next week").',
        {
            id: z.string().min(1),
            fuzzyDeadline: z.string().min(1),
        },
        async ({ id, fuzzyDeadline }) => {
            const task = await client.setFuzzyDeadline({ id, dto: { fuzzyDeadline } });
            return { content: [{ type: 'text' as const, text: JSON.stringify(task) }] };
        },
    );
}
