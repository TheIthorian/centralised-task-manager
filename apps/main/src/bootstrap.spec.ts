import { describe, it, expect } from 'vitest';
import { buildCorsOptions, createApp } from './bootstrap.js';

describe('buildCorsOptions', () => {
    it('allows PATCH requests in CORS preflight responses', () => {
        const corsOptions = buildCorsOptions({});

        expect(corsOptions.methods).toContain('PATCH');
    });

    it('enables credentials for explicit origins', () => {
        const corsOptions = buildCorsOptions({ CORS_ORIGIN: 'http://localhost:5173' });

        expect(corsOptions.origin).toEqual(['http://localhost:5173']);
        expect(corsOptions.credentials).toBe(true);
    });

    it('uses wildcard origin without credentials when CORS_ORIGIN is unset', () => {
        const corsOptions = buildCorsOptions({});

        expect(corsOptions.origin).toBe(true);
        expect(corsOptions.credentials).toBe(false);
    });
});

describe('createApp plugin registration', () => {
    it('registers compression and cookie plugins', async () => {
        const app = await createApp();
        const instance = app.getHttpAdapter().getInstance();

        // @fastify/compress decorates the reply, not the instance.
        expect(instance.hasReplyDecorator('compress')).toBe(true);
        expect(typeof instance.parseCookie).toBe('function');

        await app.close();
    });

    it('leaves responses under the 1KB threshold uncompressed', async () => {
        const app = await createApp();

        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        const response = await app
            .getHttpAdapter()
            .getInstance()
            .inject({
                method: 'GET',
                url: '/health',
                headers: { 'accept-encoding': 'gzip, br' },
            });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-encoding']).toBeUndefined();

        await app.close();
    });

    it('compresses a payload over the threshold', async () => {
        const app = await createApp();
        const instance = app.getHttpAdapter().getInstance();

        instance.get('/__compress_probe', async (_request, reply) => reply.send({ blob: 'a'.repeat(4096) }));

        await app.init();
        await instance.ready();

        const response = await instance.inject({
            method: 'GET',
            url: '/__compress_probe',
            headers: { 'accept-encoding': 'gzip' },
        });

        expect(response.headers['content-encoding']).toBe('gzip');

        await app.close();
    });
});
