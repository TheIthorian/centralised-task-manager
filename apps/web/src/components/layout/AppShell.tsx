import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar.js';
import { BottomTabs } from './BottomTabs.js';
import { TopBar } from './TopBar.js';

/** Responsive app layout: sidebar on desktop, bottom tabs on mobile. */
export function AppShell(): React.JSX.Element {
    return (
        <div className="flex min-h-dvh">
            <Sidebar />
            {/* pt on mobile reserves room for the fixed notification bell, which would
                otherwise sit on top of page headers. */}
            {/*
                One centred column rather than a left-aligned one: at 1440px the old layout
                left half the window empty on the right, which read as a broken page rather
                than as breathing room. The measure stays short enough to scan, and the
                space either side is where the task detail panel opens later.
            */}
            <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto pb-16 pt-12 md:pb-0 md:pt-0">
                <div className="mx-auto w-full max-w-4xl">
                    <Outlet />
                </div>
            </main>
            <TopBar />
            <BottomTabs />
        </div>
    );
}
