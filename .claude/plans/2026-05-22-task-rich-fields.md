# Task Rich Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add parent/child tasks, exact deadlines, durations, and rich due dates (with timezone and RRULE recurrence) as native CTM concepts across connectors, API, web, CLI, and MCP.

**Architecture:** Changes flow bottom-up: connector types → connector implementations → main app schema/DTOs/service/controller → api-client types → web/CLI/MCP consumers. Each layer depends on the previous. The recurrence model is RRULE strings (RFC 5545); connectors translate to/from their native format. Parent/child is CTM-native: set at first sync insert or on create, never mutated by subsequent syncs.

**Tech Stack:** TypeScript, NestJS + Fastify, Mongoose, Vitest, React + Tailwind CSS v4, Commander.js (CLI), Zod + MCP SDK.

---

## File Map

| File | Change |
|---|---|
| `packages/connectors/src/types.ts` | Replace `dueDate` with `due`, add `deadline`, `duration`, `parentSourceId` on `RemoteTask`; same on connector `CreateTaskDto`/`UpdateTaskDto` |
| `packages/connectors/src/todoist/todoist.types.ts` | Fix `deadline`/`duration` from `null` to real types |
| `packages/connectors/src/todoist/todoist-recurrence.ts` | **NEW** — `todoistStringToRrule` and `rruleToTodoistString` |
| `packages/connectors/src/todoist/todoist-recurrence.spec.ts` | **NEW** — unit tests for translator |
| `packages/connectors/src/todoist/todoist.connector.ts` | Update `toRemoteTask`, `createTask`, `updateTask` |
| `packages/connectors/src/todoist/todoist.connector.spec.ts` | Update assertions from `dueDate` to `due` |
| `packages/connectors/src/google-tasks/google-tasks.connector.ts` | Update `toRemoteTask`, `createTask`, `updateTask` |
| `packages/connectors/src/google-tasks/google-tasks.connector.spec.ts` | Update assertions from `dueDate` to `due` |
| `apps/main/src/tasks/schemas/task.schema.ts` | Replace `sourceDueDate`, add `due`, `deadlineDate`, `duration`, `parentId` sub-schemas |
| `apps/main/src/tasks/schemas/task.schema.spec.ts` | Add tests for new fields |
| `apps/main/src/tasks/dto/create-task.dto.ts` | Replace `dueDate` with `due`, add `deadlineDate`, `duration`, `parentId` |
| `apps/main/src/tasks/dto/update-task.dto.ts` | Replace `dueDate` with `due`, add `deadlineDate`, `duration` |
| `apps/main/src/tasks/tasks.controller.ts` | Update `TaskResponse` type + `toResponse` |
| `apps/main/src/tasks/tasks.service.ts` | Update `create`, `update`, `upsertFromRemote` |
| `apps/main/src/tasks/tasks.controller.spec.ts` | Update `StubConnector.makeTask`, add new-field assertions |
| `packages/api-client/src/types.ts` | Update `TaskDto`, `CreateTaskDto`, `UpdateTaskDto` |
| `apps/web/src/components/tasks/TaskCard.tsx` | Display `due`, `deadlineDate`, `duration`, recurring badge |
| `apps/web/src/components/tasks/TaskModal.tsx` | Edit `due`, recurrence, `deadlineDate`, `duration` |
| `apps/web/src/components/tasks/AddTaskInline.tsx` | Replace `dueDate` field with `due` |
| `apps/cli/src/commands/tasks.ts` | Add `--due`, `--recurrence`, `--deadline`, `--duration`, `--duration-unit`, `--parent` flags |
| `apps/mcp/src/mcp/tools/tasks.tool.ts` | Add `due`, `deadlineDate`, `duration`, `parentId` to `create_task` and `update_task` schemas |

---

## Task 1: Update Connector Types

**Files:**
- Modify: `packages/connectors/src/types.ts`

- [ ] **Step 1: Replace the file contents**

Replace the entire `packages/connectors/src/types.ts` with:

```ts
export type DueDate = {
    date: Date;
    timezone: string | null;
    recurrence: string | null;
};

export type Duration = {
    amount: number;
    unit: 'minute' | 'day';
};

export type RemoteTask = {
    sourceId: string;
    title: string;
    description: string | null;
    status: 'open' | 'done';
    priority: number | null;
    due: DueDate | null;
    deadline: Date | null;
    duration: Duration | null;
    parentSourceId: string | null;
    tags: string[];
};

export type OAuthTokens = {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
};

export type CreateTaskDto = {
    title: string;
    description?: string;
    due?: { date: Date; timezone?: string; recurrence?: string };
    deadlineDate?: Date;
    duration?: Duration;
    priority?: number;
};

export type UpdateTaskDto = {
    title?: string;
    description?: string;
    due?: { date: Date; timezone?: string; recurrence?: string };
    deadlineDate?: Date;
    duration?: Duration;
    priority?: number;
};

export type TaskConnector = {
    readonly source: string;
    getAuthUrl(userId: string): string;
    exchangeCode(code: string): Promise<OAuthTokens>;
    refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;
    fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]>;
    createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask>;
    updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask>;
    completeTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
    deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
};
```

- [ ] **Step 2: Verify TypeScript compiles in connectors package**

```bash
pnpm --filter @ctm/connectors build
```

Expected: TypeScript errors on `dueDate` references in connector implementations (fixed in later tasks). Note the errors but do not fix yet.

- [ ] **Step 3: Commit**

```bash
git add packages/connectors/src/types.ts
git commit -m "feat(connectors): update RemoteTask and DTOs for rich task fields"
```

---

## Task 2: Fix Todoist Types

**Files:**
- Modify: `packages/connectors/src/todoist/todoist.types.ts`

- [ ] **Step 1: Update the file**

Replace the entire file:

```ts
/** Todoist API task object. See: https://developer.todoist.com/rest/reference#get-active-tasks */
export type TodoistTask = {
    user_id: string;
    id: string;
    project_id: string;
    section_id: string | null;
    parent_id: string | null;
    added_by_uid: string;
    assigned_by_uid: string | null;
    responsible_uid: string | null;
    labels: string[];
    deadline: { date: string; lang: string; string: string } | null;
    duration: { amount: number; unit: 'minute' | 'day' } | null;
    is_collapsed: boolean;
    checked: boolean;
    is_deleted: boolean;
    added_at: string;
    completed_at: string | null;
    completed_by_uid: string | null;
    updated_at: string;
    due: { date: string; timezone: string | null; string: string; lang: string; is_recurring: boolean } | null;
    priority: number;
    child_order: number;
    content: string;
    description: string;
    note_count: number;
    day_order: number;
    goal_ids: string[];
};

export type TodoistTokenResponse = {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number;
};

export type TodoistTasksResponse = {
    results: TodoistTask[];
    next_cursor: string | null;
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/connectors/src/todoist/todoist.types.ts
git commit -m "feat(connectors): fix Todoist deadline and duration types"
```

---

## Task 3: Todoist Recurrence Translator

