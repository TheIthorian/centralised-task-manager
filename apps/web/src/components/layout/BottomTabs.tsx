import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useAuth } from '../../auth/AuthContext.js';
import { useNotificationSocket } from '../../hooks/useNotificationSocket.js';

const tabs = [
    { key: 'tasks', path: '/tasks' },
    { key: 'calendar', path: '/calendar' },
    { key: 'timeline', path: '/timeline' },
    { key: 'settings', path: '/settings' },
] as const;

/**
 * Mobile bottom tab bar. Rows stay at 44px and the bar carries safe-area padding so it
 * clears the home indicator.
 */
export function BottomTabs(): React.JSX.Element {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const { api } = useAuth();

    useNotificationSocket(api);

    return (
        <nav
            aria-label={t('nav.label')}
            className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-line bg-nav-bg pb-[env(safe-area-inset-bottom)] md:hidden"
        >
            {tabs.map(({ key, path }) => {
                const active = pathname.startsWith(path);

                return (
                    <Link
                        key={path}
                        to={path}
                        aria-current={active ? 'page' : undefined}
                        className={clsx(
                            'flex min-h-11 flex-1 items-center justify-center text-xs font-medium',
                            'transition-colors duration-press',
                            'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
                            active ? 'bg-nav-on-bg text-nav-on-fg' : 'text-nav-fg',
                        )}
                    >
                        {t(`nav.${key}`)}
                    </Link>
                );
            })}
        </nav>
    );
}
