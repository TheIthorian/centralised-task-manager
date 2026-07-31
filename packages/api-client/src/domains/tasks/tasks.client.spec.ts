import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiHttpClient } from '../../http/api-http-client.js';
import { TasksClient } from './tasks.client.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('TasksClient', () => {
    const mockInstance = {
        request: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockInstance as never);
    });

    it('maps done filter to status query param', async () => {
        const client = new TasksClient({ http: new ApiHttpClient({ baseUrl: 'http://localhost:3000' }) });

        mockInstance.request.mockResolvedValueOnce({ data: [] });

        await client.listTasks({ filter: 'done' });

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'GET',
            url: '/tasks',
            data: undefined,
            params: { status: 'done' },
        });
    });

    it('maps the remaining presets to the filter query param', async () => {
        const client = new TasksClient({ http: new ApiHttpClient({ baseUrl: 'http://localhost:3000' }) });

        mockInstance.request.mockResolvedValueOnce({ data: [] });

        await client.listTasks({ filter: 'today' });

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'GET',
            url: '/tasks',
            data: undefined,
            params: { filter: 'today' },
        });
    });
});