**Files:**
- Create: `packages/connectors/src/todoist/todoist-recurrence.ts`
- Create: `packages/connectors/src/todoist/todoist-recurrence.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/connectors/src/todoist/todoist-recurrence.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { todoistStringToRrule, rruleToTodoistString } from './todoist-recurrence.js';

describe('todoistStringToRrule', () => {
    it('maps "every day" → FREQ=DAILY', () => {
        expect(todoistStringToRrule('every day')).toBe('FREQ=DAILY');
    });

    it('maps "every 3 days" → FREQ=DAILY;INTERVAL=3', () => {
        expect(todoistStringToRrule('every 3 days')).toBe('FREQ=DAILY;INTERVAL=3');
    });

    it('maps "every week" → FREQ=WEEKLY', () => {
        expect(todoistStringToRrule('every week')).toBe('FREQ=WEEKLY');
    });

    it('maps "every 2 weeks" → FREQ=WEEKLY;INTERVAL=2', () => {
        expect(todoistStringToRrule('every 2 weeks')).toBe('FREQ=WEEKLY;INTERVAL=2');
    });

    it('maps "every monday" → FREQ=WEEKLY;BYDAY=MO', () => {
        expect(todoistStringToRrule('every monday')).toBe('FREQ=WEEKLY;BYDAY=MO');
    });

    it('maps "every friday" → FREQ=WEEKLY;BYDAY=FR', () => {
        expect(todoistStringToRrule('every friday')).toBe('FREQ=WEEKLY;BYDAY=FR');
    });

    it('maps "every workday" → FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', () => {
        expect(todoistStringToRrule('every workday')).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    });

    it('maps "every month" → FREQ=MONTHLY', () => {
        expect(todoistStringToRrule('every month')).toBe('FREQ=MONTHLY');
    });

    it('maps "every 3 months" → FREQ=MONTHLY;INTERVAL=3', () => {
        expect(todoistStringToRrule('every 3 months')).toBe('FREQ=MONTHLY;INTERVAL=3');
    });

    it('maps "every year" → FREQ=YEARLY', () => {
        expect(todoistStringToRrule('every year')).toBe('FREQ=YEARLY');
    });

    it('is case-insensitive', () => {
        expect(todoistStringToRrule('Every Day')).toBe('FREQ=DAILY');
    });

    it('returns null for unknown patterns and calls logger.warn', () => {
        const logger = { warn: vi.fn() };
        const result = todoistStringToRrule('every other weekend', logger);
        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('every other weekend'),
        );
    });
});

describe('rruleToTodoistString', () => {
    it('maps FREQ=DAILY → "every day"', () => {
        expect(rruleToTodoistString('FREQ=DAILY')).toBe('every day');
    });

    it('maps FREQ=DAILY;INTERVAL=3 → "every 3 days"', () => {
        expect(rruleToTodoistString('FREQ=DAILY;INTERVAL=3')).toBe('every 3 days');
    });

    it('maps FREQ=WEEKLY → "every week"', () => {
        expect(rruleToTodoistString('FREQ=WEEKLY')).toBe('every week');
    });

    it('maps FREQ=WEEKLY;INTERVAL=2 → "every 2 weeks"', () => {
        expect(rruleToTodoistString('FREQ=WEEKLY;INTERVAL=2')).toBe('every 2 weeks');
    });

    it('maps FREQ=WEEKLY;BYDAY=MO → "every monday"', () => {
        expect(rruleToTodoistString('FREQ=WEEKLY;BYDAY=MO')).toBe('every monday');
    });

    it('maps FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR → "every workday"', () => {
        expect(rruleToTodoistString('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')).toBe('every workday');
    });

    it('maps FREQ=MONTHLY → "every month"', () => {
        expect(rruleToTodoistString('FREQ=MONTHLY')).toBe('every month');
    });

    it('maps FREQ=MONTHLY;INTERVAL=3 → "every 3 months"', () => {
        expect(rruleToTodoistString('FREQ=MONTHLY;INTERVAL=3')).toBe('every 3 months');
    });

    it('maps FREQ=YEARLY → "every year"', () => {
        expect(rruleToTodoistString('FREQ=YEARLY')).toBe('every year');
    });

    it('passes through unknown RRULE strings unchanged', () => {
        const unknown = 'FREQ=WEEKLY;BYDAY=MO,WE,FR';
        expect(rruleToTodoistString(unknown)).toBe(unknown);
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @ctm/connectors test -- --reporter=verbose todoist-recurrence
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the translator**

Create `packages/connectors/src/todoist/todoist-recurrence.ts`:

```ts
type Logger = { warn: (msg: string) => void };

const DAY_TO_BYDAY: Record<string, string> = {
    monday: 'MO',
    tuesday: 'TU',
    wednesday: 'WE',
    thursday: 'TH',
    friday: 'FR',
    saturday: 'SA',
    sunday: 'SU',
};

const BYDAY_TO_DAY: Record<string, string> = Object.fromEntries(
    Object.entries(DAY_TO_BYDAY).map(([day, code]) => [code, day]),
);

type PatternEntry = [RegExp, (match: RegExpMatchArray) => string];

