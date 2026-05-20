import { Outlet, Link, useLocation } from 'react-router';
import clsx from 'clsx';

const tabs = [
    { label: 'Sources', path: '/settings/sources' },
    { label: 'Profile', path: '/settings/profile' },
];

/** Settings shell with sub-nav (desktop only). */
export function SettingsLayout(): React.JSX.Element {
    const { pathname } = useLocation();

    return (
        <div className="p-6">
            <h1 className="text-2xl font-black uppercase text-nb-black mb-4">Settings</h1>
            <div className="hidden md:flex gap-2 mb-6 border-b-2 border-nb-black pb-2">
                {tabs.map(({ label, path }) => (
                    <Link
                        key={path}
                        to={path}
                        className={clsx(
                            'px-4 py-1.5 font-black uppercase text-sm border-2 border-nb-black',
                            pathname === path ? 'bg-nb-black text-white' : 'bg-white text-nb-black hover:bg-nb-yellow/40',
                        )}
                    >
                        {label}
                    </Link>
                ))}
            </div>
            <Outlet />
        </div>
    );
}
