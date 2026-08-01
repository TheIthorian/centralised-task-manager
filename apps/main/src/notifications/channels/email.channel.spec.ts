import { describe, it, expect, vi } from 'vitest';
import type { Logger } from '@ctm/logger';
import { EmailChannel } from './email.channel.js';

describe('EmailChannel', () => {
    it('logs the notification without throwing', async () => {
        const channel = new EmailChannel();
        const info = vi.fn();
        Object.defineProperty(channel, 'logger', { value: { info } as unknown as Logger });

        await expect(
            channel.send({ userId: 'u1', type: 'daily_summary', title: 'Hi', body: 'Body' }),
        ).resolves.toBeUndefined();

        expect(info).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'u1', type: 'daily_summary' }),
            expect.any(String),
        );
    });

    it('never logs the notification title or body', async () => {
        const channel = new EmailChannel();
        const info = vi.fn();
        Object.defineProperty(channel, 'logger', { value: { info } as unknown as Logger });

        await channel.send({ userId: 'u1', type: 'daily_summary', title: 'Secret title', body: 'Secret body' });

        expect(JSON.stringify(info.mock.calls)).not.toContain('Secret');
    });
});
