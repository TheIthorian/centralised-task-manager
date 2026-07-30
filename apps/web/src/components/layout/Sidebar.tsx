import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Button } from '@ctm/ui';
import { useAuth } from '../../auth/AuthContext.js';
import { useTheme } from '../../theme/ThemeContext.js';
import { useNotificationSocket } from '../../hooks/useNotificationSocket.js';

const navItems = [
    { key: 'tasks', path: '/tasks' },
    { key: 'calendar', path: '/calendar' },
    { key: 'timeline', path: '/timeline' },
    { key: 'settings', path: '/settings' },
] as const;

/** Desktop left sidebar. Hidden on mobile via the md: breakpoint. */
export function Sidebar(): React.JSX.Element {
    const { t } = useTranslation();
    const { user, logout, api } = useAuth();
    const { theme, toggle } = useTheme();
    const { pathname } = useLocation();

    useNotificationSocket(api);

    return (
        <aside className="sticky top-0 hidden h-dvh w-44 shrink-0 flex-col border-r border-line bg-nav-bg md:flex">
            <div className="px-4 py-4">
                <span className="text-sm font-bold tracking-tight text-fg">CTM</span>
            </div>

            <nav aria-label={t('nav.label')} className="flex flex-1 flex-col gap-1 px-2">
                {navItems.map(({ key, path }) => {
                    const active = pathname.startsWith(path);

                    return (
                        <Link
                            key={path}
                            to={path}
                            aria-current={active ? 'page' : undefined}
                            className={clsx(
                                'rounded-ctm px-3 py-2 text-[12.5px] font-medium',
                                'transition-colors duration-press',
                                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                                active ? 'bg-nav-on-bg text-nav-on-fg' : 'text-nav-fg hover:text-fg',
                            )}
                        >
                            {t(`nav.${key}`)}
                        </Link>
                    );
                })}
            </nav>

            <div className="flex flex-col gap-2 border-t border-line p-3">
                <p className="truncate text-[11px] text-muted">{user?.email}</p>
                <Button variant="secondary" onClick={toggle} className="w-full text-xs">
                    {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                </Button>
                <Button variant="ghost" onClick={() => void logout()} className="w-full text-xs">
                    {t('nav.logout')}
                </Button>
            </div>
        </aside>
    );
}
