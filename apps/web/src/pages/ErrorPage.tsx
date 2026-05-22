import { Link, useRouteError } from 'react-router';

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown error';
}

/** Full-page error view rendered by React Router when a route throws. */
export function ErrorPage(): React.JSX.Element {
    const error = useRouteError();

    return (
        <div className="min-h-screen bg-nb-yellow dark:bg-neutral-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 border-4 border-nb-black dark:border-white/20 shadow-[6px_6px_0px_#111] dark:shadow-none p-8 text-center max-w-sm w-full">
                <div className="text-6xl mb-4">⚠</div>
                <h1 className="text-2xl font-black uppercase text-nb-black dark:text-white mb-2">
                    Something went wrong
                </h1>
                <p className="text-nb-grey dark:text-neutral-400 text-sm mb-6">
                    An unexpected error occurred. Try reloading or go back to tasks.
                </p>
                {import.meta.env.DEV && (
                    <details className="mb-6 text-left text-xs font-mono">
                        <summary className="cursor-pointer text-nb-grey dark:text-neutral-400 mb-1">
                            Error details
                        </summary>
                        <pre className="bg-neutral-100 dark:bg-neutral-800 p-3 overflow-auto text-nb-red whitespace-pre-wrap">
                            {getErrorMessage(error)}
                        </pre>
                    </details>
                )}
                <div className="flex gap-3 justify-center">
                    <button
                        type="button"
                        aria-label="Reload page"
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center justify-center gap-2 border-2 border-nb-black dark:border-white/20 font-black uppercase tracking-wide text-sm px-4 py-2 bg-white dark:bg-neutral-800 text-nb-black dark:text-white shadow-[3px_3px_0px_#111] dark:shadow-none transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none cursor-pointer"
                    >
                        ↺ Reload
                    </button>
                    <Link
                        to="/tasks"
                        className="inline-flex items-center justify-center gap-2 border-2 border-nb-black dark:border-white/20 font-black uppercase tracking-wide text-sm px-4 py-2 bg-nb-black dark:bg-nb-yellow text-white dark:text-nb-black shadow-[3px_3px_0px_#111] dark:shadow-none transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none"
                    >
                        Go to Tasks
                    </Link>
                </div>
            </div>
        </div>
    );
}
