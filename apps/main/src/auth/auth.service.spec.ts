import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';

describe('AuthService', () => {
    let service: AuthService;
    let usersService: { create: ReturnType<typeof vi.fn>; findByEmail: ReturnType<typeof vi.fn> };
    let jwtService: { sign: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        usersService = { create: vi.fn(), findByEmail: vi.fn() };
        jwtService = { sign: vi.fn().mockReturnValue('signed-token') };

        const module = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: UsersService, useValue: usersService },
                { provide: JwtService, useValue: jwtService },
            ],
        }).compile();

        service = module.get(AuthService);
    });

    it('register creates user and returns token', async () => {
        usersService.create.mockResolvedValue({ _id: 'uid', email: 'a@b.com' });

        const result = await service.register({ email: 'a@b.com', password: 'password123' });

        expect(result).toEqual({ accessToken: 'signed-token' });
    });

    it('register propagates ConflictException from UsersService', async () => {
        usersService.create.mockRejectedValue(new ConflictException('Email already registered'));

        await expect(service.register({ email: 'a@b.com', password: 'pass' })).rejects.toThrow(ConflictException);
    });
});
