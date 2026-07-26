import { describe, it, expect } from 'vitest';
import { ConfigService } from '@nestjs/config';
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
