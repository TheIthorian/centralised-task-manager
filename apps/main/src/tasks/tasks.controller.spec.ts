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
        await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'password123' } });
        const loginRes = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'password123' } });

        jwt = JSON.parse(loginRes.body).accessToken;

        // Insert a stub ConnectorConfig so getDecryptedTokens succeeds
        const ConnectorConfigModel = moduleRef.get(getModelToken('ConnectorConfig'));
        const meRes = await app.inject({ method: 'GET', url: '/users/me', headers: { authorization: `Bearer ${jwt}` } });
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
        expect(JSON.parse(res.body).status).toBe('done');
    });
});