const PATTERNS: PatternEntry[] = [
    [/^every day$/i, () => 'FREQ=DAILY'],
    [/^every (\d+) days?$/i, (m) => `FREQ=DAILY;INTERVAL=${m[1]}`],
    [/^every week$/i, () => 'FREQ=WEEKLY'],
    [/^every (\d+) weeks?$/i, (m) => `FREQ=WEEKLY;INTERVAL=${m[1]}`],
    [/^every workday$/i, () => 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'],
    [/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i, (m) => `FREQ=WEEKLY;BYDAY=${DAY_TO_BYDAY[m[1].toLowerCase()]}`],
    [/^every month$/i, () => 'FREQ=MONTHLY'],
    [/^every (\d+) months?$/i, (m) => `FREQ=MONTHLY;INTERVAL=${m[1]}`],
    [/^every year$/i, () => 'FREQ=YEARLY'],
];

/** Convert a Todoist recurrence string to an RRULE string. Returns null for unknown patterns. */
export function todoistStringToRrule(s: string, logger?: Logger): string | null {
    for (const [pattern, build] of PATTERNS) {
        const match = s.match(pattern);

        if (match) return build(match);
    }

    logger?.warn(`Unknown Todoist recurrence pattern: "${s}" — recurrence will be null`);

    return null;
}

/** Convert an RRULE string to a Todoist due_string. Returns the original string for unrecognised patterns. */
export function rruleToTodoistString(rrule: string): string {
    const parts = Object.fromEntries(rrule.split(';').map((p) => p.split('='))) as Record<string, string | undefined>;
    const freq = parts['FREQ'];
    const interval = parts['INTERVAL'] ? Number(parts['INTERVAL']) : 1;
    const byDay = parts['BYDAY'];

    if (freq === 'DAILY') return interval === 1 ? 'every day' : `every ${interval} days`;

    if (freq === 'WEEKLY') {
        if (byDay === 'MO,TU,WE,TH,FR') return 'every workday';

        if (byDay) {
            const days = byDay.split(',');

            if (days.length === 1 && BYDAY_TO_DAY[days[0]]) return `every ${BYDAY_TO_DAY[days[0]]}`;
        }

        return interval === 1 ? 'every week' : `every ${interval} weeks`;
    }

    if (freq === 'MONTHLY') return interval === 1 ? 'every month' : `every ${interval} months`;

    if (freq === 'YEARLY') return 'every year';

    return rrule;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @ctm/connectors test -- --reporter=verbose todoist-recurrence
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/connectors/src/todoist/todoist-recurrence.ts packages/connectors/src/todoist/todoist-recurrence.spec.ts
git commit -m "feat(connectors): add Todoist recurrence translator (RRULE ↔ due_string)"
```

---

## Task 4: Update Todoist Connector

**Files:**
- Modify: `packages/connectors/src/todoist/todoist.connector.ts`
- Modify: `packages/connectors/src/todoist/todoist.connector.spec.ts`

- [ ] **Step 1: Update the connector implementation**

Replace `packages/connectors/src/todoist/todoist.connector.ts`:

```ts
import { type Logger, HttpClient } from '@ctm/http-client';

import type { CreateTaskDto, OAuthTokens, RemoteTask, TaskConnector, UpdateTaskDto } from '../types.js';
import type { TodoistTask, TodoistTokenResponse, TodoistTasksResponse } from './todoist.types.js';
import { todoistStringToRrule, rruleToTodoistString } from './todoist-recurrence.js';

export type TodoistConnectorConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    logger?: Logger;
};

export class TodoistConnector implements TaskConnector {
    readonly source = 'todoist';

    private readonly http: HttpClient;
    private readonly authHttp: HttpClient;

    constructor(private readonly config: TodoistConnectorConfig) {
        this.http = new HttpClient({ baseUrl: 'https://api.todoist.com/api/v1', logger: config.logger });
        this.authHttp = new HttpClient({ baseUrl: 'https://todoist.com', logger: config.logger });
    }

    /** Build the OAuth authorization URL for the given user state. */
    getAuthUrl(userId: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            scope: 'task:add,data:read,data:delete',
            state: userId,
            redirect_uri: this.config.redirectUri,
        });

        return `https://todoist.com/oauth/authorize?${params.toString()}`;
    }

    /** Exchange authorization code for OAuth tokens. New apps receive short-lived access tokens with a refresh token. */
    async exchangeCode(code: string): Promise<OAuthTokens> {
        const res = await this.authHttp.post<TodoistTokenResponse>('/oauth/access_token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            redirect_uri: this.config.redirectUri,
        });

        const expiresIn = res.expires_in ?? 365 * 24 * 60 * 60;

        return {
            accessToken: res.access_token,
            refreshToken: res.refresh_token ?? '',
            expiresAt: new Date(Date.now() + expiresIn * 1000),
        };
    }

    /** Refresh an expired access token using the stored refresh token. */
    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        if (!tokens.refreshToken) {
            return tokens;
        }

        const res = await this.authHttp.post<TodoistTokenResponse>('/oauth/access_token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: tokens.refreshToken,
        });

        const expiresIn = res.expires_in ?? 365 * 24 * 60 * 60;

        return {
            accessToken: res.access_token,
            refreshToken: res.refresh_token ?? tokens.refreshToken,
            expiresAt: new Date(Date.now() + expiresIn * 1000),
        };
    }

    /** Fetch all open tasks from the authenticated user's Todoist account. */
    async fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]> {
        const res = await this.http.get<TodoistTasksResponse>('/tasks', {
            Authorization: `Bearer ${tokens.accessToken}`,
        });

        return res.results.map((t) => this.toRemoteTask(t));
    }

    /** Create a new task in Todoist. */
    async createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask> {
        const body: Record<string, unknown> = {
            content: task.title,
            description: task.description ?? '',
            priority: task.priority ?? 1,
        };

        if (task.due) {
            body['due_date'] = task.due.date.toISOString().split('T')[0];

            if (task.due.recurrence) {
                body['due_string'] = rruleToTodoistString(task.due.recurrence);
            }
        }

        if (task.deadlineDate) {
            body['deadline'] = { date: task.deadlineDate.toISOString().split('T')[0] };
        }

        if (task.duration) {
            body['duration'] = task.duration.amount;
            body['duration_unit'] = task.duration.unit;
        }

        const created = await this.http.post<TodoistTask>(
            '/tasks',
            body,
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        return this.toRemoteTask(created);
    }

    /** Update an existing task in Todoist. */
    async updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask> {
        const body: Record<string, unknown> = {
            content: patch.title,
            description: patch.description,
            priority: patch.priority,
        };

        if (patch.due !== undefined) {
            if (patch.due === null) {
                body['due_date'] = null;
            } else {
                body['due_date'] = patch.due.date.toISOString().split('T')[0];

                if (patch.due.recurrence) {
                    body['due_string'] = rruleToTodoistString(patch.due.recurrence);
                }
            }
        }

        if (patch.deadlineDate !== undefined) {
            body['deadline'] = patch.deadlineDate ? { date: patch.deadlineDate.toISOString().split('T')[0] } : null;
        }

        if (patch.duration !== undefined) {
            body['duration'] = patch.duration?.amount ?? null;
            body['duration_unit'] = patch.duration?.unit ?? null;
        }

        // Todoist REST v2 uses POST (not PATCH) for task updates
        const updated = await this.http.post<TodoistTask>(
            `/tasks/${sourceId}`,
            body,
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        return this.toRemoteTask(updated);
    }

    /** Mark a task as complete by posting to the close endpoint. */
    async completeTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        await this.http.post<void>(`/tasks/${sourceId}/close`, {}, { Authorization: `Bearer ${tokens.accessToken}` });
    }

    /** Permanently delete a task from Todoist. */
    async deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        await this.http.delete(`/tasks/${sourceId}`, { Authorization: `Bearer ${tokens.accessToken}` });
    }

    private toRemoteTask(task: TodoistTask): RemoteTask {
        const due = task.due
            ? {
                date: new Date(task.due.date),
                timezone: task.due.timezone,
                recurrence: task.due.is_recurring
                    ? todoistStringToRrule(task.due.string, this.config.logger)
                    : null,
            }
            : null;

        return {
            sourceId: task.id,
            title: task.content,
            description: task.description !== '' ? task.description : null,
            status: task.checked ? 'done' : 'open',
            priority: task.priority,
            due,
            deadline: task.deadline ? new Date(task.deadline.date) : null,
            duration: task.duration ?? null,
            parentSourceId: task.parent_id,
            tags: task.labels,
        };
    }
}
```

- [ ] **Step 2: Update the connector spec**

Replace `packages/connectors/src/todoist/todoist.connector.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExternalServiceError } from '@ctm/errors';
import { HttpClient } from '@ctm/http-client';

import type { OAuthTokens } from '../types.js';
import { TodoistConnector } from './todoist.connector.js';

vi.mock('@ctm/http-client', () => ({ HttpClient: vi.fn() }));

const config = {
    clientId: 'test_client_id',
    clientSecret: 'test_secret',
    redirectUri: 'http://localhost:3000/connectors/oauth/callback/todoist',
};

