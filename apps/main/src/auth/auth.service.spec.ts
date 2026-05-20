import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { RefreshToken } from './schemas/refresh-token.schema.js';

describe('AuthService', () => {
    let service: AuthService;
    let usersService: { create: ReturnType<typeof vi.fn>; findByEmail: ReturnType<typeof vi.fn> };
    let jwtService: { sign: ReturnType<typeof vi.fn> };
    let configService: { get: ReturnType<typeof vi.fn> };
    let refreshTokenModel: { create: ReturnType<typeof vi.fn>; findOneAndDelete: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        usersService = { create: vi.fn(), findByEmail: vi.fn() };
        jwtService = { sign: vi.fn().mockReturnValue('signed-token') };
        configService = { get: vi.fn().mockReturnValue(30) };
        refreshTokenModel = {
            create: vi.fn().mockResolvedValue({}),
            findOneAndDelete: vi.fn(),
            deleteMany: vi.fn(),
        };

        const module = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: UsersService, useValue: usersService },
                { provide: JwtService, useValue: jwtService },
                { provide: ConfigService, useValue: configService },
                { provide: getModelToken(RefreshToken.name), useValue: refreshTokenModel },
            ],
        }).compile();

        service = module.get(AuthService);
    });

    it('register creates user and returns token pair', async () => {
        usersService.create.mockResolvedValue({ _id: 'uid', email: 'a@b.com' });

        const result = await service.register({ email: 'a@b.com', password: 'password123' });

        expect(result).toHaveProperty('accessToken', 'signed-token');
        expect(result).toHaveProperty('refreshToken');
        expect(result.refreshToken).toMatch(/^rt_/);
        expect(result.user).toEqual({ id: 'uid', email: 'a@b.com' });
    });

    it('register propagates ConflictException from UsersService', async () => {
        usersService.create.mockRejectedValue(new ConflictException('Email already registered'));

        await expect(service.register({ email: 'a@b.com', password: 'pass' })).rejects.toThrow(ConflictException);
    });
});
