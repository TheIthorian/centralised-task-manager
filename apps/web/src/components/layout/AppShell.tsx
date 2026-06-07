import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar.js';
import { BottomTabs } from './BottomTabs.js';
import { TopBar } from './TopBar.js';

/** Responsive app layout: sidebar on desktop, bottom tabs on mobile. */
export function AppShell(): React.JSX.Element {
    return (
        <div className="flex min-h-dvh">
            <Sidebar />
            <main className="flex-1 pb-16 md:pb-0 overflow-y-auto">
                <Outlet />
            </main>
            <TopBar />
            <BottomTabs />
        </div>
    );
}
