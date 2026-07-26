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
            <main className="flex-1 pt-12 md:pt-0 pb-16 md:pb-0 overflow-y-auto">
                <Outlet />
            </main>
            <TopBar />
            <BottomTabs />
        </div>
    );
}
