import { Link, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Button } from '@ctm/ui';
import { useAdminApi } from '../api/AdminApiContext.js';
import { queryKeys } from '../api/query-keys.js';
import { useTheme } from '../theme/ThemeContext.js';

const navItems = [
    { key: 'dashboard', path: '/dashboard' },
    { key: 'clients', path: '/clients' },
    { key: 'audit', path: '/audit' },
] as const;

/** Operator layout: a fixed sidebar and one column of content. */
export function AppShell(): React.JSX.Element {
    const { t } = useTranslation();
    const { theme, toggle } = useTheme();
    const { pathname } = useLocation();
    const api = useAdminApi();

    // Access already decided who this is; the console shows it so an operator can tell which
    // identity a destructive action will be recorded against.
    const { data: identity } = useQuery({
        queryKey: queryKeys.identity,
        queryFn: () => api.getIdentity(),
    });

    return (
        <div className="flex min-h-dvh">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-ctm focus:bg-panel focus:px-3 focus:py-2 focus:text-sm focus:outline-2 focus:outline-accent"
            >
                {t('app.skipToContent')}
            </a>

            <aside className="sticky top-0 flex h-dvh w-48 shrink-0 flex-col border-r border-line bg-nav-bg">
                <div className="px-4 py-4">
                    <span className="text-sm font-medium tracking-tight text-fg">{t('app.name')}</span>
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
                    <p className="truncate text-[11px] text-muted">
                        {identity ? t('nav.signedInAs', { email: identity.email }) : t('nav.identityUnknown')}
                    </p>
                    <Button variant="secondary" onClick={toggle} className="w-full text-xs">
                        {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                    </Button>
                    {/* Access owns the session, so signing out means clearing its cookie; the
                        console has no session of its own to end. */}
                    <a
                        href="/cdn-cgi/access/logout"
                        className="rounded-ctm px-3 py-2 text-center text-xs font-semibold text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        {t('nav.signOut')}
                    </a>
                </div>
            </aside>

            <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto">
                <div key={pathname} className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
