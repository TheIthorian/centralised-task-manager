import { Link, useRouteError } from 'react-router';
import config from '../config.js';

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown error';
}

/** Full-page error view rendered by React Router when a route throws. */
export function ErrorPage(): React.JSX.Element {
    const error = useRouteError();

    return (
        <div className="min-h-dvh flex items-center justify-center p-4">
            <div className="bg-panel border border-line shadow-[6px_6px_0px_#111] p-8 text-center max-w-sm w-full">
                <div className="text-6xl mb-4">⚠</div>
                <h1 className="text-2xl font-semibold text-fg mb-2">
                    Something went wrong
                </h1>
                <p className="text-muted dark:text-neutral-400 text-sm mb-6">
                    An unexpected error occurred. Try reloading or go back to tasks.
                </p>
                {config.isDev && (
                    <details className="mb-6 text-left text-xs font-mono">
                        <summary className="cursor-pointer text-muted dark:text-neutral-400 mb-1">
                            Error details
                        </summary>
                        <pre className="bg-neutral-100 dark:bg-neutral-800 p-3 overflow-auto text-warn whitespace-pre-wrap">
                            {getErrorMessage(error)}
                        </pre>
                    </details>
                )}
                <div className="flex gap-3 justify-center">
                    <button
                        type="button"
                        aria-label="Reload page"
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center justify-center gap-2 border border-line font-semibold uppercase tracking-[0.12em] text-sm px-4 py-2 bg-panel text-fg transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none cursor-pointer"
                    >
                        ↺ Reload
                    </button>
                    <Link
                        to="/tasks"
                        className="inline-flex items-center justify-center gap-2 border border-line font-semibold uppercase tracking-[0.12em] text-sm px-4 py-2 bg-fg dark:bg-accent text-accent-fg transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none"
                    >
                        Go to Tasks
                    </Link>
                </div>
            </div>
        </div>
    );
}
