import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { OAuthResourceService } from './oauth-resource.service.js';

describe('OAuthResourceService', () => {
    const config = {
        getOrThrow: vi.fn((key: string): string => {
            if (key === 'MCP_PUBLIC_URL') return 'http://localhost:3002';
            if (key === 'CTM_API_BASE_URL') return 'http://localhost:3000/';
            throw new Error(`unexpected key: ${key}`);
        }),
    } as unknown as ConfigService;

    const service = new OAuthResourceService(config);

    it('returns protected resource metadata pointing at apps/main', () => {
        expect(service.getMetadata()).toEqual({
            resource: 'http://localhost:3002/mcp',
            authorization_servers: ['http://localhost:3000'],
            scopes_supported: ['openid', 'email', 'profile'],
            registration_endpoint: 'http://localhost:3000/.well-known/oauth-client',
        });
    });

    it('builds a WWW-Authenticate header with resource_metadata', () => {
        expect(service.getWwwAuthenticateHeader()).toBe(
            'Bearer resource_metadata="http://localhost:3002/.well-known/oauth-protected-resource", scope="openid"',
        );
    });
});
