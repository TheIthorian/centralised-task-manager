import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.js';
import { NotificationPanel } from '../notifications/NotificationPanel.js';

/** Top bar with bell icon and unread count, shown across all pages. */
export function TopBar(): React.JSX.Element {
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
                className="fixed top-3 right-4 z-30 flex items-center justify-center w-9 h-9 bg-white border-2 border-nb-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                aria-label="Notifications"
            >
                <span className="text-xl leading-none">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-nb-yellow text-nb-black text-[9px] font-black min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
        </>
    );
}
