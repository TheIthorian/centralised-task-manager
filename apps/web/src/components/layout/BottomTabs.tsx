import { Link, useLocation } from 'react-router';
import clsx from 'clsx';

const tabs = [
    { label: 'Tasks', path: '/tasks', icon: '☑' },
    { label: 'Sources', path: '/settings/sources', icon: '🔌' },
    { label: 'Profile', path: '/settings/profile', icon: '👤' },
];

/** Mobile bottom tab bar. Hidden on desktop via md:hidden in AppShell. */
export function BottomTabs(): React.JSX.Element {
    const { pathname } = useLocation();

    return (
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
        </nav>
    );
}
