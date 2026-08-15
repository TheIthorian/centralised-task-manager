import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module.js';
import { AppConfigController } from './app-config.controller.js';

function makeController(mcpPublicUrl: string): AppConfigController {
    const config = { getOrThrow: () => mcpPublicUrl } as unknown as ConfigService;

    return new AppConfigController(config);
}

describe('AppConfigController', () => {
    it('returns the Streamable HTTP endpoint, not the bare base url', () => {
        expect(makeController('https://mcp.example.com').get()).toEqual({ mcpUrl: 'https://mcp.example.com/mcp' });
    });

    it('tolerates a trailing slash on MCP_PUBLIC_URL', () => {
        expect(makeController('https://mcp.example.com/').get()).toEqual({ mcpUrl: 'https://mcp.example.com/mcp' });
    });
});

describe('GET /config', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = module.createNestApplication(new FastifyAdapter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('is cacheable', async () => {
        const res = await app.inject({ method: 'GET', url: '/config' });

        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toBe('public, max-age=300, stale-while-revalidate=3600');
    });
});
