import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { NotificationPreferencesDto, UpdateNotificationPreferencesDto, ChannelPrefsDto } from '@ctm/api-client';
import { useAuth } from '../auth/AuthContext.js';
import { useToast } from '../toast/ToastContext.js';
import { Checkbox } from '@ctm/ui';

type NotificationKey = keyof NotificationPreferencesDto;
type ChannelKey = keyof ChannelPrefsDto;

const ROWS: { key: NotificationKey; label: string }[] = [
    { key: 'connectorReconnect', label: 'Connector Reconnect' },
    { key: 'dailySummary', label: 'Daily Summary' },
    { key: 'reminder', label: 'Reminder' },
    { key: 'upcomingDeadline', label: 'Upcoming Deadline' },
];

const CHANNELS: { key: ChannelKey; label: string }[] = [
    { key: 'inApp', label: 'In-App' },
    { key: 'discord', label: 'Discord' },
    { key: 'email', label: 'Email' },
];

/** Settings sub-page: notification preference grid (per-type × per-channel). */
export function NotificationsPage(): React.JSX.Element {
    const { api } = useAuth();
    const { showToast } = useToast();
    const qc = useQueryClient();

    const {
        data: prefs,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['notification-preferences'],
        queryFn: () => api.getNotificationPreferences(),
    });

    const { data: connectors } = useQuery({
        queryKey: ['connectors'],
        queryFn: () => api.listConnectors(),
    });

    const discordConnected = (connectors?.find((c) => c.source === 'discord')?.accounts.length ?? 0) > 0;

    const mutation = useMutation({
        mutationFn: (dto: UpdateNotificationPreferencesDto) => api.updateNotificationPreferences({ dto }),
        onMutate: async (dto) => {
            await qc.cancelQueries({ queryKey: ['notification-preferences'] });

            const previous = qc.getQueryData<NotificationPreferencesDto>(['notification-preferences']);

            qc.setQueryData<NotificationPreferencesDto>(['notification-preferences'], (old) => {
                if (!old) return old;

                const updated = { ...old };

                for (const [k, v] of Object.entries(dto)) {
                    updated[k as NotificationKey] = {
                        ...old[k as NotificationKey],
                        ...(v ?? {}),
                    };
                }

                return updated;
            });

            return { previous };
        },
        onSuccess: (serverPrefs) => {
            qc.setQueryData(['notification-preferences'], serverPrefs);
        },
        onError: (_err, _dto, context) => {
            if (context?.previous) {
                qc.setQueryData(['notification-preferences'], context.previous);
            }

            showToast({ title: 'Error', description: 'Failed to save preferences' });
        },
    });

    const handleToggle = (type: NotificationKey, channel: ChannelKey, value: boolean): void => {
        mutation.mutate({ [type]: { [channel]: value } });
    };

    if (isLoading) {
        return (
            <div className="p-4 md:p-6 max-w-2xl">
                <p className="font-medium text-sm text-muted">Loading…</p>
            </div>
        );
    }

    if (isError || !prefs) {
        return (
            <div className="p-4 md:p-6 max-w-2xl">
                <p className="text-warn font-medium text-sm">Failed to load notification preferences.</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-2xl">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight text-fg">
                    Notifications
                </h1>

                <p className="text-muted font-medium text-sm mt-1">
                    Choose how you receive notifications.
                </p>
            </div>

            <div className="bg-panel border border-line overflow-x-auto rounded-ctm">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-line">
                            <th className="text-left px-4 py-3 font-semibold text-xs tracking-wide text-fg" />

                            {CHANNELS.map(({ key, label }) => (
                                <th
                                    key={key}
                                    className="px-4 py-3 font-semibold text-xs tracking-wide text-fg text-center"
                                >
                                    {key === 'discord' && !discordConnected ? (
                                        <span className="flex flex-col items-center gap-0.5">
                                            <span className="text-muted">{label}</span>

                                            <Link
                                                to="/settings/connectors"
                                                className="text-muted underline font-medium text-xs normal-case"
                                            >
                                                Connect →
                                            </Link>
                                        </span>
                                    ) : (
                                        label
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {ROWS.map(({ key, label }, i) => (
                            <tr
                                key={key}
                                className={
                                    i < ROWS.length - 1 ? 'border-b border-line/10 ' : ''
                                }
                            >
                                <td className="px-4 py-3 font-medium text-sm text-fg">{label}</td>

                                {CHANNELS.map(({ key: channel }) => {
                                    const isDiscordDisabled = channel === 'discord' && !discordConnected;

                                    return (
                                        <td key={channel} className="px-4 py-3 text-center">
                                            <div
                                                className={`flex justify-center ${isDiscordDisabled ? 'opacity-40' : ''}`}
                                            >
                                                <Checkbox
                                                    checked={prefs[key][channel]}
                                                    onChange={(v) => handleToggle(key, channel, v)}
                                                    label={`${label} via ${channel}`}
                                                    disabled={isDiscordDisabled}
                                                />
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
