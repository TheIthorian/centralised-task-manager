import { type Command, Option } from 'commander';
import { buildClient } from '../client.js';
import { formatJson, formatTable, print } from '../output.js';
import type { TaskDto } from '@ctm/api-client';

function taskRow(t: TaskDto): string[] {
    const dueStr = t.due ? new Date(t.due.date).toLocaleDateString() + (t.due.recurrence ? ' ↻' : '') : '-';
    const deadlineStr = t.deadlineDate ? new Date(t.deadlineDate).toLocaleDateString() : '-';
    const durationStr = t.duration
        ? t.duration.unit === 'minute' ? `${t.duration.amount}m` : `${t.duration.amount}d`
        : '-';

    return [
        t.id,
        t.title,
        t.priority != null ? String(t.priority) : '-',
        dueStr,
        deadlineStr,
        durationStr,
        t.completed ? 'done' : 'open',
        t.tags.length > 0 ? t.tags.join(', ') : '-',
    ];
}

/** Register all `ctm tasks *` subcommands on the given program. */
export function registerTasksCommand(program: Command): void {
    const tasks = program
        .command('tasks')
        .description('Manage tasks')
        .option('--token <token>', 'API token (overrides stored credentials)')
        .option('--base-url <url>', 'API base URL');

    tasks
        .command('list')
        .description('List tasks')
        .addOption(
            new Option('--filter <filter>', 'Filter: all, today, upcoming, done')
                .choices(['all', 'today', 'upcoming', 'done'])
                .default('all'),
        )
        .option('--json', 'Output as JSON')
        .action(async (opts: { filter: 'all' | 'today' | 'upcoming' | 'done'; json?: boolean }) => {
            const parent = tasks.opts<{ token?: string; baseUrl?: string }>();

            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const result = await client.listTasks({ filter: opts.filter });

                if (opts.json) {
                    print(formatJson(result));
                } else {
                    print(formatTable(['ID', 'Title', 'Priority', 'Due', 'Deadline', 'Duration', 'Status', 'Tags'], result.map(taskRow)));
                }
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    tasks
        .command('create')
        .description('Create a new task')
        .requiredOption('--title <title>', 'Task title')
        .requiredOption('--source <source>', 'Task source (e.g. "local")')
        .option('--description <desc>', 'Task description')
        .option('--priority <n>', 'Priority 1-4')
        .option('--due <date>', 'Due date (ISO 8601, e.g. 2026-06-01)')
        .option('--recurrence <rrule>', 'Recurrence RRULE string (e.g. FREQ=WEEKLY;BYDAY=MO)')
        .option('--deadline <date>', 'Hard deadline date (ISO 8601)')
        .option('--duration <amount>', 'Duration amount (integer)')
        .option('--duration-unit <unit>', 'Duration unit: minute or day')
        .option('--parent <id>', 'Parent task CTM ID')
        .option('--json', 'Output as JSON')
        .action(
            async (opts: {
                title: string;
                source: string;
                description?: string;
                priority?: string;
                due?: string;
                recurrence?: string;
                deadline?: string;
                duration?: string;
                durationUnit?: string;
                parent?: string;
                json?: boolean;
            }) => {
                const parent = tasks.opts<{ token?: string; baseUrl?: string }>();

                try {
                    const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });

                    let priority: 1 | 2 | 3 | 4 | undefined;

                    if (opts.priority != null) {
                        const p = Number(opts.priority);

                        if (!Number.isInteger(p) || p < 1 || p > 4) {
                            console.error('Priority must be 1, 2, 3, or 4');
                            process.exit(1);
                        }

                        priority = p as 1 | 2 | 3 | 4;
                    }

                    const task = await client.createTask({
                        dto: {
                            title: opts.title,
                            source: opts.source,
                            description: opts.description,
                            priority,
                            due: opts.due ? { date: opts.due, recurrence: opts.recurrence } : undefined,
                            deadlineDate: opts.deadline,
                            duration: opts.duration
                                ? { amount: Number(opts.duration), unit: (opts.durationUnit ?? 'minute') as 'minute' | 'day' }
                                : undefined,
                            parentId: opts.parent,
                        },
                    });

                    if (opts.json) {
                        print(formatJson(task));
                    } else {
                        print(formatTable(['ID', 'Title', 'Priority', 'Due', 'Status', 'Tags'], [taskRow(task)]));
                    }
                } catch (err: unknown) {
                    console.error(err instanceof Error ? err.message : String(err));
                    process.exit(1);
                }
            },
        );

    tasks
        .command('update')
        .description('Update a task by ID')
        .argument('<id>', 'Task ID')
        .option('--title <title>', 'New title')
        .option('--description <desc>', 'New description')
        .option('--priority <n>', 'New priority 1-4')
        .option('--due <date>', 'New due date (ISO 8601)')
        .option('--recurrence <rrule>', 'Recurrence RRULE string')
        .option('--deadline <date>', 'Hard deadline date (ISO 8601)')
        .option('--duration <amount>', 'Duration amount')
        .option('--duration-unit <unit>', 'Duration unit: minute or day')
        .option('--tags <tags>', 'Comma-separated tags')
        .option('--json', 'Output as JSON')
        .action(
            async (
                id: string,
                opts: {
                    title?: string;
                    description?: string;
                    priority?: string;
                    due?: string;
                    recurrence?: string;
                    deadline?: string;
                    duration?: string;
                    durationUnit?: string;
                    tags?: string;
                    json?: boolean;
                },
            ) => {
                const parent = tasks.opts<{ token?: string; baseUrl?: string }>();

                try {
                    const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });

                    let priority: 1 | 2 | 3 | 4 | undefined;

                    if (opts.priority != null) {
                        const p = Number(opts.priority);

                        if (!Number.isInteger(p) || p < 1 || p > 4) {
                            console.error('Priority must be 1, 2, 3, or 4');
                            process.exit(1);
                        }

                        priority = p as 1 | 2 | 3 | 4;
                    }

                    const tags = opts.tags != null ? opts.tags.split(',').map((t) => t.trim()) : undefined;
                    const task = await client.updateTask({
                        id,
                        dto: {
                            title: opts.title,
                            description: opts.description,
                            priority,
                            due: opts.due ? { date: opts.due, recurrence: opts.recurrence } : undefined,
                            deadlineDate: opts.deadline,
                            duration: opts.duration
                                ? { amount: Number(opts.duration), unit: (opts.durationUnit ?? 'minute') as 'minute' | 'day' }
                                : undefined,
                            tags,
                        },
                    });

                    if (opts.json) {
                        print(formatJson(task));
                    } else {
                        print(formatTable(['ID', 'Title', 'Priority', 'Due', 'Status', 'Tags'], [taskRow(task)]));
                    }
                } catch (err: unknown) {
                    console.error(err instanceof Error ? err.message : String(err));
                    process.exit(1);
                }
            },
        );

    tasks
        .command('complete')
        .description('Mark a task as complete')
        .argument('<id>', 'Task ID')
        .option('--json', 'Output as JSON')
        .action(async (id: string, opts: { json?: boolean }) => {
            const parent = tasks.opts<{ token?: string; baseUrl?: string }>();

            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const task = await client.setTaskStatus({ id, dto: { status: 'done' } });

                if (opts.json) {
                    print(formatJson(task));
                } else {
                    print(`Task ${task.id} marked as done.`);
                }
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    tasks
        .command('delete')
        .description('Permanently delete a task')
        .argument('<id>', 'Task ID')
        .action(async (id: string) => {
            const parent = tasks.opts<{ token?: string; baseUrl?: string }>();

            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                await client.deleteTask({ id });

                print(`Task ${id} deleted.`);
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    tasks
        .command('set-fuzzy-deadline')
        .description('Set a fuzzy deadline on a task')
        .argument('<id>', 'Task ID')
        .addOption(
            new Option('--type <type>', 'Deadline type: this_week, this_month, someday')
                .choices(['this_week', 'this_month', 'someday'])
                .makeOptionMandatory(),
        )
        .addOption(new Option('--remind <interval>', 'Reminder interval: daily, weekly').choices(['daily', 'weekly']))
        .option('--json', 'Output as JSON')
        .action(
            async (
                id: string,
                opts: { type: 'this_week' | 'this_month' | 'someday'; remind?: 'daily' | 'weekly'; json?: boolean },
            ) => {
                const parent = tasks.opts<{ token?: string; baseUrl?: string }>();

                try {
                    const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                    const task = await client.setFuzzyDeadline({
                        id,
                        dto: { type: opts.type, remindEvery: opts.remind },
                    });

                    if (opts.json) {
                        print(formatJson(task));
                    } else {
                        print(formatTable(['ID', 'Title', 'Priority', 'Due', 'Status', 'Tags'], [taskRow(task)]));
                    }
                } catch (err: unknown) {
                    console.error(err instanceof Error ? err.message : String(err));
                    process.exit(1);
                }
            },
        );
}
