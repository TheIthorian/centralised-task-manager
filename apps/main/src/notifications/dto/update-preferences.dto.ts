export type ChannelPrefsDto = {
    inApp?: boolean;
    discord?: boolean;
    email?: boolean;
};

export type UpdatePreferencesDto = {
    connectorReconnect?: ChannelPrefsDto;
    dailySummary?: ChannelPrefsDto;
    reminder?: ChannelPrefsDto;
    upcomingDeadline?: ChannelPrefsDto;
};
