import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.js';
import { useTheme } from '../../theme/ThemeContext.js';
import { Button } from '@ctm/ui';
import { NotificationPanel } from '../notifications/NotificationPanel.js';
import { useNotificationSocket } from '../../hooks/useNotificationSocket.js';
import clsx from 'clsx';

const navItems = [
    { label: 'Tasks', path: '/tasks', icon: '☑' },
    { label: 'Calendar', path: '/calendar', icon: '📅' },
    { label: 'Timeline', path: '/timeline', icon: '↔' },
    { label: 'Settings', path: '/settings', icon: '⚙' },
];

/** Desktop left sidebar. Hidden on mobile via md: breakpoint in AppShell. */
export function Sidebar(): React.JSX.Element {
    const { user, logout, api } = useAuth();
    const { theme, toggle } = useTheme();
    const { pathname } = useLocation();
    const [panelOpen, setPanelOpen] = useState(false);

    useNotificationSocket(api);

    const { data: notifications = [] } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => api.listNotifications(),
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <>
            <aside className="hidden md:flex flex-col w-36 h-screen sticky top-0 bg-nb-black border-r-4 border-nb-black flex-shrink-0">
                <div className="p-4 border-b-2 border-white/10">
                    <span className="text-nb-yellow font-black text-lg uppercase tracking-tight">CTM</span>
                </div>

                <nav className="flex flex-col gap-1 p-2 flex-1">
                    {navItems.map(({ label, path, icon }) => {
                        const active = pathname.startsWith(path);

                        return (
                            <Link
                                key={path}
                                to={path}
                                className={clsx(
                                    'flex items-center gap-2 px-3 py-2 font-black text-xs uppercase tracking-wide',
                                    'transition-colors duration-100 cursor-pointer',
                                    active ? 'bg-nb-yellow text-nb-black' : 'text-white hover:bg-white/10',
                                )}
                            >
                                <span>{icon}</span>
                                {label}
                            </Link>
                        );
                    })}

                    {/* Bell */}
                    <button
                        type="button"
                        onClick={() => setPanelOpen(true)}
                        className="relative flex items-center gap-2 px-3 py-2 font-black text-xs uppercase tracking-wide text-white hover:bg-white/10 transition-colors duration-100"
                    >
                        <span>🔔</span>
                        Inbox
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 bg-nb-yellow text-nb-black text-[10px] font-black px-1 leading-tight">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>
                </nav>

                <div className="p-3 border-t-2 border-white/10 flex flex-col gap-2">
                    <p className="text-white/50 font-bold text-xs truncate">{user?.email}</p>
                    <button
                        onClick={toggle}
                        className="w-full border-2 border-white/20 font-black uppercase text-xs text-white/70 py-1 hover:bg-white/10 transition-colors"
                        aria-label="Toggle dark mode"
                    >
                        {theme === 'dark' ? '☀ Light' : '☾ Dark'}
                    </button>
                    <Button variant="secondary" onClick={logout} className="w-full text-xs py-1">
                        Logout
                    </Button>
                </div>
            </aside>

            <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
        </>
    );
}
