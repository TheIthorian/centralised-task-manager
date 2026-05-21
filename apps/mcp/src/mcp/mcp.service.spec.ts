import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { McpService } from './mcp.service.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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
});
