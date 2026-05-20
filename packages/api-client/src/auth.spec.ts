import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { login, register } from './auth.js';
import { initClient } from './client.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('auth', () => {
    const mockInstance = {
        post: vi.fn(),
        get: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
        defaults: { headers: { common: {} } },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockInstance as never);
        initClient('http://localhost:3000');
    });

    describe('login', () => {
        it('posts credentials and returns token pair', async () => {
            const payload = {
                accessToken: 'acc',
                refreshToken: 'ref',
                user: { id: '1', email: 'a@b.com' },
            };

            mockInstance.post.mockResolvedValueOnce({ data: payload });

            const result = await login('a@b.com', 'pass');

            expect(mockInstance.post).toHaveBeenCalledWith('/auth/login', {
                email: 'a@b.com',
                password: 'pass',
            });
            expect(result).toEqual(payload);
        });
    });

    describe('register', () => {
        it('posts registration data and returns token pair', async () => {
            const payload = {
                accessToken: 'acc',
                refreshToken: 'ref',
                user: { id: '2', email: 'b@c.com' },
            };

            mockInstance.post.mockResolvedValueOnce({ data: payload });

            const result = await register('Bob', 'b@c.com', 'pass123');

            expect(mockInstance.post).toHaveBeenCalledWith('/auth/register', {
                name: 'Bob',
                email: 'b@c.com',
                password: 'pass123',
            });
            expect(result).toEqual(payload);
        });
    });
});
