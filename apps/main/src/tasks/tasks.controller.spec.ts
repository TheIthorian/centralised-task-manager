import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import { ConnectorRegistry } from '@ctm/connectors';
import type { TaskConnector, OAuthTokens, RemoteTask, CreateTaskDto, UpdateTaskDto } from '@ctm/connectors';
import { AppModule } from '../app.module.js';
import { EncryptionService } from '../connectors/encryption.service.js';

// Stub connector that returns predictable RemoteTask values with unique sourceIds
class StubConnector implements TaskConnector {
    readonly source = 'stub';
    private counter = 0;

    private makeTask(title: string): RemoteTask {
        return {
            sourceId: `remote-task-${++this.counter}`,
            title,
            description: null,
            status: 'open',
            priority: 2,
            dueDate: null,
            tags: [],
        };
    }

    getAuthUrl(_userId: string): string {
        return 'https://stub.example.com/auth';
    }

    async exchangeCode(_code: string): Promise<OAuthTokens> {
        return { accessToken: 'tok', refreshToken: '', expiresAt: new Date() };
    }

    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        return tokens;
    }

    async fetchTasks(_tokens: OAuthTokens): Promise<RemoteTask[]> {
        return [this.makeTask('Stub task')];
    }

    async createTask(_tokens: OAuthTokens, dto: CreateTaskDto): Promise<RemoteTask> {
        return this.makeTask(dto.title);
    }

    async updateTask(_tokens: OAuthTokens, _sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask> {
        return this.makeTask(patch.title ?? 'Updated task');
    }

    async completeTask(_tokens: OAuthTokens, _sourceId: string): Promise<void> {}

    async deleteTask(_tokens: OAuthTokens, _sourceId: string): Promise<void> {}
}

describe('TasksModule', () => {
    let app: NestFastifyApplication;
    let jwt: string;
    const email = `tasks+${Date.now()}@example.com`;

    beforeAll(async () => {
        const stubConnector = new StubConnector();
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(ConnectorRegistry)
            .useFactory({
                factory: () => {
                    const registry = new ConnectorRegistry();
                    registry.register(stubConnector);
                    return registry;
                },
            })
            .compile();

        app = moduleRef.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        // Register + login
        await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Tasks Tester', email, password: 'password123' },
        });
        const loginRes = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { email, password: 'password123' },
        });

        jwt = JSON.parse(loginRes.body).accessToken;

        // Insert a stub ConnectorConfig so getDecryptedTokens succeeds
        const ConnectorConfigModel = moduleRef.get(getModelToken('ConnectorConfig'));
        const meRes = await app.inject({
            method: 'GET',
            url: '/users/me',
            headers: { authorization: `Bearer ${jwt}` },
        });
        const userId = JSON.parse(meRes.body).id;
        const encryptionService = moduleRef.get(EncryptionService);

        await ConnectorConfigModel.create({
            userId: new Types.ObjectId(userId),
            source: 'stub',
            accessToken: encryptionService.encrypt('stub-access-token'),
            refreshToken: encryptionService.encrypt(''),
            tokenExpiresAt: new Date(Date.now() + 3600000),
            enabled: true,
        });
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /tasks returns tasks list', async () => {
        const res = await app.inject({ method: 'GET', url: '/tasks', headers: { authorization: `Bearer ${jwt}` } });

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(JSON.parse(res.body))).toBe(true);
    });

    it('POST /tasks creates a task (write-through)', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { title: `Test task ${Date.now()}`, source: 'stub' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);

        expect(body).toHaveProperty('id');
        expect(body.source).toBe('stub');
    });

    it('PATCH /tasks/:id/fuzzy-deadline sets fuzzy deadline', async () => {
        // Create a task first
        const createRes = await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { title: `Fuzzy task ${Date.now()}`, source: 'stub' },
            headers: { authorization: `Bearer ${jwt}` },
        });
        const taskId = JSON.parse(createRes.body).id;

        const res = await app.inject({
            method: 'PATCH',
            url: `/tasks/${taskId}/fuzzy-deadline`,
            payload: { type: 'this_week', remindEvery: 'daily' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).fuzzyDeadline).toMatchObject({ type: 'this_week', remindEvery: 'daily' });
    });

    it('DELETE /tasks/:id/fuzzy-deadline clears fuzzy deadline', async () => {
        // Create + set fuzzy deadline
        const createRes = await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { title: `Fuzzy clear ${Date.now()}`, source: 'stub' },
            headers: { authorization: `Bearer ${jwt}` },
        });
        const taskId = JSON.parse(createRes.body).id;

        await app.inject({
            method: 'PATCH',
            url: `/tasks/${taskId}/fuzzy-deadline`,
            payload: { type: 'someday' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        const res = await app.inject({
            method: 'DELETE',
            url: `/tasks/${taskId}/fuzzy-deadline`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).fuzzyDeadline).toBeNull();
    });

    it('POST /tasks/:id/complete marks task done', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { title: `Complete task ${Date.now()}`, source: 'stub' },
            headers: { authorization: `Bearer ${jwt}` },
        });
        const taskId = JSON.parse(createRes.body).id;

        const res = await app.inject({
            method: 'POST',
            url: `/tasks/${taskId}/complete`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(201);
        expect(JSON.parse(res.body).completed).toBe(true);
    });
});

