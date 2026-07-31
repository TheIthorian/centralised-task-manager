import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiHttpClient } from '../../http/api-http-client.js';
import { DataPortabilityClient } from './data-portability.client.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('DataPortabilityClient', () => {
    const mockInstance = {
        request: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockInstance as never);
    });

    it('posts to the export endpoint', async () => {
        const client = buildClient();
        const payload = {
            exportId: 'uuid-1',
            files: [{ filename: 'export-part-1.json', sizeBytes: 100, contentType: 'application/json', sha256: 'abc' }],
        };

        mockInstance.request.mockResolvedValueOnce({ data: payload });

        const result = await client.exportData();

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'POST',
            url: '/users/me/export',
            data: undefined,
            params: undefined,
        });
        expect(result).toEqual(payload);
    });

    it('downloads an export file as a blob', async () => {
        const client = buildClient();
        const blob = new Blob(['{}'], { type: 'application/json' });

        mockInstance.request.mockResolvedValueOnce({ data: blob });

        const result = await client.downloadExportFile({ exportId: 'uuid-1', filename: 'export-part-1.json' });

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'GET',
            url: '/users/me/exports/uuid-1/export-part-1.json',
            data: undefined,
            params: undefined,
            responseType: 'blob',
        });
        expect(result).toBe(blob);
    });

    it('uploads import files as multipart form data', async () => {
        const client = buildClient();
        const summary = {
            imported: { tasks: 2, notifications: 1 },
            skipped: { tasks: 0, notifications: 0 },
        };

        mockInstance.request.mockResolvedValueOnce({ data: summary });

        const file = new Blob(['{}'], { type: 'application/json' });
        const result = await client.importData({ files: [file], onConflict: 'replace' });

        expect(mockInstance.request).toHaveBeenCalledTimes(1);
        const callArg = mockInstance.request.mock.calls[0][0];

        expect(callArg.method).toBe('POST');
        expect(callArg.url).toBe('/users/me/import');
        expect(callArg.data).toBeInstanceOf(FormData);
        expect((callArg.data as FormData).get('onConflict')).toBe('replace');
        expect(result).toEqual(summary);
    });

    function buildClient(): DataPortabilityClient {
        return new DataPortabilityClient({ http: new ApiHttpClient({ baseUrl: 'http://localhost:3000' }) });
    }
});
