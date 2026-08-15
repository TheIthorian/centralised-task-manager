import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigurationError } from '@ctm/errors';
import { buildClient } from './client.js';
import { readConfig, readSession } from './auth.js';

vi.mock('./auth.js', () => ({ readConfig: vi.fn(), readSession: vi.fn(), updateStoredTokens: vi.fn() }));
vi.mock('./baked-config.js', () => ({ bakedBaseUrl: () => null }));

const baseUrl = 'http://localhost:3000';

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['CTM_TOKEN'];
    delete process.env['CTM_BASE_URL'];
    vi.mocked(readConfig).mockReturnValue({ baseUrl });
});

describe('buildClient', () => {
    it('says to log in rather than sending an unauthenticated request', () => {
        vi.mocked(readSession).mockReturnValue(null);

        expect(() => buildClient({})).toThrow(ConfigurationError);
    });

    it('names the server the user is not logged in to', () => {
        vi.mocked(readSession).mockReturnValue(null);

        expect(() => buildClient({})).toThrow(new RegExp(baseUrl));
    });

    it('uses an explicit token without consulting the stored session', () => {
        buildClient({ token: 'explicit-token' });

        expect(readSession).not.toHaveBeenCalled();
    });

    it('builds a client from the stored session', () => {
        vi.mocked(readSession).mockReturnValue({
            baseUrl,
            accessToken: 'at',
            refreshToken: 'rt',
            grant: 'oauth' as never,
        });

        expect(buildClient({})).toBeDefined();
    });

    it('refuses a base URL that is not an absolute http(s) URL', () => {
        vi.mocked(readConfig).mockReturnValue({ baseUrl: 'not-a-url' });

        expect(() => buildClient({})).toThrow(ConfigurationError);
    });
});
