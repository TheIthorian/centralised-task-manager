import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.js';
import { NotificationPanel } from '../notifications/NotificationPanel.js';

/** Top bar with bell icon and unread count, shown across all pages. */
export function TopBar(): React.JSX.Element {
    const { t } = useTranslation();
    const { api } = useAuth();
    const [panelOpen, setPanelOpen] = useState(false);

    const { data: notifications = [] } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => api.listNotifications(),
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <>
            <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="fixed right-4 top-3 z-30 flex h-11 w-11 items-center justify-center md:h-9 md:w-9 rounded-ctm border border-line bg-panel text-muted transition-colors duration-press hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                aria-label={t('nav.notifications')}
            >
                <span className="text-xl leading-none">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold leading-none text-accent-fg">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
        </>
    );
}
