/** Config passed per-send to a Discord notification channel. */
export type DiscordChannelConfig = {
    discordUserId: string;
    botToken: string;
    dmChannelId?: string | null;
};
