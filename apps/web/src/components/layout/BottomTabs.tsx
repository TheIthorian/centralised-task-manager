import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.js';
import { NotificationPanel } from '../notifications/NotificationPanel.js';
import clsx from 'clsx';

const tabs = [
    { label: 'Tasks', path: '/tasks', icon: '☑' },
    { label: 'Calendar', path: '/calendar', icon: '📅' },
    { label: 'Timeline', path: '/timeline', icon: '↔' },
    { label: 'Profile', path: '/settings/profile', icon: '👤' },
];

/** Mobile bottom tab bar. Hidden on desktop via md:hidden in AppShell. */
export function BottomTabs(): React.JSX.Element {
    const { pathname } = useLocation();
    const { api } = useAuth();
    const [panelOpen, setPanelOpen] = useState(false);

    const { data: notifications = [] } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => api.listNotifications(),
        refetchInterval: 60_000,
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <>
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-nb-black border-t-4 border-nb-black flex z-40">
                {tabs.map(({ label, path, icon }) => {
                    const active = pathname.startsWith(path);

                    return (
                        <Link
                            key={path}
                            to={path}
                            className={clsx(
                                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2',
                                'font-black text-xs uppercase tracking-wide',
                                'transition-colors duration-100',
                                active ? 'bg-nb-yellow text-nb-black' : 'text-white/70 hover:bg-white/10',
                            )}
                        >
                            <span className="text-base leading-none">{icon}</span>
                            {label}
                        </Link>
                    );
                })}

                {/* Bell tab */}
                <button
                    type="button"
                    onClick={() => setPanelOpen(true)}
                    className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 font-black text-xs uppercase tracking-wide text-white/70 hover:bg-white/10 transition-colors duration-100"
                >
                    <span className="text-base leading-none">🔔</span>
                    Inbox
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-2 bg-nb-yellow text-nb-black text-[10px] font-black px-1 leading-tight">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            </nav>

            <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
        </>
    );
}
