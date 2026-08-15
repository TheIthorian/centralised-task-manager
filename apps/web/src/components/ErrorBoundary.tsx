import { Component, type ErrorInfo } from 'react';
import config from '../config.js';

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
            <div
                role="alert"
                className="m-4 border border-line bg-panel p-6 max-w-lg rounded-ctm"
            >
                <h2 className="text-xl font-semibold text-fg mb-2">
                    Something went wrong
                </h2>
                <p className="text-muted dark:text-neutral-400 mb-4 text-sm">
                    An unexpected error occurred in this section.
                </p>
                {config.isDev && (
                    <details className="mb-4 text-xs font-mono">
                        <summary className="cursor-pointer text-muted dark:text-neutral-400 mb-1">
                            Error details
                        </summary>
                        <pre className="bg-neutral-100 dark:bg-neutral-800 p-3 overflow-auto text-warn whitespace-pre-wrap">
                            {error.message}
                            {'\n'}
                            {error.stack}
                        </pre>
                    </details>
                )}
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center justify-center gap-2 border border-line font-semibold uppercase tracking-[0.12em] text-sm px-4 py-2 bg-fg dark:bg-accent text-accent-fg transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none cursor-pointer rounded-ctm"
                >
                    Reload
                </button>
            </div>
        );
    }
}
