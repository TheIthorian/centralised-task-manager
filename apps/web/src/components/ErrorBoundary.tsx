import { Component, type ErrorInfo } from 'react';

type Props = {
    children: React.ReactNode;
    fallback?: React.ReactNode;
};

type State = {
    error: Error | null;
};

/** Catches JS errors in its subtree and renders an inline fallback card. */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render(): React.ReactNode {
        const { error } = this.state;
        const { children, fallback } = this.props;

        if (!error) return children;
        if (fallback) return fallback;

        return (
            <div className="m-4 border-4 border-nb-black dark:border-white/20 bg-white dark:bg-neutral-900 shadow-[4px_4px_0px_#111] dark:shadow-none p-6 max-w-lg">
                <h2 className="text-xl font-black uppercase text-nb-black dark:text-white mb-2">
                    Something went wrong
                </h2>
                <p className="text-nb-grey dark:text-neutral-400 mb-4 text-sm">
                    An unexpected error occurred in this section.
                </p>
                {import.meta.env.DEV && (
                    <details className="mb-4 text-xs font-mono">
                        <summary className="cursor-pointer text-nb-grey dark:text-neutral-400 mb-1">
                            Error details
                        </summary>
                        <pre className="bg-neutral-100 dark:bg-neutral-800 p-3 overflow-auto text-nb-red whitespace-pre-wrap">
                            {error.message}
                            {'\n'}
                            {error.stack}
                        </pre>
                    </details>
                )}
                <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center justify-center gap-2 border-2 border-nb-black dark:border-white/20 font-black uppercase tracking-wide text-sm px-4 py-2 bg-nb-black dark:bg-nb-yellow text-white dark:text-nb-black shadow-[3px_3px_0px_#111] dark:shadow-none transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none cursor-pointer"
                >
                    Reload
                </button>
            </div>
        );
    }
}
