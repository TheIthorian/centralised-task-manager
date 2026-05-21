import { describe, expect, it } from 'vitest';
import { mcpCorsOptions } from './bootstrap.js';

describe('mcpCorsOptions', () => {
    it('allows any origin', () => {
        expect(mcpCorsOptions.origin).toBe(true);
        expect(mcpCorsOptions.credentials).toBe(true);
    });

    it('allows MCP streamable HTTP methods and headers', () => {
        expect(mcpCorsOptions.methods).toContain('OPTIONS');
        expect(mcpCorsOptions.methods).toContain('POST');
        expect(mcpCorsOptions.allowedHeaders).toContain('Authorization');
        expect(mcpCorsOptions.allowedHeaders).toContain('mcp-session-id');
    });
});
