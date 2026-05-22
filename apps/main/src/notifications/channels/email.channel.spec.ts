import { describe, it, expect, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { EmailChannel } from './email.channel.js';

describe('EmailChannel', () => {
    it('logs the notification without throwing', async () => {
        const channel = new EmailChannel();
        const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

        await expect(
            channel.send({ userId: 'u1', type: 'daily_summary', title: 'Hi', body: 'Body' }),
        ).resolves.toBeUndefined();

        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
