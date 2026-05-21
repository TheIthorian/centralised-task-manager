import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CtmApiClient } from '@ctm/api-client';

/** Register all task-related MCP tools on the given server instance. */
export function registerTaskTools(server: McpServer, client: CtmApiClient): void {
    server.registerTool(
        'list_tasks',
        {
            description: 'List tasks. Optionally filter by status.',
            inputSchema: { filter: z.enum(['all', 'today', 'upcoming', 'done']).default('all') },
        },
        async ({ filter }) => {
            const tasks = await client.listTasks({ filter });
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
                dueDate: z.string().optional(),
                source: z.string().min(1),
            },
        },
        async ({ title, description, priority, dueDate, source }) => {
            const task = await client.createTask({ dto: { title, description, priority, dueDate, source } });
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
                dueDate: z.string().optional(),
                tags: z.array(z.string()).optional(),
            },
        },
        async ({ id, title, description, priority, dueDate, tags }) => {
            const task = await client.updateTask({ id, dto: { title, description, priority, dueDate, tags } });
            return { content: [{ type: 'text' as const, text: JSON.stringify(task) }] };
        },
    );

    server.registerTool(
        'complete_task',
        {
            description: 'Mark a task as complete by ID.',
            inputSchema: { id: z.string().min(1) },
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
        },
        async ({ id, type, remindEvery }) => {
            const task = await client.setFuzzyDeadline({ id, dto: { type, remindEvery } });
            return { content: [{ type: 'text' as const, text: JSON.stringify(task) }] };
        },
    );
}
