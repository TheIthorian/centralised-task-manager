import { Link } from 'react-router';
import { Button } from '../components/ui/index.js';

/** 404 page. */
export function NotFoundPage(): React.JSX.Element {
    return (
        <div className="min-h-screen bg-nb-yellow dark:bg-neutral-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 border-4 border-nb-black dark:border-white/20 shadow-[6px_6px_0px_#111] dark:shadow-none p-8 text-center max-w-sm">
                <h1 className="text-6xl font-black text-nb-black dark:text-white mb-2">404</h1>
                <p className="font-black uppercase text-nb-black dark:text-white mb-6">Page not found.</p>
                <Link to="/tasks">
                    <Button>← Back to Tasks</Button>
                </Link>
            </div>
        </div>
    );
}