const tokens: OAuthTokens = {
    accessToken: 'test_access_token',
    refreshToken: 'test_refresh_token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

describe('TodoistConnector', () => {
    let connector: TodoistConnector;
    let mockHttp: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
    let mockAuthHttp: { post: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.resetAllMocks();

        mockHttp = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
        mockAuthHttp = { post: vi.fn() };

        vi.mocked(HttpClient)
            // eslint-disable-next-line prefer-arrow-callback
            .mockImplementationOnce(function () { return mockHttp as unknown as HttpClient; })
            // eslint-disable-next-line prefer-arrow-callback
            .mockImplementationOnce(function () { return mockAuthHttp as unknown as HttpClient; });

        connector = new TodoistConnector(config);
    });

    describe('getAuthUrl', () => {
        it('includes client_id, redirect_uri, scope, and state', () => {
            const url = connector.getAuthUrl('user-123');

            expect(url).toContain('client_id=test_client_id');
            expect(url).toContain('redirect_uri=');
            expect(url).toContain('state=user-123');
            expect(url).toContain('scope=task%3Aadd%2Cdata%3Aread%2Cdata%3Adelete');
        });
    });

    describe('fetchTasks', () => {
        it('maps Todoist tasks to RemoteTask shape', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 'task-1',
                        content: 'Buy milk',
                        description: 'From the supermarket',
                        checked: false,
                        priority: 2,
                        due: { date: '2026-06-01', timezone: 'America/New_York', string: '', lang: 'en', is_recurring: false },
                        deadline: null,
                        duration: null,
                        parent_id: null,
                        labels: ['shopping', 'errands'],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks).toHaveLength(1);
            expect(tasks[0]).toMatchObject({
                sourceId: 'task-1',
                title: 'Buy milk',
                description: 'From the supermarket',
                status: 'open',
                priority: 2,
                tags: ['shopping', 'errands'],
                deadline: null,
                duration: null,
                parentSourceId: null,
            });
            expect(tasks[0].due).toMatchObject({ timezone: 'America/New_York', recurrence: null });
            expect(tasks[0].due?.date).toBeInstanceOf(Date);
        });

        it('maps recurring due dates to RRULE recurrence string', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 'task-2',
                        content: 'Daily standup',
                        description: '',
                        checked: false,
                        priority: 1,
                        due: { date: '2026-06-01', timezone: null, string: 'every day', lang: 'en', is_recurring: true },
                        deadline: null,
                        duration: null,
                        parent_id: null,
                        labels: [],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks[0].due?.recurrence).toBe('FREQ=DAILY');
        });

        it('maps deadline and duration fields', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 'task-3',
                        content: 'Sprint task',
                        description: '',
                        checked: false,
                        priority: 1,
                        due: null,
                        deadline: { date: '2026-06-15', lang: 'en', string: 'Jun 15' },
                        duration: { amount: 90, unit: 'minute' },
                        parent_id: null,
                        labels: [],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks[0].deadline).toBeInstanceOf(Date);
            expect(tasks[0].duration).toEqual({ amount: 90, unit: 'minute' });
        });

        it('maps parent_id to parentSourceId', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 'child-1',
                        content: 'Child task',
                        description: '',
                        checked: false,
                        priority: 1,
                        due: null,
                        deadline: null,
                        duration: null,
                        parent_id: 'parent-1',
                        labels: [],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks[0].parentSourceId).toBe('parent-1');
        });

        it('maps completed tasks to status "done"', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 't2',
                        content: 'Done task',
                        description: '',
                        checked: true,
                        priority: 1,
                        due: null,
                        deadline: null,
                        duration: null,
                        parent_id: null,
                        labels: [],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks[0].status).toBe('done');
        });

        it('sets due to null when no due date', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 't3',
                        content: 'No due',
                        description: '',
                        checked: false,
                        priority: 1,
                        due: null,
                        deadline: null,
                        duration: null,
                        parent_id: null,
                        labels: [],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks[0].due).toBeNull();
        });
    });

    describe('createTask', () => {
        it('POSTs task fields to /tasks', async () => {
            mockHttp.post.mockResolvedValue({
                id: 'new-1',
                content: 'Buy coffee',
                description: '',
                checked: false,
                priority: 2,
                due: null,
                deadline: null,
                duration: null,
                parent_id: null,
                labels: [],
            });

            const task = await connector.createTask(tokens, { title: 'Buy coffee', priority: 2 });

            expect(task.sourceId).toBe('new-1');
            expect(task.title).toBe('Buy coffee');
            expect(mockHttp.post).toHaveBeenCalledWith(
                '/tasks',
                expect.objectContaining({ content: 'Buy coffee', priority: 2 }),
                { Authorization: 'Bearer test_access_token' },
            );
        });

        it('sends due_date and due_string for recurring tasks', async () => {
            mockHttp.post.mockResolvedValue({
                id: 'new-2',
                content: 'Stand up',
                description: '',
                checked: false,
                priority: 1,
                due: { date: '2026-06-01', timezone: null, string: 'every day', lang: 'en', is_recurring: true },
                deadline: null,
                duration: null,
                parent_id: null,
                labels: [],
            });

            await connector.createTask(tokens, {
                title: 'Stand up',
                due: { date: new Date('2026-06-01'), recurrence: 'FREQ=DAILY' },
            });

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/tasks',
                expect.objectContaining({ due_date: '2026-06-01', due_string: 'every day' }),
                expect.anything(),
            );
        });
    });

    describe('updateTask', () => {
        it('POSTs updated fields to /tasks/:id', async () => {
            mockHttp.post.mockResolvedValue({
                id: 'task-1',
                content: 'Updated',
                description: '',
                checked: false,
                priority: 1,
                due: null,
                deadline: null,
                duration: null,
                parent_id: null,
                labels: [],
            });

            const task = await connector.updateTask(tokens, 'task-1', { title: 'Updated' });

            expect(task.title).toBe('Updated');
            expect(mockHttp.post).toHaveBeenCalledWith(
                '/tasks/task-1',
                expect.objectContaining({ content: 'Updated' }),
                expect.anything(),
            );
        });
    });

    describe('completeTask', () => {
        it('POSTs to the close endpoint with the task id', async () => {
            mockHttp.post.mockResolvedValue(undefined);

            await connector.completeTask(tokens, 'task-1');

            expect(mockHttp.post).toHaveBeenCalledWith('/tasks/task-1/close', {}, {
                Authorization: 'Bearer test_access_token',
            });
        });
    });

    describe('deleteTask', () => {
        it('sends DELETE to the task endpoint', async () => {
            mockHttp.delete.mockResolvedValue(undefined);

            await connector.deleteTask(tokens, 'task-1');

            expect(mockHttp.delete).toHaveBeenCalledWith('/tasks/task-1', {
                Authorization: 'Bearer test_access_token',
            });
        });
    });

    describe('error handling', () => {
        it('propagates ExternalServiceError from HttpClient', async () => {
            mockHttp.get.mockRejectedValue(new ExternalServiceError('https://api.todoist.com/rest/v2/tasks', 'HTTP 429: rate limited'));

            await expect(connector.fetchTasks(tokens)).rejects.toThrow(ExternalServiceError);
        });

        it('rethrows non-http errors unchanged', async () => {
            mockHttp.get.mockRejectedValue(new TypeError('network fail'));

            await expect(connector.fetchTasks(tokens)).rejects.toThrow(TypeError);
        });
    });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @ctm/connectors test -- --reporter=verbose todoist.connector
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/connectors/src/todoist/todoist.connector.ts packages/connectors/src/todoist/todoist.connector.spec.ts
git commit -m "feat(connectors): update Todoist connector for rich task fields"
```

---

## Task 5: Update Google Tasks Connector

**Files:**
- Modify: `packages/connectors/src/google-tasks/google-tasks.connector.ts`
- Modify: `packages/connectors/src/google-tasks/google-tasks.connector.spec.ts`

- [ ] **Step 1: Update `toRemoteTask`, `createTask`, `updateTask` in the connector**

In `packages/connectors/src/google-tasks/google-tasks.connector.ts`, replace `toRemoteTask`, `createTask`, and `updateTask`:

```ts
// In createTask, replace the body object:
async createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask> {
    const listId = await this.getFirstListId(tokens);
    const created = await this.http.post<GoogleTask>(
        `/lists/${listId}/tasks`,
        {
            title: task.title,
            notes: task.description ?? '',
            due: task.due?.date.toISOString(),
        },
        { Authorization: `Bearer ${tokens.accessToken}` },
    );

    return this.toRemoteTask(listId, created);
}

// In updateTask, replace the body object:
async updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask> {
    const [listId, taskId] = this.splitSourceId(sourceId);
    const updated = await this.http.patch<GoogleTask>(
        `/lists/${listId}/tasks/${taskId}`,
        {
            title: patch.title,
            notes: patch.description,
            due: patch.due?.date.toISOString(),
        },
        { Authorization: `Bearer ${tokens.accessToken}` },
    );

    return this.toRemoteTask(listId, updated);
}

// Replace toRemoteTask:
private toRemoteTask(listId: string, task: GoogleTask): RemoteTask {
    return {
        sourceId: `${listId}:${task.id}`,
        title: task.title,
        description: task.notes ?? null,
        status: task.status === 'completed' ? 'done' : 'open',
        priority: null,
        due: task.due ? { date: new Date(task.due), timezone: null, recurrence: null } : null,
        deadline: null,
        duration: null,
        parentSourceId: null,
        tags: [],
    };
}
```

- [ ] **Step 2: Update the Google Tasks spec**

In `packages/connectors/src/google-tasks/google-tasks.connector.spec.ts`, find all assertions that reference `dueDate` and update them to `due`. Example:

Before:
```ts
expect(tasks[0].dueDate).toBeInstanceOf(Date);
```

After:
```ts
expect(tasks[0].due?.date).toBeInstanceOf(Date);
```

And:
```ts
expect(tasks[0].dueDate).toBeNull();
```

After:
```ts
expect(tasks[0].due).toBeNull();
```

- [ ] **Step 3: Run the Google Tasks tests**

```bash
pnpm --filter @ctm/connectors test -- --reporter=verbose google-tasks
```

Expected: all tests PASS.

- [ ] **Step 4: Run all connector tests**

```bash
pnpm --filter @ctm/connectors test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/connectors/src/google-tasks/
git commit -m "feat(connectors): update Google Tasks connector for rich task fields"
```

---

## Task 6: Update Task Schema

**Files:**
- Modify: `apps/main/src/tasks/schemas/task.schema.ts`
- Modify: `apps/main/src/tasks/schemas/task.schema.spec.ts`

- [ ] **Step 1: Write failing schema tests**

Add to `apps/main/src/tasks/schemas/task.schema.spec.ts`:

```ts
it('has due sub-document with date, timezone, recurrence', () => {
    const duePath = TaskSchema.path('due');
    expect(duePath).toBeDefined();
    expect(TaskSchema.path('due.date')).toBeDefined();
    expect(TaskSchema.path('due.timezone')).toBeDefined();
    expect(TaskSchema.path('due.recurrence')).toBeDefined();
});

