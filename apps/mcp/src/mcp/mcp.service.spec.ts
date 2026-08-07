import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { McpService } from './mcp.service.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const error = vi.fn();

vi.mock('../logging/app-logger.js', () => ({
    appLogger: (): { error: typeof error } => ({ error }),
}));

describe('McpService', () => {
    let service: McpService;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                McpService,
                {
                    provide: ConfigService,
                    useValue: { getOrThrow: vi.fn().mockReturnValue('http://localhost:3000') },
                },
            ],
        }).compile();

        service = module.get(McpService);
    });

    it('creates an McpServer with task and connector tools', () => {
        const server = service.createServer('test-token');
        expect(server).toBeInstanceOf(McpServer);
    });

    it('logs the cause of a failing tool call and still surfaces it to the client', async () => {
        const server = service.createServer('test-token');
        const failure = new Error('upstream exploded');

        server.registerTool('boom', { description: 'fails', inputSchema: { id: z.string() } }, () => {
            throw failure;
        });

        const result = await callTool({ server, name: 'boom' });

        expect(result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'upstream exploded' }] });
        expect(error).toHaveBeenCalledWith(expect.objectContaining({ err: failure, tool: 'boom' }), expect.any(String));
    });
});

async function callTool({ server, name }: { server: McpServer; name: string }): Promise<unknown> {
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    return client.callTool({ name, arguments: { id: 'x' } });
}
