import { Controller, Get, UseGuards, type CanActivate } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { UnauthorizedError } from '@ctm/errors';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { DatabaseConnectionInterceptor } from './database-connection.interceptor.js';
import { IdleConnectionService } from './idle-connection.service.js';

const acquire = vi.fn<() => Promise<void>>(() => Promise.resolve());
const release = vi.fn<() => void>();

class RejectingGuard implements CanActivate {
    canActivate(): boolean {
        throw new UnauthorizedError('no token');
    }
}

@Controller()
class ProbeController {
    @Get('ok')
    ok(): { ok: boolean } {
        return { ok: true };
    }

    @Get('boom')
    boom(): never {
        throw new UnauthorizedError('handler failed');
    }

    @Get('guarded')
    @UseGuards(RejectingGuard)
    guarded(): { ok: boolean } {
        return { ok: true };
    }
}

describe('DatabaseConnectionInterceptor', () => {
    let app: NestFastifyApplication;

    afterAll(async () => {
        await app?.close();
    });

    it('acquires the connection for the duration of a request and releases it after', async () => {
        const server = await start();

        await server.inject({ method: 'GET', url: '/ok' });

        expect(acquire).toHaveBeenCalledTimes(1);
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('releases the connection when the handler throws', async () => {
        const server = await start();

        await server.inject({ method: 'GET', url: '/boom' });

        expect(release).toHaveBeenCalledTimes(1);
    });

    // The whole point of opening the connection in an interceptor rather than a middleware:
    // an unauthenticated request must not be able to wake a sleeping database.
    it('never touches the connection when a guard rejects the request', async () => {
        const server = await start();

        await server.inject({ method: 'GET', url: '/guarded' });

        expect(acquire).not.toHaveBeenCalled();
    });

    async function start(): Promise<NestFastifyApplication> {
        acquire.mockClear();
        release.mockClear();

        if (app) return app;

        const moduleRef = await Test.createTestingModule({
            controllers: [ProbeController],
            providers: [
                { provide: IdleConnectionService, useValue: { acquire, release } },
                { provide: APP_INTERCEPTOR, useClass: DatabaseConnectionInterceptor },
            ],
        }).compile();

        app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        return app;
    }
});