it('has deadlineDate field defaulting to null', () => {
    const path = TaskSchema.path('deadlineDate');
    expect(path).toBeDefined();
    expect(path.options.default).toBeNull();
});

it('has duration sub-document with amount and unit', () => {
    expect(TaskSchema.path('duration.amount')).toBeDefined();
    expect(TaskSchema.path('duration.unit')).toBeDefined();
});

it('has parentId field defaulting to null', () => {
    const path = TaskSchema.path('parentId');
    expect(path).toBeDefined();
    expect(path.options.default).toBeNull();
});

it('does not have sourceDueDate field', () => {
    expect(TaskSchema.path('sourceDueDate')).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @ctm/main test -- --reporter=verbose task.schema
```

Expected: FAIL on the new assertions.

- [ ] **Step 3: Update the schema**

Replace `apps/main/src/tasks/schemas/task.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

export type FuzzyDeadlineType = 'this_week' | 'this_month' | 'someday';
export type RemindEvery = 'daily' | 'weekly';

@Schema({ _id: false })
class Location {
    @Prop({ type: String, required: true, maxlength: 200 })
    name!: string;

    @Prop({ type: String, required: true, maxlength: 500 })
    googleMapsUrl!: string;
}

const LocationSchema = SchemaFactory.createForClass(Location);

@Schema({ _id: false })
class FuzzyDeadline {
    @Prop({ type: String, required: true, enum: ['this_week', 'this_month', 'someday'] })
    type!: FuzzyDeadlineType;

    @Prop({ type: String, enum: ['daily', 'weekly'], default: null })
    remindEvery!: RemindEvery | null;
}

const FuzzyDeadlineSchema = SchemaFactory.createForClass(FuzzyDeadline);

@Schema({ _id: false })
class DueDate {
    @Prop({ type: Date, required: true })
    date!: Date;

    @Prop({ type: String, default: null })
    timezone!: string | null;

    @Prop({ type: String, default: null })
    recurrence!: string | null;
}

const DueDateSchema = SchemaFactory.createForClass(DueDate);

@Schema({ _id: false })
class Duration {
    @Prop({ type: Number, required: true })
    amount!: number;

    @Prop({ type: String, required: true, enum: ['minute', 'day'] })
    unit!: 'minute' | 'day';
}

const DurationSchema = SchemaFactory.createForClass(Duration);

@Schema({ timestamps: true })
export class Task {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId!: Types.ObjectId;

    @Prop({ type: String, required: true, maxlength: 50 })
    source!: string;

    @Prop({ type: String, required: true, maxlength: 255 })
    sourceId!: string;

    @Prop({ type: String, required: true, maxlength: 200 })
    title!: string;

    @Prop({ type: String, default: null, maxlength: 2000 })
    description!: string | null;

    @Prop({ type: String, required: true, enum: ['open', 'done', 'archived'], default: 'open' })
    status!: 'open' | 'done' | 'archived';

    @Prop({ type: Number, enum: [1, 2, 3, 4], default: null })
    priority!: 1 | 2 | 3 | 4 | null;

    @Prop({
        type: [String],
        default: [],
        validate: {
            validator: (tags: string[]): boolean => tags.every((tag) => tag.length <= 50),
            message: 'Each tag must be at most 50 characters long',
        },
    })
    tags!: string[];

    @Prop({ type: DueDateSchema, default: null })
    due!: { date: Date; timezone: string | null; recurrence: string | null } | null;

    @Prop({ type: Date, default: null })
    deadlineDate!: Date | null;

    @Prop({ type: DurationSchema, default: null })
    duration!: { amount: number; unit: 'minute' | 'day' } | null;

    @Prop({ type: Types.ObjectId, ref: 'Task', default: null })
    parentId!: Types.ObjectId | null;

    @Prop({ type: FuzzyDeadlineSchema, default: null })
    fuzzyDeadline!: FuzzyDeadline | null;

    @Prop({ type: [LocationSchema], default: [] })
    locations!: { name: string; googleMapsUrl: string }[];

    @Prop({ type: Date, required: true })
    syncedAt!: Date;

    createdAt?: Date;
    updatedAt?: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ userId: 1, source: 1, sourceId: 1 }, { unique: true });
TaskSchema.index({ userId: 1, status: 1 });
TaskSchema.index({ 'fuzzyDeadline.remindEvery': 1 });
```

- [ ] **Step 4: Run the schema tests**

```bash
pnpm --filter @ctm/main test -- --reporter=verbose task.schema
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/main/src/tasks/schemas/
git commit -m "feat(main): update Task schema — add due, deadlineDate, duration, parentId"
```

---

## Task 7: Update API DTOs

**Files:**
- Modify: `apps/main/src/tasks/dto/create-task.dto.ts`
- Modify: `apps/main/src/tasks/dto/update-task.dto.ts`

- [ ] **Step 1: Update `update-task.dto.ts`** (defines shared sub-DTOs — `create-task.dto.ts` already imports from here)

Replace the file:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString, IsOptional, IsISO8601, IsInt, Min, Max,
    IsArray, MaxLength, IsUrl, ValidateNested, IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LocationDto {
    @ApiPropertyOptional({ example: 'Eiffel Tower', maxLength: 200 })
    @IsString()
    @MaxLength(200)
    name!: string;

    @ApiPropertyOptional({ example: 'https://maps.google.com/?q=Eiffel+Tower', maxLength: 500 })
    @IsString()
    @IsUrl()
    @MaxLength(500)
    googleMapsUrl!: string;
}

export class DueDateDto {
    @ApiProperty({ example: '2026-06-01' })
    @IsISO8601()
    date!: string;

    @ApiPropertyOptional({ example: 'America/New_York' })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiPropertyOptional({ example: 'FREQ=WEEKLY;BYDAY=MO' })
    @IsOptional()
    @IsString()
    recurrence?: string;
}

export class DurationDto {
    @ApiProperty({ example: 90 })
    @IsInt()
    @Min(1)
    amount!: number;

    @ApiProperty({ example: 'minute', enum: ['minute', 'day'] })
    @IsEnum(['minute', 'day'])
    unit!: 'minute' | 'day';
}

export class UpdateTaskDto {
    @ApiPropertyOptional({ example: 'Updated title', maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;

    @ApiPropertyOptional({ example: 'Updated description', maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiPropertyOptional({ type: DueDateDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DueDateDto)
    due?: DueDateDto;

    @ApiPropertyOptional({ example: '2026-06-30' })
    @IsOptional()
    @IsISO8601()
    deadlineDate?: string;

    @ApiPropertyOptional({ type: DurationDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DurationDto)
    duration?: DurationDto;

    @ApiPropertyOptional({ minimum: 1, maximum: 4, example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(4)
    priority?: number;

    @ApiPropertyOptional({ type: [String], example: ['work', 'urgent'], maxLength: 50 })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @MaxLength(50, { each: true })
    tags?: string[];

    @ApiPropertyOptional({ type: [LocationDto], description: 'Locations with Google Maps links' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LocationDto)
    locations?: LocationDto[];
}
```

- [ ] **Step 2: Update `create-task.dto.ts`**

Replace the file:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString, IsNotEmpty, IsOptional, IsISO8601, Min, Max, IsInt,
    MaxLength, IsArray, ValidateNested, IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto, DueDateDto, DurationDto } from './update-task.dto.js';

