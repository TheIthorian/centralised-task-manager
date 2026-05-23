import type { NotificationChannel, DiscordChannelConfig } from '../types.js';
import type { DiscordDmChannelResponse } from './discord.types.js';

const DISCORD_API = 'https://discord.com/api/v10';

export class DiscordChannel implements NotificationChannel<DiscordChannelConfig> {
    readonly name = 'discord';

    /** Send a DM via Discord bot. Opens a DM channel first if dmChannelId is absent. */
    async send({ config, title, body }: { config: DiscordChannelConfig; title: string; body: string }): Promise<void> {
        const channelId = config.dmChannelId ?? (await this.openDmChannel(config));

        await this.sendMessage({ channelId, botToken: config.botToken, content: `**${title}**\n${body}` });
    }

    /** Open a DM channel with a Discord user and return the channel ID. */
    async openDmChannel({ botToken, discordUserId }: { botToken: string; discordUserId: string }): Promise<string> {
        const res = await fetch(`${DISCORD_API}/users/@me/channels`, {
            method: 'POST',
            headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: discordUserId }),
        });

        if (!res.ok) throw new Error(`Discord open DM failed: ${res.status}`);

        const data = (await res.json()) as DiscordDmChannelResponse;

        return data.id;
    }

    private async sendMessage({
        channelId,
        botToken,
        content,
    }: {
        channelId: string;
        botToken: string;
        content: string;
    }): Promise<void> {
        const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });

        if (!res.ok) throw new Error(`Discord send message failed: ${res.status}`);
    }
}
