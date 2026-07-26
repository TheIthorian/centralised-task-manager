import { describe, it, expect } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AppConfigController } from './app-config.controller.js';

function makeController(mcpPublicUrl: string): AppConfigController {
    const config = { getOrThrow: () => mcpPublicUrl } as unknown as ConfigService;

    return new AppConfigController(config);
}

describe('AppConfigController', () => {
    it('returns the configured MCP url', () => {
        expect(makeController('https://mcp.example.com').get()).toEqual({ mcpUrl: 'https://mcp.example.com' });
    });

    it('strips a trailing slash so clients can append paths', () => {
        expect(makeController('https://mcp.example.com/').get()).toEqual({ mcpUrl: 'https://mcp.example.com' });
    });
});
