import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
    let module: TestingModule;
    let service: AuthService;

    beforeAll(async () => {
        module = await Test.createTestingModule({ imports: [AppModule] }).compile();
        service = module.get(AuthService);
    });

    afterAll(async () => {
        await module.close();
    });

    it('register creates user and returns token pair', async () => {
        const email = `auth-svc-${Date.now()}@example.com`;
        const result = await service.register({ email, password: 'password123' });

        expect(result).toHaveProperty('accessToken');
        expect(result.refreshToken).toMatch(/^rt_/);
        expect(result.user.email).toBe(email);
    });

    it('register propagates ConflictException from UsersService', async () => {
        const email = `auth-conflict-${Date.now()}@example.com`;
        await service.register({ email, password: 'password123' });

        await expect(service.register({ email, password: 'pass' })).rejects.toThrow(ConflictException);
    });
});
