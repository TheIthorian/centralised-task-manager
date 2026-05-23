import { HttpClient } from '@ctm/http-client';
import type { DiscordDmChannelResponse } from './discord.types.js';

export class DiscordMessageClient {
    readonly name = 'discord';

    constructor(private readonly httpClient: HttpClient) {}

    /** Send a DM via Discord bot. Opens a DM channel first if dmChannelId is absent. */
    async send({
        channelId,
        botToken,
        title,
        body,
    }: {
        channelId: string;
        botToken: string;
        title: string;
        body: string;
    }): Promise<void> {
        const content = `**${title}**\n${body}`;

        return await this.httpClient.post(
            `/channels/${channelId}/messages`,
            { content },
            this.botHeaders(botToken),
        );
    }

    /** Open a DM channel with a Discord user and return the channel ID. */
    async openDmChannel({
        botToken,
        discordUserId,
    }: {
        botToken: string;
        discordUserId: string;
    }): Promise<DiscordDmChannelResponse> {
        return await this.httpClient.post<DiscordDmChannelResponse>(
            `/users/@me/channels`,
            { recipient_id: discordUserId },
            this.botHeaders(botToken),
        );
    }

    private botHeaders(botToken: string): Record<string, string> {
        return { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' };
    }
}