// ─── Local source: auth guards, CRUD, validation, filtering ──────────────────

describe('Tasks — local source: CRUD, auth, validation, filtering', () => {
    let app: NestFastifyApplication;
    let jwt: string;

    /** Create a local task and return its id. */
    async function createLocal(title: string, extra: Record<string, unknown> = {}): Promise<string> {
        const res = await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { title, source: 'local', ...extra },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(201);

        return JSON.parse(res.body).id;
    }

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        const email = `local-tasks+${Date.now()}@example.com`;
        const regRes = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Local Task Tester', email, password: 'password123' },
        });

        jwt = JSON.parse(regRes.body).accessToken;
    });

    afterAll(async () => {
        await app.close();
    });

    // ── Auth guards ────────────────────────────────────────────────────────────

    it('GET /tasks without auth returns 401', async () => {
        const res = await app.inject({ method: 'GET', url: '/tasks' });

        expect(res.statusCode).toBe(401);
    });

    it('POST /tasks without auth returns 401', async () => {
        const res = await app.inject({ method: 'POST', url: '/tasks', payload: { title: 'x', source: 'local' } });

        expect(res.statusCode).toBe(401);
    });

    it('GET /tasks/:id without auth returns 401', async () => {
        const res = await app.inject({ method: 'GET', url: '/tasks/000000000000000000000000' });

        expect(res.statusCode).toBe(401);
    });

    it('PATCH /tasks/:id without auth returns 401', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/tasks/000000000000000000000000',
            payload: { title: 'x' },
        });

        expect(res.statusCode).toBe(401);
    });

    it('DELETE /tasks/:id without auth returns 401', async () => {
        const res = await app.inject({ method: 'DELETE', url: '/tasks/000000000000000000000000' });

        expect(res.statusCode).toBe(401);
    });

    it('POST /tasks/:id/complete without auth returns 401', async () => {
        const res = await app.inject({ method: 'POST', url: '/tasks/000000000000000000000000/complete' });

        expect(res.statusCode).toBe(401);
    });

    // ── Create + GET list ─────────────────────────────────────────────────────

    it('POST /tasks with local source returns 201 with id, source, title, status', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { title: 'Buy milk', source: 'local' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);

        expect(body).toHaveProperty('id');
        expect(body.source).toBe('local');
        expect(body.title).toBe('Buy milk');
        expect(body.completed).toBe(false);
    });

    it('POST /tasks accepts optional priority and description', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { title: 'Detailed task', source: 'local', priority: 1, description: 'With details' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(201);
        expect(JSON.parse(res.body).title).toBe('Detailed task');
    });

    it('GET /tasks returns an array that includes the created task', async () => {
        const title = `List check ${Date.now()}`;
        const id = await createLocal(title);

        const res = await app.inject({
            method: 'GET',
            url: '/tasks',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        const tasks = JSON.parse(res.body) as { id: string }[];

        expect(tasks.some((t) => t.id === id)).toBe(true);
    });

    // ── GET by id + persistence ────────────────────────────────────────────────

    it('GET /tasks/:id returns the persisted task', async () => {
        const title = `Persist ${Date.now()}`;
        const id = await createLocal(title, { priority: 2, description: 'Persisted desc' });

        const res = await app.inject({
            method: 'GET',
            url: `/tasks/${id}`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);

        expect(body.id).toBe(id);
        expect(body.title).toBe(title);
        expect(body.source).toBe('local');
        expect(body.completed).toBe(false);
        expect(body.priority).toBe(2);
        expect(body.description).toBe('Persisted desc');
    });

    it('GET /tasks/:id returns 404 for a non-existent id', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/tasks/000000000000000000000000',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(404);
    });

    // ── Update + persistence ───────────────────────────────────────────────────

    it('PATCH /tasks/:id updates title and priority — change is persisted', async () => {
        const id = await createLocal(`Update me ${Date.now()}`);

        const patchRes = await app.inject({
            method: 'PATCH',
            url: `/tasks/${id}`,
            payload: { title: 'Updated title', priority: 1 },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(patchRes.statusCode).toBe(200);

        // Verify via GET
        const getRes = await app.inject({
            method: 'GET',
            url: `/tasks/${id}`,
            headers: { authorization: `Bearer ${jwt}` },
        });
        const body = JSON.parse(getRes.body);

        expect(body.title).toBe('Updated title');
        expect(body.priority).toBe(1);
    });

    it('PATCH /tasks/:id updates tags — change is persisted', async () => {
        const id = await createLocal(`Tag me ${Date.now()}`);

        await app.inject({
            method: 'PATCH',
            url: `/tasks/${id}`,
            payload: { tags: ['work', 'urgent'] },
            headers: { authorization: `Bearer ${jwt}` },
        });

        const getRes = await app.inject({
            method: 'GET',
            url: `/tasks/${id}`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(JSON.parse(getRes.body).tags).toEqual(['work', 'urgent']);
    });

    it('PATCH /tasks/:id returns 404 for unknown id', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/tasks/000000000000000000000000',
            payload: { title: 'Ghost' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(404);
    });

    // ── Complete + persistence ────────────────────────────────────────────────

    it('POST /tasks/:id/complete sets status to done — persisted', async () => {
        const id = await createLocal(`Complete me ${Date.now()}`);

        const completeRes = await app.inject({
            method: 'POST',
            url: `/tasks/${id}/complete`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(completeRes.statusCode).toBe(201);
        expect(JSON.parse(completeRes.body).completed).toBe(true);

        // Verify persistence
        const getRes = await app.inject({
            method: 'GET',
            url: `/tasks/${id}`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(JSON.parse(getRes.body).completed).toBe(true);
    });

    // ── Delete + persistence ──────────────────────────────────────────────────

    it('DELETE /tasks/:id removes the task — subsequent GET returns 404', async () => {
        const id = await createLocal(`Delete me ${Date.now()}`);

        const deleteRes = await app.inject({
            method: 'DELETE',
            url: `/tasks/${id}`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(deleteRes.statusCode).toBe(204);

        const getRes = await app.inject({
            method: 'GET',
            url: `/tasks/${id}`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(getRes.statusCode).toBe(404);
    });

    it('DELETE /tasks/:id returns 404 for unknown id', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: '/tasks/000000000000000000000000',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(404);
    });

    // ── Fuzzy deadline ─────────────────────────────────────────────────────────

    it('PATCH /tasks/:id/fuzzy-deadline persists type and remindEvery', async () => {
        const id = await createLocal(`Fuzzy ${Date.now()}`);

        const res = await app.inject({
            method: 'PATCH',
            url: `/tasks/${id}/fuzzy-deadline`,
            payload: { type: 'this_month', remindEvery: 'weekly' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).fuzzyDeadline).toMatchObject({ type: 'this_month', remindEvery: 'weekly' });

        // Verify in DB
        const getRes = await app.inject({
            method: 'GET',
            url: `/tasks/${id}`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(JSON.parse(getRes.body).fuzzyDeadline).toMatchObject({ type: 'this_month', remindEvery: 'weekly' });
    });

    it('DELETE /tasks/:id/fuzzy-deadline clears it — persisted as null', async () => {
        const id = await createLocal(`FuzzyClear ${Date.now()}`);
        await app.inject({
            method: 'PATCH',
            url: `/tasks/${id}/fuzzy-deadline`,
            payload: { type: 'someday' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        const res = await app.inject({
            method: 'DELETE',
            url: `/tasks/${id}/fuzzy-deadline`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).fuzzyDeadline).toBeNull();
    });

    // ── Validation ────────────────────────────────────────────────────────────

    it('POST /tasks missing title returns 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { source: 'local' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
    });

    it('POST /tasks missing source returns 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { title: 'No source' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
    });

    it('POST /tasks with priority out of range returns 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { title: 'Bad prio', source: 'local', priority: 5 },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
    });

    it('POST /tasks with title longer than max length returns 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { title: 'x'.repeat(201), source: 'local' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
    });

    it('PATCH /tasks/:id with priority out of range returns 400', async () => {
        const id = await createLocal(`Prio validate ${Date.now()}`);
        const res = await app.inject({
            method: 'PATCH',
            url: `/tasks/${id}`,
            payload: { priority: 0 },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
    });

    it('PATCH /tasks/:id/fuzzy-deadline with invalid type returns 400', async () => {
        const id = await createLocal(`Bad fuzzy ${Date.now()}`);
        const res = await app.inject({
            method: 'PATCH',
            url: `/tasks/${id}/fuzzy-deadline`,
            payload: { type: 'next_year' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
    });

    it('GET /tasks with invalid status query returns 400', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/tasks?status=invalid',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
    });

    // ── Query filtering ────────────────────────────────────────────────────────

    it('GET /tasks?status=open returns only open tasks', async () => {
        const openId = await createLocal(`Open ${Date.now()}`);
        const doneId = await createLocal(`Done ${Date.now()}`);

        // Complete the second task
        await app.inject({
            method: 'POST',
            url: `/tasks/${doneId}/complete`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        const res = await app.inject({
            method: 'GET',
            url: '/tasks?status=open',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        const tasks = JSON.parse(res.body) as { id: string; completed: boolean }[];

        expect(tasks.every((t) => t.completed === false)).toBe(true);
        expect(tasks.some((t) => t.id === openId)).toBe(true);
        expect(tasks.some((t) => t.id === doneId)).toBe(false);
    });

    it('GET /tasks?status=done returns only done tasks', async () => {
        const id = await createLocal(`ToComplete ${Date.now()}`);
        await app.inject({ method: 'POST', url: `/tasks/${id}/complete`, headers: { authorization: `Bearer ${jwt}` } });

        const res = await app.inject({
            method: 'GET',
            url: '/tasks?status=done',
            headers: { authorization: `Bearer ${jwt}` },
        });

        const tasks = JSON.parse(res.body) as { id: string; completed: boolean }[];

        expect(tasks.every((t) => t.completed === true)).toBe(true);
        expect(tasks.some((t) => t.id === id)).toBe(true);
    });
});

// ─── User isolation ───────────────────────────────────────────────────────────

describe('Tasks — user isolation', () => {
    let app: NestFastifyApplication;
    let jwtA: string;
    let jwtB: string;
    let taskIdA: string;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        const suffix = Date.now();

        const regA = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'User A', email: `taskA+${suffix}@example.com`, password: 'password123' },
        });

        jwtA = JSON.parse(regA.body).accessToken;

        const regB = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'User B', email: `taskB+${suffix}@example.com`, password: 'password123' },
        });

        jwtB = JSON.parse(regB.body).accessToken;

        // User A creates a task
        const createRes = await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { title: `User A task ${suffix}`, source: 'local' },
            headers: { authorization: `Bearer ${jwtA}` },
        });

        taskIdA = JSON.parse(createRes.body).id;
    });

    afterAll(async () => {
        await app.close();
    });

    it("User B's task list does not contain User A's task", async () => {
        const res = await app.inject({ method: 'GET', url: '/tasks', headers: { authorization: `Bearer ${jwtB}` } });
        const tasks = JSON.parse(res.body) as { id: string }[];

        expect(tasks.some((t) => t.id === taskIdA)).toBe(false);
    });

    it("User B cannot GET User A's task by id — returns 404", async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/tasks/${taskIdA}`,
            headers: { authorization: `Bearer ${jwtB}` },
        });

        expect(res.statusCode).toBe(404);
    });

    it("User B cannot PATCH User A's task — returns 404", async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: `/tasks/${taskIdA}`,
            payload: { title: 'Stolen' },
            headers: { authorization: `Bearer ${jwtB}` },
        });

        expect(res.statusCode).toBe(404);
    });

    it("User B cannot complete User A's task — returns 404", async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/tasks/${taskIdA}/complete`,
            headers: { authorization: `Bearer ${jwtB}` },
        });

        expect(res.statusCode).toBe(404);
    });

    it("User B cannot DELETE User A's task — returns 404", async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/tasks/${taskIdA}`,
            headers: { authorization: `Bearer ${jwtB}` },
        });

        expect(res.statusCode).toBe(404);
    });

    it("User B cannot set fuzzy deadline on User A's task — returns 404", async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: `/tasks/${taskIdA}/fuzzy-deadline`,
            payload: { type: 'someday' },
            headers: { authorization: `Bearer ${jwtB}` },
        });

        expect(res.statusCode).toBe(404);
    });
});
