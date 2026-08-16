import { getConnectionToken } from '@nestjs/mongoose';
import { STATES, type Connection } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../bootstrap.js';
import { resetEnvCache } from '../config/load-env.js';

const IDLE_TIMEOUT_MS = 200;

// The behaviour the whole design exists for, asserted against the real application rather than the
// service in isolation: bootstrap must not dial MongoDB, and an idle process must not hold a socket.
describe('lazy database connection', () => {
    let app: NestFastifyApplication;
    let connection: Connection;

    beforeAll(async () => {
        process.env['ADMIN_DEV_BYPASS_EMAIL'] = 'operator@example.com';
        process.env['MONGODB_IDLE_TIMEOUT_MS'] = String(IDLE_TIMEOUT_MS);
        resetEnvCache();

        app = await createApp();

        await app.init();

        connection = app.get<Connection>(getConnectionToken());
    });

    afterAll(async () => {
        await app?.close();

        delete process.env['ADMIN_DEV_BYPASS_EMAIL'];
        delete process.env['MONGODB_IDLE_TIMEOUT_MS'];
        resetEnvCache();
    });

    it('finishes bootstrap without connecting', () => {
        expect(connection.readyState).toBe(STATES.disconnected);
    });

    it('serves a request that reads the database', async () => {
        const response = await app.inject({ method: 'GET', url: '/metrics' });

        expect(response.statusCode).toBe(200);
        expect(connection.readyState).toBe(STATES.connected);
    });

    it('closes the connection again once the process is idle', async () => {
        await app.inject({ method: 'GET', url: '/metrics' });

        await waitFor(() => connection.readyState === STATES.disconnected);
    });

    it('reconnects for the next request after an idle close', async () => {
        const response = await app.inject({ method: 'GET', url: '/metrics' });

        expect(response.statusCode).toBe(200);
    });
});

async function waitFor(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + 5000;

    while (!condition()) {
        if (Date.now() > deadline) throw new Error('Condition never became true');

        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}
