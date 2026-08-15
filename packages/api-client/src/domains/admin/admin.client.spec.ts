import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiHttpClient } from '../../http/api-http-client.js';
import { AdminClient } from './admin.client.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('AdminClient', () => {
    const mockInstance = { request: vi.fn() };

    function createClient(): AdminClient {
        return new AdminClient({ http: new ApiHttpClient({ baseUrl: 'http://localhost:3100' }) });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockInstance as never);
    });

    it('sends no Authorization header, because Access authenticates in front of the origin', async () => {
        mockInstance.request.mockResolvedValueOnce({ data: { email: 'ops@example.com', subject: 'sub' } });

        await createClient().getIdentity();

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'GET',
            url: '/auth/me',
            data: undefined,
            params: undefined,
        });
    });

    it('serialises numeric and boolean filters into query params', async () => {
        mockInstance.request.mockResolvedValueOnce({ data: { clients: [], total: 0 } });

        await createClient().listOAuthClients({ limit: 25, skip: 50, isDynamic: true });

        expect(mockInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({ params: { limit: '25', skip: '50', isDynamic: 'true' } }),
        );
    });

    it('omits filters that were not supplied rather than sending them empty', async () => {
        mockInstance.request.mockResolvedValueOnce({ data: { entries: [], total: 0 } });

        await createClient().listAuditLog({ action: 'oauth_client.created' });

        expect(mockInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({ params: { action: 'oauth_client.created' } }),
        );
    });

    it('escapes a client id with a slash in it, so it stays one path segment', async () => {
        mockInstance.request.mockResolvedValueOnce({ data: {} });

        await createClient().getOAuthClient({ clientId: 'a/b' });

        expect(mockInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({ url: '/oauth-clients/a%2Fb' }),
        );
    });

    it('sends the update body as a PATCH', async () => {
        mockInstance.request.mockResolvedValueOnce({ data: {} });

        await createClient().updateOAuthClient({ clientId: 'cli', dto: { clientName: 'Renamed' } });

        expect(mockInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'PATCH', url: '/oauth-clients/cli', data: { clientName: 'Renamed' } }),
        );
    });
});
