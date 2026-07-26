import { Outlet, Link, useLocation } from 'react-router';
import clsx from 'clsx';

const tabs = [
    { label: 'Connectors', shortLabel: 'Connectors', icon: '🔌', path: '/settings/connectors' },
    { label: 'Profile', shortLabel: 'Profile', icon: '👤', path: '/settings/profile' },
    { label: 'Notifications', shortLabel: 'Alerts', icon: '🔔', path: '/settings/notifications' },
    { label: 'Authorized Apps', shortLabel: 'Apps', icon: '🔑', path: '/settings/authorized-apps' },
];

/**
 * Settings shell with sub-nav: a 2x2 tap grid on mobile (all four sections
 * visible without scrolling), the original horizontal tab row on desktop.
 */
export function SettingsLayout(): React.JSX.Element {
    const { pathname } = useLocation();

    return (
        <div className="p-4 md:p-6">
            <h1 className="text-2xl font-black uppercase text-nb-black dark:text-white mb-4">Settings</h1>

            <div className="grid grid-cols-2 gap-2 mb-6 md:flex md:border-b-2 md:border-nb-black md:dark:border-white/20 md:pb-2">
                {tabs.map(({ label, shortLabel, icon, path }) => {
                    const active = pathname === path;

                    return (
                        <Link
                            key={path}
                            to={path}
                            aria-current={active ? 'page' : undefined}
                            className={clsx(
                                'flex items-center gap-2 min-h-11 px-3 font-black uppercase text-xs border-2 border-nb-black dark:border-white/20',
                                'md:min-h-0 md:px-4 md:py-1.5 md:text-sm',
                                active
                                    ? 'bg-nb-black text-white dark:bg-white dark:text-nb-black'
                                    : 'bg-white dark:bg-neutral-800 text-nb-black dark:text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] md:shadow-none hover:bg-nb-yellow/40 dark:hover:bg-nb-yellow/20',
                            )}
                        >
                            <span className="text-base leading-none md:hidden">{icon}</span>
                            <span className="md:hidden">{shortLabel}</span>
                            <span className="hidden md:inline whitespace-nowrap">{label}</span>
                        </Link>
                    );
                })}
            </div>

            <Outlet />
        </div>
    );
}
