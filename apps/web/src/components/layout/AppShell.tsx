import { Outlet, useLocation } from 'react-router';
import clsx from 'clsx';
import { Sidebar } from './Sidebar.js';
import { BottomTabs } from './BottomTabs.js';
import { TopBar } from './TopBar.js';
import { CommandPaletteHost } from '../../palette/CommandPaletteHost.js';

/**
 * Views whose content is a grid rather than a list. A calendar month and a timeline track
 * both carry more information the wider they get, so they take the whole window. Reading
 * views keep a centred measure: left-aligned at 1440px the page looked broken rather than
 * spacious, and the space either side is where the task detail panel opens later.
 */
const FULL_WIDTH_ROUTES = ['/calendar', '/timeline'];

/** Responsive app layout: sidebar on desktop, bottom tabs on mobile. */
export function AppShell(): React.JSX.Element {
    const { pathname } = useLocation();
    const fullWidth = FULL_WIDTH_ROUTES.some((route) => pathname.startsWith(route));

    return (
        <div className="flex min-h-dvh">
            <Sidebar />
            {/* pt on mobile reserves room for the fixed notification bell, which would
                otherwise sit on top of page headers. */}
            <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto pb-16 pt-12 md:pb-0 md:pt-0">
                {/* Keyed on the path so each navigation replays the entrance: without the key
                    React reuses the node and the new page appears with no transition at all. */}
                <div
                    key={pathname}
                    className={clsx(
                        'w-full motion-safe:animate-[ctm-rise_var(--duration-surface)_var(--ease-surface)]',
                        !fullWidth && 'mx-auto max-w-4xl',
                    )}
                >
                    <Outlet />
                </div>
            </main>
            <TopBar />
            <BottomTabs />
            <CommandPaletteHost />
        </div>
    );
}
