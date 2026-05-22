import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service.js';
import { InAppChannel } from './channels/in-app.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { DiscordChannel, DiscordAuthExpiredError } from './channels/discord.channel.js';
import { User } from '../users/schemas/user.schema.js';

function makePrefs(overrides: object = {}): object {
    return {
        connectorReconnect: { inApp: true, discord: false, email: false },
        dailySummary: { inApp: true, discord: false, email: false },
        reminder: { inApp: true, discord: false, email: false },
        upcomingDeadline: { inApp: true, discord: false, email: false },
        ...overrides,
    };
}

describe('NotificationsService', () => {
    let service: NotificationsService;
    let inApp: { send: ReturnType<typeof vi.fn> };
    let email: { send: ReturnType<typeof vi.fn> };
    let discord: { send: ReturnType<typeof vi.fn> };
    let mockFindById: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        inApp = { send: vi.fn().mockResolvedValue(undefined) };
        email = { send: vi.fn().mockResolvedValue(undefined) };
        discord = { send: vi.fn().mockResolvedValue(undefined) };
        const mockSelect = vi.fn().mockResolvedValue({
            notificationPreferences: makePrefs(),
        });
        mockFindById = vi.fn().mockReturnValue({ select: mockSelect });

        const module = await Test.createTestingModule({
            providers: [
                NotificationsService,
                { provide: InAppChannel, useValue: inApp },
                { provide: EmailChannel, useValue: email },
                { provide: DiscordChannel, useValue: discord },
                { provide: getModelToken(User.name), useValue: { findById: mockFindById } },
            ],
        }).compile();

        service = module.get(NotificationsService);
    });

    it('sends to inApp when inApp pref is true', async () => {
        await service.send({ userId: 'u1', type: 'daily_summary', title: 'T', body: 'B' });
        expect(inApp.send).toHaveBeenCalledOnce();
        expect(email.send).not.toHaveBeenCalled();
        expect(discord.send).not.toHaveBeenCalled();
    });

    it('skips inApp when inApp pref is false', async () => {
        const mockSelect = vi.fn().mockResolvedValue({
            notificationPreferences: makePrefs({ dailySummary: { inApp: false, discord: false, email: false } }),
        });
        mockFindById.mockReturnValue({ select: mockSelect });

        await service.send({ userId: 'u1', type: 'daily_summary', title: 'T', body: 'B' });
        expect(inApp.send).not.toHaveBeenCalled();
    });

    it('sends to discord when discord pref is true', async () => {
        const mockSelect = vi.fn().mockResolvedValue({
            notificationPreferences: makePrefs({ reminder: { inApp: false, discord: true, email: false } }),
        });
        mockFindById.mockReturnValue({ select: mockSelect });

        await service.send({ userId: 'u1', type: 'reminder', title: 'T', body: 'B' });
        expect(discord.send).toHaveBeenCalledOnce();
    });

    it('sends inApp connector_reconnect notification when Discord token expires', async () => {
        const mockSelect = vi.fn().mockResolvedValue({
            notificationPreferences: makePrefs({ reminder: { inApp: false, discord: true, email: false } }),
        });
        mockFindById.mockReturnValue({ select: mockSelect });
        discord.send.mockRejectedValue(new DiscordAuthExpiredError());

        await service.send({ userId: 'u1', type: 'reminder', title: 'T', body: 'B' });

        expect(inApp.send).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'connector_reconnect' }),
        );
    });

    it('continues to email channel even if inApp fails', async () => {
        const mockSelect = vi.fn().mockResolvedValue({
            notificationPreferences: makePrefs({ reminder: { inApp: true, discord: false, email: true } }),
        });
        mockFindById.mockReturnValue({ select: mockSelect });
        inApp.send.mockRejectedValue(new Error('DB down'));

        await service.send({ userId: 'u1', type: 'reminder', title: 'T', body: 'B' });
        expect(email.send).toHaveBeenCalledOnce();
    });

    it('is a no-op when user is not found', async () => {
        const mockSelect = vi.fn().mockResolvedValue(null);
        mockFindById.mockReturnValue({ select: mockSelect });

        await service.send({ userId: 'missing', type: 'reminder', title: 'T', body: 'B' });
        expect(inApp.send).not.toHaveBeenCalled();
    });
});
