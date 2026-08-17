import Fastify, { type FastifyInstance } from 'fastify';
import pino from 'pino';
import { describe, it, expect, afterEach } from 'vitest';
import { MAX_LOGGED_PAYLOAD_BYTES, registerPayloadLogging } from './payload-logging.js';
import { REDACT_PATHS, REDACTION_PLACEHOLDER } from '@ctm/logger';

type LogLine = Record<string, unknown>;

let app: FastifyInstance | undefined;

afterEach(async () => {
    await app?.close();
    app = undefined;
});

describe('registerPayloadLogging', () => {
    it('logs the request and response payloads at debug', async () => {
        const { lines, instance } = await buildApp({ level: 'debug' });

        const response = await instance.inject({
            method: 'POST',
            url: '/echo',
            payload: { name: 'Ada' },
        });

        expect(response.statusCode).toBe(200);

        const request = lines.find((line) => line.msg === 'inbound request');
        const sent = lines.find((line) => line.msg === 'outbound response');

        expect(request?.body).toEqual({ name: 'Ada' });
        expect(request?.url).toBe('/echo');
        expect(sent?.status).toBe(200);
        expect(sent?.responseBody).toBe(JSON.stringify({ echoed: 'Ada' }));
    });

    it('redacts secrets in headers and bodies', async () => {
        const { lines, instance } = await buildApp({ level: 'debug' });

        await instance.inject({
            method: 'POST',
            url: '/echo',
            headers: { authorization: 'Bearer real-token' },
            payload: { name: 'Ada', password: 'hunter2' },
        });

        const request = lines.find((line) => line.msg === 'inbound request');

        expect((request?.headers as Record<string, string>).authorization).toBe(REDACTION_PLACEHOLDER);
        expect((request?.body as Record<string, string>).password).toBe(REDACTION_PLACEHOLDER);
        expect((request?.body as Record<string, string>).name).toBe('Ada');
    });

    it('describes a payload that is too large instead of printing it', async () => {
        const { lines, instance } = await buildApp({ level: 'debug' });

        await instance.inject({
            method: 'POST',
            url: '/echo',
            payload: { name: 'a'.repeat(MAX_LOGGED_PAYLOAD_BYTES) },
        });

        const request = lines.find((line) => line.msg === 'inbound request');

        expect(request?.body).toMatch(/^application\/json of length \d+$/);
    });

    it('describes a binary response instead of printing it', async () => {
        const { lines, instance } = await buildApp({ level: 'debug' });

        await instance.inject({ method: 'GET', url: '/logo' });

        const sent = lines.find((line) => line.msg === 'outbound response');

        expect(sent?.responseBody).toBe('image/png of length 4');
    });

    it('logs nothing when the logger is above debug', async () => {
        const { lines, instance } = await buildApp({ level: 'info' });

        await instance.inject({ method: 'POST', url: '/echo', payload: { name: 'Ada' } });

        expect(lines).toEqual([]);
    });
});

async function buildApp({ level }: { level: string }): Promise<{ lines: LogLine[]; instance: FastifyInstance }> {
    const lines: LogLine[] = [];
    const stream = {
        write: (line: string): void => {
            lines.push(JSON.parse(line) as LogLine);
        },
    };

    const logger = pino({ level, redact: { paths: REDACT_PATHS, censor: REDACTION_PLACEHOLDER } }, stream);
    const instance = Fastify();

    instance.post('/echo', (request) => ({ echoed: (request.body as { name: string }).name }));
    instance.get('/logo', (_request, reply) => reply.type('image/png').send(Buffer.from([1, 2, 3, 4])));

    registerPayloadLogging({ app: instance, logger });

    await instance.ready();
    app = instance;

    return { lines, instance };
}
