import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext.js';
import type { NotificationDto } from '@ctm/api-client';

type Props = {
    open: boolean;
    onClose: () => void;
};

const TYPE_ICON: Record<NotificationDto['type'], string> = {
    reminder: '🔔',
    upcoming_deadline: '📅',
    connector_reconnect: '🔌',
    daily_summary: '📋',
};

/** Resolve the URL to navigate to when a notification is clicked. */
function resolveUrl(n: NotificationDto): string | null {
    const { data } = n;

    if (!data) return null;

    if (data.type === 'reminder' && data.taskId) return `/tasks?highlightTaskId=${data.taskId}`;
    if (data.type === 'reminder') return '/tasks';
    if (data.type === 'upcoming_deadline') return '/tasks?filter=upcoming';
    if (data.type === 'connector_reconnect') return '/settings/connectors';
    if (data.type === 'daily_summary') return '/tasks';

    return null;
}

/** Slide-in panel showing in-app notifications with mark-read actions. */
export function NotificationPanel({ open, onClose }: Props): React.JSX.Element | null {
    const { api } = useAuth();
    const qc = useQueryClient();
    const navigate = useNavigate();

    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => api.listNotifications(),
        enabled: open,
        refetchInterval: open ? 30_000 : false,
    });

    const markReadMutation = useMutation({
        mutationFn: (id: string) => api.markNotificationRead({ id }),
        onSuccess: (_data, id) => {
            qc.setQueryData<NotificationDto[]>(['notifications'], (prev = []) =>
                prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
            );
        },
    });

    const markAllMutation = useMutation({
        mutationFn: () => api.markAllNotificationsRead(),
        onSuccess: () => {
            qc.setQueryData<NotificationDto[]>(['notifications'], (prev = []) =>
                prev.map((n) => ({ ...n, read: true })),
            );
        },
    });

    if (!open) return null;

    const unread = notifications.filter((n) => !n.read);

    const handleClick = (n: NotificationDto): void => {
        if (!n.read) markReadMutation.mutate(n.id);

        const url = resolveUrl(n);

        if (url) {
            onClose();
            void navigate(url);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={onClose} />

            {/* Panel */}
            <div className="fixed top-0 right-0 h-full w-80 max-w-full bg-panel border-l-4 border-line z-50 flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-line/10">
                    <span className="font-semibold text-sm tracking-wide text-fg">
                        Notifications
                        {unread.length > 0 && (
                            <span className="ml-2 bg-accent text-fg text-xs font-semibold px-1.5 py-0.5">
                                {unread.length}
                            </span>
                        )}
                    </span>
                    <div className="flex items-center gap-3">
                        {unread.length > 0 && (
                            <button
                                onClick={() => markAllMutation.mutate()}
                                disabled={markAllMutation.isPending}
                                className="text-xs font-semibold text-muted hover:text-fg dark:hover:text-white disabled:opacity-40"
                            >
                                Mark all read
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="font-semibold text-fg text-lg leading-none hover:opacity-60"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading && (
                        <p className="text-center text-xs font-bold text-muted py-8">
                            Loading…
                        </p>
                    )}

                    {!isLoading && notifications.length === 0 && (
                        <p className="text-center text-xs font-bold text-muted py-8">
                            No notifications
                        </p>
                    )}

                    {notifications.map((n) => (
                        <button
                            key={n.id}
                            type="button"
                            onClick={() => handleClick(n)}
                            className={`w-full text-left px-4 py-3 border-b border-line/5 dark:border-white/5 flex gap-3 items-start transition-colors hover:bg-fg/5 dark:hover:bg-white/5 ${
                                n.read ? 'opacity-50' : ''
                            }`}
                        >
                            <span className="text-base leading-none mt-0.5 shrink-0">{TYPE_ICON[n.type]}</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs text-fg truncate">{n.title}</p>
                                {n.body && (
                                    <p className="text-xs font-bold text-muted mt-0.5 line-clamp-2 whitespace-pre-line">
                                        {n.body}
                                    </p>
                                )}
                                <p className="text-xs text-fg/30 mt-1">
                                    {new Date(n.createdAt).toLocaleString()}
                                </p>
                            </div>
                            {!n.read && <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}
