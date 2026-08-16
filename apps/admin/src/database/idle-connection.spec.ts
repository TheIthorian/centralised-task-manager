import type { ConfigService } from '@nestjs/config';
import mongoose, { STATES, type Connection } from 'mongoose';
import { afterEach, describe, expect, it } from 'vitest';
import { IdleConnectionService } from './idle-connection.service.js';

const IDLE_TIMEOUT_MS = 50;

describe('IdleConnectionService', () => {
    const connections: Connection[] = [];

    afterEach(async () => {
        await Promise.all(connections.splice(0).map((connection) => connection.close()));
    });

    it('leaves the connection closed until something acquires it', () => {
        const { connection } = build();

        expect(connection.readyState).toBe(STATES.disconnected);
    });

    it('opens the connection on acquire', async () => {
        const { service, connection } = build();

        await service.acquire();

        expect(connection.readyState).toBe(STATES.connected);
    });

    it('closes the connection once it has been idle for the timeout', async () => {
        const { service, connection } = build();

        await service.acquire();
        service.release();

        await waitForState({ connection, state: STATES.disconnected });
    });

    it('holds the connection open while a request is still in flight', async () => {
        const { service, connection } = build();

        await service.acquire();
        await service.acquire();
        service.release();

        await sleep(IDLE_TIMEOUT_MS * 3);

        expect(connection.readyState).toBe(STATES.connected);
    });

    it('serves queries again after an idle close', async () => {
        const { service, connection } = build();
        const model = connection.model('IdleProbe', new mongoose.Schema({ run: Number }));

        await service.acquire();
        service.release();
        await waitForState({ connection, state: STATES.disconnected });

        await service.acquire();

        await expect(model.countDocuments()).resolves.toBeTypeOf('number');
    });

    it('opens once for concurrent acquires', async () => {
        const { service, connection } = build();

        await Promise.all([service.acquire(), service.acquire(), service.acquire()]);

        expect(connection.readyState).toBe(STATES.connected);
    });

    it('closes the connection on shutdown', async () => {
        const { service, connection } = build();

        await service.acquire();
        await service.onApplicationShutdown();

        expect(connection.readyState).toBe(STATES.disconnected);
    });

    function build(): { service: IdleConnectionService; connection: Connection } {
        const connection = mongoose.createConnection();

        connections.push(connection);

        const config = {
            getOrThrow: (key: string): string | number =>
                key === 'MONGODB_URI'
                    ? (process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test')
                    : IDLE_TIMEOUT_MS,
        } as unknown as ConfigService;

        return { service: new IdleConnectionService(connection, config), connection };
    }
});

async function waitForState({ connection, state }: { connection: Connection; state: STATES }): Promise<void> {
    const deadline = Date.now() + 5000;

    while (connection.readyState !== state) {
        if (Date.now() > deadline) throw new Error(`Connection never reached state ${state}`);

        await sleep(10);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
