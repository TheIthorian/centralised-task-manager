import { Link, useLocation } from 'react-router';
import { useAuth } from '../../auth/AuthContext.js';
import { Button } from '../ui/index.js';
import clsx from 'clsx';

const navItems = [
    { label: 'Tasks', path: '/tasks', icon: '☑' },
    { label: 'Calendar', path: '/calendar', icon: '📅' },
    { label: 'Timeline', path: '/timeline', icon: '↔' },
    { label: 'Settings', path: '/settings', icon: '⚙' },
];

/** Desktop left sidebar. Hidden on mobile via md: breakpoint in AppShell. */
export function Sidebar(): React.JSX.Element {
    const { user, logout } = useAuth();
    const { pathname } = useLocation();

    return (
        <aside className="hidden md:flex flex-col w-36 min-h-screen bg-nb-black border-r-4 border-nb-black flex-shrink-0">
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
                                'transition-colors duration-100',
                                active ? 'bg-nb-yellow text-nb-black' : 'text-white hover:bg-white/10',
                            )}
                        >
                            <span>{icon}</span>
                            {label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-3 border-t-2 border-white/10 flex flex-col gap-2">
                <p className="text-white/50 font-bold text-xs truncate">{user?.email}</p>
                <Button variant="secondary" onClick={logout} className="w-full text-xs py-1">
                    Logout
                </Button>
            </div>
        </aside>
    );
}