export class CreateTaskDto {
    @ApiProperty({ example: 'Write quarterly report', maxLength: 200 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    title!: string;

    @ApiPropertyOptional({ example: 'Include Q1 metrics', maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiPropertyOptional({ type: DueDateDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DueDateDto)
    due?: DueDateDto;

    @ApiPropertyOptional({ example: '2026-06-30' })
    @IsOptional()
    @IsISO8601()
    deadlineDate?: string;

    @ApiPropertyOptional({ type: DurationDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DurationDto)
    duration?: DurationDto;

    @ApiPropertyOptional({ minimum: 1, maximum: 4, example: 2 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(4)
    priority?: number;

    @ApiPropertyOptional({ type: [LocationDto], description: 'Locations with Google Maps links' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LocationDto)
    locations?: LocationDto[];

    @ApiPropertyOptional({ example: 'abc123', description: 'CTM task ObjectId of parent task' })
    @IsOptional()
    @IsMongoId()
    parentId?: string;

    @ApiProperty({
        example: 'todoist',
        description: 'Connector source to write through to',
        maxLength: 50,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    source!: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/tasks/dto/
git commit -m "feat(main): update task DTOs — add due, deadlineDate, duration, parentId"
```

---

## Task 8: Update TasksController

**Files:**
- Modify: `apps/main/src/tasks/tasks.controller.ts`

- [ ] **Step 1: Update `TaskResponse` type and `toResponse`**

In `apps/main/src/tasks/tasks.controller.ts`, replace the `TaskResponse` type and `toResponse` method:

```ts
type TaskResponse = {
    id: string;
    source: string;
    sourceId: string;
    title: string;
    description: string | null;
    completed: boolean;
    priority: number | null;
    tags: string[];
    locations: { name: string; googleMapsUrl: string }[];
    due: { date: string; timezone: string | null; recurrence: string | null } | null;
    deadlineDate: string | null;
    duration: { amount: number; unit: 'minute' | 'day' } | null;
    parentId: string | null;
    fuzzyDeadline: { type: FuzzyDeadlineType; remindEvery: RemindEvery | null } | null;
    createdAt: string;
    updatedAt: string;
};
```

```ts
private toResponse(t: TaskDocument): TaskResponse {
    return {
        id: String(t._id),
        source: t.source,
        sourceId: t.sourceId,
        title: t.title,
        description: t.description,
        completed: t.status === 'done',
        priority: t.priority,
        tags: t.tags,
        locations: t.locations,
        due: t.due
            ? { date: t.due.date.toISOString(), timezone: t.due.timezone, recurrence: t.due.recurrence }
            : null,
        deadlineDate: t.deadlineDate ? t.deadlineDate.toISOString() : null,
        duration: t.duration ?? null,
        parentId: t.parentId ? String(t.parentId) : null,
        fuzzyDeadline: t.fuzzyDeadline
            ? { type: t.fuzzyDeadline.type, remindEvery: t.fuzzyDeadline.remindEvery }
            : null,
        createdAt: t.createdAt ? t.createdAt.toISOString() : t.syncedAt.toISOString(),
        updatedAt: t.updatedAt ? t.updatedAt.toISOString() : t.syncedAt.toISOString(),
    };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/main/src/tasks/tasks.controller.ts
git commit -m "feat(main): update TasksController response shape for rich task fields"
```

---

## Task 9: Update TasksService

**Files:**
- Modify: `apps/main/src/tasks/tasks.service.ts`

- [ ] **Step 1: Update imports and `create` method**

In `tasks.service.ts`:

1. Add `BadRequestException` to the NestJS imports:
```ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
```

2. Replace the `create` method:

```ts
async create({ userId, dto }: { userId: string; dto: CreateTaskDto }): Promise<TaskDocument> {
    if (dto.parentId) {
        const parent = await this.taskModel.findOne({
            _id: dto.parentId,
            userId: new Types.ObjectId(userId),
        });

        if (!parent) throw new BadRequestException('Parent task not found');
    }

    const due = dto.due ? { date: new Date(dto.due.date), timezone: dto.due.timezone ?? null, recurrence: dto.due.recurrence ?? null } : undefined;
    const deadlineDate = dto.deadlineDate ? new Date(dto.deadlineDate) : undefined;

    if (dto.source === LOCAL_SOURCE) {
        return this.taskModel.create({
            userId: new Types.ObjectId(userId),
            source: LOCAL_SOURCE,
            sourceId: new Types.ObjectId().toHexString(),
            title: dto.title,
            description: dto.description,
            status: 'open',
            priority: (dto.priority ?? 3) as 1 | 2 | 3 | 4,
            tags: [],
            locations: dto.locations ?? [],
            due: due ?? null,
            deadlineDate: deadlineDate ?? null,
            duration: dto.duration ?? null,
            parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
            syncedAt: new Date(),
        });
    }

    const tokens = await this.connectors.getDecryptedTokens({ userId, source: dto.source });
    const connector = this.registry.get(dto.source);
    const remote = await connector.createTask(tokens, {
        title: dto.title,
        description: dto.description,
        due: due ? { date: due.date, timezone: due.timezone ?? undefined, recurrence: due.recurrence ?? undefined } : undefined,
        deadlineDate,
        duration: dto.duration,
        priority: dto.priority,
    });

    return this.taskModel.create({
        userId: new Types.ObjectId(userId),
        source: dto.source,
        sourceId: remote.sourceId,
        title: remote.title,
        description: remote.description,
        status: remote.status,
        priority: remote.priority as 1 | 2 | 3 | 4 | null,
        tags: remote.tags,
        due: remote.due ?? null,
        deadlineDate: remote.deadline ?? null,
        duration: remote.duration ?? null,
        parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
        syncedAt: new Date(),
    });
}
```

- [ ] **Step 2: Replace the `update` method**

```ts
async update({
    taskId,
    userId,
    dto,
}: {
    taskId: string;
    userId: string;
    dto: UpdateTaskDto;
}): Promise<TaskDocument> {
    const task = await this.findOne({ taskId, userId });

    const due = dto.due ? { date: new Date(dto.due.date), timezone: dto.due.timezone ?? null, recurrence: dto.due.recurrence ?? null } : undefined;
    const deadlineDate = dto.deadlineDate ? new Date(dto.deadlineDate) : undefined;

    if (task.source === LOCAL_SOURCE) {
        return this.taskModel.findByIdAndUpdate(
            taskId,
            {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.priority !== undefined && { priority: dto.priority }),
                ...(due !== undefined && { due }),
                ...(deadlineDate !== undefined && { deadlineDate }),
                ...(dto.duration !== undefined && { duration: dto.duration }),
                ...(dto.tags !== undefined && { tags: dto.tags }),
                ...(dto.locations !== undefined && { locations: dto.locations }),
            },
            { new: true },
        ) as Promise<TaskDocument>;
    }

    const tokens = await this.connectors.getDecryptedTokens({ userId, source: task.source });
    const connector = this.registry.get(task.source);
    const remote = await connector.updateTask(tokens, task.sourceId, {
        title: dto.title,
        description: dto.description,
        due: due ? { date: due.date, timezone: due.timezone ?? undefined, recurrence: due.recurrence ?? undefined } : undefined,
        deadlineDate,
        duration: dto.duration,
        priority: dto.priority,
    });

    return this.taskModel.findByIdAndUpdate(
        taskId,
        {
            title: remote.title,
            description: remote.description,
            priority: remote.priority,
            due: remote.due ?? null,
            deadlineDate: remote.deadline ?? null,
            duration: remote.duration ?? null,
            tags: dto.tags ?? task.tags,
            locations: dto.locations ?? task.locations,
            syncedAt: new Date(),
        },
        { new: true },
    ) as Promise<TaskDocument>;
}
```

- [ ] **Step 3: Replace the `upsertFromRemote` method**

```ts
async upsertFromRemote({
    userId,
    source,
    remoteTasks,
}: {
    userId: string;
    source: string;
    remoteTasks: RemoteTask[];
}): Promise<{ synced: number; skipped: number }> {
    if (remoteTasks.length === 0) return { synced: 0, skipped: 0 };

    const userObjectId = new Types.ObjectId(userId);
    const sourceIds = remoteTasks.map((r) => r.sourceId);

    const existingTasks = await this.taskModel.find({
        userId: userObjectId,
        source,
        sourceId: { $in: sourceIds },
    });

    const existingBySourceId = new Map(existingTasks.map((t) => [t.sourceId, t]));
    const now = new Date();
    let synced = 0;
    let skipped = 0;

    // Pre-generate _ids for root inserts so child tasks can reference them in the same batch
    const newIdBySourceId = new Map<string, Types.ObjectId>();

    for (const remote of remoteTasks) {
        if (!existingBySourceId.has(remote.sourceId)) {
            newIdBySourceId.set(remote.sourceId, new Types.ObjectId());
        }
    }

    const ops: Parameters<typeof this.taskModel.bulkWrite>[0] = [];

    // Process in two passes: roots first, then children — only for inserts
    const roots = remoteTasks.filter((r) => r.parentSourceId === null);
    const children = remoteTasks.filter((r) => r.parentSourceId !== null);

    const buildInsert = (remote: RemoteTask, id: Types.ObjectId): object => {
        const parentSourceId = remote.parentSourceId;
        let parentId: Types.ObjectId | null = null;

        if (parentSourceId) {
            const existingParent = existingBySourceId.get(parentSourceId);

            if (existingParent) {
                parentId = existingParent._id as Types.ObjectId;
            } else {
                parentId = newIdBySourceId.get(parentSourceId) ?? null;
            }
        }

        return {
            _id: id,
            userId: userObjectId,
            source,
            sourceId: remote.sourceId,
            title: remote.title,
            description: remote.description ?? null,
            status: remote.status,
            priority: (remote.priority ?? null) as 1 | 2 | 3 | 4 | null,
            tags: remote.tags,
            due: remote.due ?? null,
            deadlineDate: remote.deadline ?? null,
            duration: remote.duration ?? null,
            parentId,
            syncedAt: now,
        };
    };

    const buildUpdate = (remote: RemoteTask): object => ({
        title: remote.title,
        description: remote.description ?? null,
        status: remote.status,
        priority: (remote.priority ?? null) as 1 | 2 | 3 | 4 | null,
        tags: remote.tags,
        due: remote.due ?? null,
        deadlineDate: remote.deadline ?? null,
        duration: remote.duration ?? null,
        syncedAt: now,
    });

    for (const remote of [...roots, ...children]) {
        const existing = existingBySourceId.get(remote.sourceId);

        if (!existing) {
            const id = newIdBySourceId.get(remote.sourceId)!;

            ops.push({ insertOne: { document: buildInsert(remote, id) } });
            synced++;
            continue;
        }

        const hasLocalChanges = existing.updatedAt !== undefined && existing.updatedAt > existing.syncedAt;

        if (hasLocalChanges) {
            skipped++;
            continue;
        }

        ops.push({
            updateOne: {
                filter: { _id: existing._id },
                update: { $set: buildUpdate(remote) },
            },
        });

        synced++;
    }

    if (ops.length > 0) {
        await this.taskModel.bulkWrite(ops, { timestamps: false } as Parameters<typeof this.taskModel.bulkWrite>[1]);
    }

    return { synced, skipped };
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/tasks/tasks.service.ts
git commit -m "feat(main): update TasksService for rich task fields and parent resolution"
```

---

## Task 10: Update Controller Spec (StubConnector)

**Files:**
- Modify: `apps/main/src/tasks/tasks.controller.spec.ts`

- [ ] **Step 1: Update `StubConnector.makeTask`**

In `tasks.controller.spec.ts`, find the `makeTask` method in `StubConnector` and update the returned `RemoteTask`:

```ts
private makeTask(title: string): RemoteTask {
    return {
        sourceId: `remote-task-${++this.counter}`,
        title,
        description: null,
        status: 'open',
        priority: 2,
        due: null,
        deadline: null,
        duration: null,
        parentSourceId: null,
        tags: [],
    };
}
```

- [ ] **Step 2: Run the integration tests**

```bash
pnpm --filter @ctm/main test -- --reporter=verbose tasks.controller
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/tasks/tasks.controller.spec.ts
git commit -m "test(main): update StubConnector for rich task fields"
```

---

## Task 11: Update API Client Types

**Files:**
- Modify: `packages/api-client/src/types.ts`

- [ ] **Step 1: Update the types**

Replace the `TaskDto`, `CreateTaskDto`, and `UpdateTaskDto` types in `packages/api-client/src/types.ts`:

```ts
export type DueDate = {
    date: string;
    timezone: string | null;
    recurrence: string | null;
};

export type Duration = {
    amount: number;
    unit: 'minute' | 'day';
};

export type FuzzyDeadlineInfo = {
    type: 'this_week' | 'this_month' | 'someday';
    remindEvery: 'daily' | 'weekly' | null;
};

export type UserDto = {
    id: string;
    email: string;
    name?: string;
};

export type LocationDto = {
    name: string;
    googleMapsUrl: string;
};

export type TaskDto = {
    id: string;
    title: string;
    description?: string | null;
    priority?: 1 | 2 | 3 | 4 | null;
    due?: DueDate | null;
    deadlineDate?: string | null;
    duration?: Duration | null;
    parentId?: string | null;
    fuzzyDeadline?: FuzzyDeadlineInfo | null;
    completed: boolean;
    source: string;
    sourceId: string;
    tags: string[];
    locations: LocationDto[];
    createdAt: string;
    updatedAt: string;
};

export type CreateTaskDto = {
    title: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due?: { date: string; timezone?: string; recurrence?: string };
    deadlineDate?: string;
    duration?: Duration;
    parentId?: string;
    source: string;
    locations?: LocationDto[];
};

export type UpdateTaskDto = {
    title?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due?: { date: string; timezone?: string; recurrence?: string };
    deadlineDate?: string;
    duration?: Duration;
    tags?: string[];
    locations?: LocationDto[];
};
```

Keep all other types (`SetTaskStatusDto`, `SetFuzzyDeadlineDto`, etc.) unchanged.

- [ ] **Step 2: Build the api-client package**

```bash
pnpm --filter @ctm/api-client build
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api-client/src/types.ts
git commit -m "feat(api-client): update TaskDto and DTOs for rich task fields"
```

---

## Task 12: Update Web TaskCard

**Files:**
- Modify: `apps/web/src/components/tasks/TaskCard.tsx`

- [ ] **Step 1: Update the component**

Replace `apps/web/src/components/tasks/TaskCard.tsx`:

```tsx
import clsx from 'clsx';
import { Badge, Checkbox } from '../ui/index.js';
import type { TaskDto } from '@ctm/api-client';
import { getSourceLabel } from '../../lib/source-labels.js';

interface TaskCardProps {
    task: TaskDto;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
}

const priorityVariant = {
    1: 'p1',
    2: 'p2',
    3: 'p3',
    4: 'p3',
} as const;

function formatDuration(d: { amount: number; unit: 'minute' | 'day' }): string {
    return d.unit === 'minute' ? `${d.amount} min` : `${d.amount}d`;
}

/** A single task row card in neobrutalist style. */
export function TaskCard({ task, onToggle, onEdit }: TaskCardProps): React.JSX.Element {
    const sourceLabel = getSourceLabel(task.source);

    return (
        <div className="bg-white dark:bg-neutral-900 border-2 border-nb-black dark:border-white/20 shadow-[3px_3px_0px_#111] dark:shadow-none flex items-center gap-3 px-3 py-2.5">
            <Checkbox
                checked={task.completed}
                onChange={(checked) => onToggle(task.id, checked)}
                label={`Toggle ${task.title}`}
            />

            <button className="flex-1 text-left min-w-0 cursor-pointer" onClick={() => onEdit(task)}>
                <span
                    className={clsx(
                        'font-bold text-sm text-nb-black dark:text-white block truncate',
                        task.completed && 'line-through text-nb-grey',
                    )}
                >
                    {task.title}
                </span>
                <span className="flex items-center gap-2 flex-wrap">
                    {task.due && (
                        <span className="text-nb-grey text-xs font-bold">
                            {new Date(task.due.date).toLocaleDateString()}
                            {task.due.recurrence && ' ↻'}
                        </span>
                    )}
                    {task.deadlineDate && (
                        <span className="text-red-600 dark:text-red-400 text-xs font-bold">
                            ⚑ {new Date(task.deadlineDate).toLocaleDateString()}
                        </span>
                    )}
                    {task.duration && (
                        <span className="text-nb-grey text-xs font-bold">
                            ⏱ {formatDuration(task.duration)}
                        </span>
                    )}
                </span>
            </button>

            <div className="flex items-center gap-1.5 flex-shrink-0">
                {task.locations?.length > 0 && (
                    <span className="text-xs" title={task.locations.map((l) => l.name).join(', ')}>
                        📍
                    </span>
                )}
                <Badge variant="source">{sourceLabel}</Badge>
                {task.priority && (
                    <Badge variant={priorityVariant[task.priority as 1 | 2 | 3 | 4]}>P{task.priority}</Badge>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/TaskCard.tsx
git commit -m "feat(web): update TaskCard to display due, deadline, duration, recurrence"
```

---

## Task 13: Update Web TaskModal

**Files:**
- Modify: `apps/web/src/components/tasks/TaskModal.tsx`

- [ ] **Step 1: Add state and form fields for new fields**

In `TaskModal.tsx`, make the following changes:

1. Replace `const [dueDate, setDueDate] = useState('');` with:
```tsx
const [dueDate, setDueDate] = useState('');
const [dueRecurrence, setDueRecurrence] = useState('');
const [deadlineDate, setDeadlineDate] = useState('');
const [durationAmount, setDurationAmount] = useState('');
const [durationUnit, setDurationUnit] = useState<'minute' | 'day'>('minute');
```

2. In the `useEffect` that populates state from `task`, add:
```tsx
setDueDate(task.due?.date ? task.due.date.slice(0, 10) : '');
setDueRecurrence(task.due?.recurrence ?? '');
setDeadlineDate(task.deadlineDate ? task.deadlineDate.slice(0, 10) : '');
setDurationAmount(task.duration ? String(task.duration.amount) : '');
setDurationUnit(task.duration?.unit ?? 'minute');
```

Remove the old `setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');` line.

3. In `handleSave`, update the `onSave` call to replace `dueDate:` with:
```tsx
due: dueDate ? { date: dueDate, recurrence: dueRecurrence || undefined } : undefined,
deadlineDate: deadlineDate || undefined,
duration: durationAmount ? { amount: Number(durationAmount), unit: durationUnit } : undefined,
```

4. Replace the existing `Due Date` input in the JSX grid with:
```tsx
<div className="grid grid-cols-2 gap-3">
    <Input
        label="Due Date"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
    />
    <Input
        label="Deadline"
        type="date"
        value={deadlineDate}
        onChange={(e) => setDeadlineDate(e.target.value)}
    />
</div>
<div className="grid grid-cols-2 gap-3">
    <div className="flex flex-col gap-1">
        <label className="font-black uppercase text-xs tracking-wide text-nb-black dark:text-white">
            Recurrence
        </label>
        <select
            value={dueRecurrence}
            onChange={(e) => setDueRecurrence(e.target.value)}
            className="border-2 border-nb-black dark:border-white/20 font-bold text-xs px-2 py-1 bg-white dark:bg-neutral-800 text-nb-black dark:text-white"
            disabled={busy}
        >
            <option value="">None</option>
            <option value="FREQ=DAILY">Daily</option>
            <option value="FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR">Every weekday</option>
            <option value="FREQ=WEEKLY">Weekly</option>
            <option value="FREQ=MONTHLY">Monthly</option>
            <option value="FREQ=YEARLY">Yearly</option>
        </select>
    </div>
    <div className="flex flex-col gap-1">
        <label className="font-black uppercase text-xs tracking-wide text-nb-black dark:text-white">
            Duration
        </label>
        <div className="flex gap-1">
            <input
                type="number"
                min={1}
                value={durationAmount}
                onChange={(e) => setDurationAmount(e.target.value)}
                placeholder="Amount"
                className="border-2 border-nb-black dark:border-white/20 font-bold text-xs px-2 py-1 bg-white dark:bg-neutral-800 text-nb-black dark:text-white w-20"
                disabled={busy}
            />
            <select
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value as 'minute' | 'day')}
                className="border-2 border-nb-black dark:border-white/20 font-bold text-xs px-2 py-1 bg-white dark:bg-neutral-800 text-nb-black dark:text-white"
                disabled={busy}
            >
                <option value="minute">min</option>
                <option value="day">day</option>
            </select>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/TaskModal.tsx
git commit -m "feat(web): update TaskModal with due, recurrence, deadline, duration fields"
```

---

## Task 14: Update Web AddTaskInline

**Files:**
- Modify: `apps/web/src/components/tasks/AddTaskInline.tsx`

- [ ] **Step 1: Replace `dueDate` state and field with `due`**

In `AddTaskInline.tsx`:

1. Replace `const [dueDate, setDueDate] = useState('');` with:
```tsx
const [dueDate, setDueDate] = useState('');
```
(name unchanged, but the submit will now use `due` shape)

2. In `handleSubmit`, replace `dueDate: dueDate || undefined,` with:
```tsx
due: dueDate ? { date: dueDate } : undefined,
```

3. The `Due date (optional)` input label and `type="date"` input remain the same — only the payload key changes.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/AddTaskInline.tsx
git commit -m "feat(web): update AddTaskInline to use due object instead of dueDate"
```

---

## Task 15: Update CLI

**Files:**
- Modify: `apps/cli/src/commands/tasks.ts`

- [ ] **Step 1: Update `taskRow` helper**

Replace the `taskRow` function:

```ts
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
```

- [ ] **Step 2: Update the `list` table headers**

Find the `formatTable` call in the `list` action and update headers:

```ts
print(formatTable(['ID', 'Title', 'Priority', 'Due', 'Deadline', 'Duration', 'Status', 'Tags'], result.map(taskRow)));
```

- [ ] **Step 3: Update `create` command**

Replace the `.option('--due <date>', 'Due date (ISO 8601)')` line with:

```ts
.option('--due <date>', 'Due date (ISO 8601, e.g. 2026-06-01)')
.option('--recurrence <rrule>', 'Recurrence RRULE string (e.g. FREQ=WEEKLY;BYDAY=MO)')
.option('--deadline <date>', 'Hard deadline date (ISO 8601)')
.option('--duration <amount>', 'Duration amount (integer)')
.option('--duration-unit <unit>', 'Duration unit: minute or day')
.option('--parent <id>', 'Parent task CTM ID')
```

Update the action type:
```ts
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
```

Update the `client.createTask` call:
```ts
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
```

- [ ] **Step 4: Update `update` command**

Replace `.option('--due <date>', 'New due date (ISO 8601)')` with:

```ts
.option('--due <date>', 'New due date (ISO 8601)')
.option('--recurrence <rrule>', 'Recurrence RRULE string')
.option('--deadline <date>', 'Hard deadline date (ISO 8601)')
.option('--duration <amount>', 'Duration amount')
.option('--duration-unit <unit>', 'Duration unit: minute or day')
```

Update the action type to add the same optional fields, and update the `client.updateTask` call:
```ts
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
```

- [ ] **Step 5: Build CLI to verify types**

```bash
pnpm --filter @ctm/cli build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/commands/tasks.ts
git commit -m "feat(cli): add due, recurrence, deadline, duration, parent flags to task commands"
```

---

## Task 16: Update MCP

**Files:**
- Modify: `apps/mcp/src/mcp/tools/tasks.tool.ts`

- [ ] **Step 1: Update `create_task` and `update_task` tools**

Replace `apps/mcp/src/mcp/tools/tasks.tool.ts`:

```ts
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
            description: 'List tasks. Optionally filter by status.',
            inputSchema: { filter: z.enum(['all', 'today', 'upcoming', 'done']).default('all') },
            annotations: { readOnlyHint: true },
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
                due: dueSchema.optional(),
                deadlineDate: z.string().optional(),
                duration: durationSchema.optional(),
                parentId: z.string().optional(),
                source: z.string().min(1),
            },
            annotations: { destructiveHint: false, idempotentHint: false },
        },
        async ({ title, description, priority, due, deadlineDate, duration, parentId, source }) => {
            const task = await client.createTask({
                dto: { title, description, priority, due, deadlineDate, duration, parentId, source },
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
```

- [ ] **Step 2: Build MCP app**

```bash
pnpm --filter @ctm/mcp build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mcp/src/mcp/tools/tasks.tool.ts
git commit -m "feat(mcp): add due, deadlineDate, duration, parentId to task tools"
```

---

## Task 17: Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: all tests PASS. Fix any remaining TypeScript errors or failing tests.

- [ ] **Step 2: Build all packages**

```bash
pnpm build
```

Expected: PASS with no errors.
